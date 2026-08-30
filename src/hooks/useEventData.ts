import { useEffect, useState, useCallback } from 'react';
import { supabase, ensureAuth } from '../lib/supabase';
import { setContext, type Session, type Match, type HoleData, type Player } from '../lib/scoring';
import type {
  DbEvent, DbTeam, DbPlayer, DbCourse, DbRound, DbTeeGroup, DbMatch, DbMatchHole,
} from '../lib/types';

export interface EventData {
  event: DbEvent;
  teams: DbTeam[];
  players: DbPlayer[];
  courses: DbCourse[];
  rounds: DbRound[];
  teeGroups: DbTeeGroup[];
  matches: DbMatch[];
  matchHoles: DbMatchHole[];
  /* scoring engine shapes */
  scoringSessions: Session[];
  scoringMatches: Match[];
  playerMap: Record<string, Player>;
  playerById: Record<string, DbPlayer>;
  mePlayerId: string; // Kyle P.'s player id
}

const FMT_MAP: Record<string, 'Four-ball' | 'Foursomes' | 'Singles'> = {
  'four-ball': 'Four-ball',
  'foursomes': 'Foursomes',
  'singles': 'Singles',
};

function formatTeeTime(t: string): string {
  const [h, m] = t.split(':').map(Number);
  const ap = h >= 12 ? 'PM' : 'AM';
  return `${((h + 11) % 12) + 1}:${String(m).padStart(2, '0')} ${ap}`;
}

function formatDate(d: string): string {
  const dt = new Date(d + 'T12:00:00');
  const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `${days[dt.getDay()]} ${months[dt.getMonth()]} ${dt.getDate()}`;
}

export function useEventData() {
  const [data, setData] = useState<EventData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    await ensureAuth();
    const [
      { data: events, error: e1 },
      { data: teams, error: e2 },
      { data: players, error: e3 },
      { data: courses, error: e4 },
      { data: rounds, error: e5 },
      { data: teeGroups, error: e6 },
      { data: matches, error: e7 },
      { data: matchHoles, error: e8 },
    ] = await Promise.all([
      supabase.from('event').select('*'),
      supabase.from('team').select('*'),
      supabase.from('player').select('*'),
      supabase.from('course').select('*'),
      supabase.from('round').select('*').order('seq'),
      supabase.from('tee_group').select('*').order('seq'),
      supabase.from('match').select('*').order('seq'),
      supabase.from('match_hole').select('*'),
    ]);

    const err = e1 || e2 || e3 || e4 || e5 || e6 || e7 || e8;
    if (err) { setError(err.message); setLoading(false); return; }

    const event = events![0] as DbEvent;
    if (!event) { setError('No event found'); setLoading(false); return; }

    const teamList = teams as DbTeam[];
    const playerList = players as DbPlayer[];
    const courseList = courses as DbCourse[];
    const roundList = rounds as DbRound[];
    const tgList = teeGroups as DbTeeGroup[];
    const matchList = matches as DbMatch[];
    const holeList = matchHoles as DbMatchHole[];

    // Build player lookup by id
    const playerById: Record<string, DbPlayer> = {};
    playerList.forEach(p => { playerById[p.id] = p; });

    // Build player key (short lowercase) from name
    const playerKey = (id: string): string => {
      const p = playerById[id];
      if (!p) return id;
      return p.name.split(' ')[0].toLowerCase();
    };

    // Build player map for scoring engine
    const playerMap: Record<string, Player> = {};
    playerList.forEach(p => {
      const team = teamList.find(t => t.id === p.team_id);
      const key = playerKey(p.id);
      playerMap[key] = {
        n: p.name,
        t: team?.side || 'a',
        h: p.handicap_index,
        cap: p.is_captain || undefined,
      };
    });

    // Build courses by id
    const courseById: Record<string, DbCourse> = {};
    courseList.forEach(c => { courseById[c.id] = c; });

    // Build tee groups by round
    const tgsByRound: Record<string, DbTeeGroup[]> = {};
    tgList.forEach(tg => {
      (tgsByRound[tg.round_id] = tgsByRound[tg.round_id] || []).push(tg);
    });

    // Build scoring sessions
    const scoringSessions: Session[] = roundList.map(r => {
      const course = courseById[r.course_id];
      const tgs = (tgsByRound[r.id] || []).sort((a, b) => a.seq - b.seq);
      return {
        id: r.id,
        rd: r.label,
        day: formatDate(r.play_date),
        fmt: FMT_MAP[r.format],
        course: course?.name || '',
        holes: r.holes,
        tees: tgs.map(tg => formatTeeTime(tg.tee_time)),
        scorer: tgs.map(tg => tg.scorer_player_id ? playerKey(tg.scorer_player_id) : ''),
        state: r.locked ? 'final' : 'upcoming',
        par: course?.par || [],
        si: course?.stroke_index || null,
      };
    });

    // Build match holes lookup
    const holesByMatch: Record<string, DbMatchHole[]> = {};
    holeList.forEach(mh => {
      (holesByMatch[mh.match_id] = holesByMatch[mh.match_id] || []).push(mh);
    });

    // Build scoring matches
    const scoringMatches: Match[] = matchList.map(m => {
      const round = roundList.find(r => r.id === m.round_id)!;
      const tg = tgList.find(t => t.id === m.tee_group_id)!;
      const tgsForRound = (tgsByRound[round.id] || []).sort((a, b) => a.seq - b.seq);
      const groupIdx = tgsForRound.findIndex(t => t.id === tg.id);
      // Build holes array
      const dbHoles = holesByMatch[m.id] || [];
      const hs: HoleData[] = Array.from({ length: round.holes }, (_, i) => {
        const dbH = dbHoles.find(h => h.hole === i + 1);
        if (!dbH) return { r: null, sc: {}, d: false, by: null, at: null, pend: false };

        const sc: Record<string, number | 'X' | undefined> = {};
        if (dbH.scores && typeof dbH.scores === 'object') {
          for (const [rawKey, val] of Object.entries(dbH.scores)) {
            // Map player UUIDs to player keys, or keep 'a'/'b' for foursomes
            const key = rawKey === 'a' || rawKey === 'b' ? rawKey : playerKey(rawKey);
            sc[key] = val === 'X' ? 'X' : typeof val === 'number' ? val : undefined;
          }
        }

        return {
          r: dbH.result,
          sc,
          d: dbH.derived,
          by: dbH.entered_by ? (playerById[dbH.entered_by]?.name || null) : null,
          at: null,
          pend: false,
        };
      });

      return {
        id: m.id,
        s: round.id,
        g: groupIdx,
        a: m.side_a.map(playerKey),
        b: m.side_b.map(playerKey),
        hs,
        odds: m.odds_a && m.odds_b
          ? { a: playerById[m.odds_a]?.name || '', b: playerById[m.odds_b]?.name || '' }
          : undefined,
      };
    });

    // Find Kyle P.'s player id
    const kyle = playerList.find(p => p.name === 'Kyle P.');
    const mePlayerId = kyle?.id || '';

    // Set the scoring engine context
    setContext(playerMap, scoringSessions, scoringMatches);

    setData({
      event, teams: teamList, players: playerList, courses: courseList,
      rounds: roundList, teeGroups: tgList, matches: matchList, matchHoles: holeList,
      scoringSessions, scoringMatches, playerMap, playerById, mePlayerId,
    });
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  // Subscribe to realtime changes on match_hole
  useEffect(() => {
    const channel = supabase
      .channel('match_hole_changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'match_hole' }, () => {
        load(); // Reload all data on any change
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [load]);

  return { data, loading, error, reload: load };
}
