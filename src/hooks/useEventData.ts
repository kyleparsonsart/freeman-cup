import { useEffect, useState, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { setContext, type Session, type Match, type HoleData, type Player } from '../lib/scoring';
import { idbGet, idbPut } from '../lib/db';
import { getQueuedWrites, overlayQueue, onQueueChange } from '../lib/writeQueue';
import type {
  DbEvent, DbTeam, DbPlayer, DbCourse, DbRound, DbTeeGroup, DbMatch, DbMatchHole, DbFeedEvent,
} from '../lib/types';

/** The most recent scorer switch for a tee group (from feed_event). */
export interface Handoff {
  from: string | null; // player id
  to: string | null;
  by: string | null;
  at: string;          // ISO
}

export interface EventData {
  event: DbEvent;
  teams: DbTeam[];
  players: DbPlayer[];
  courses: DbCourse[];
  rounds: DbRound[];
  teeGroups: DbTeeGroup[];
  matches: DbMatch[];
  matchHoles: DbMatchHole[];
  /** latest scorer handoff per tee_group id */
  handoffs: Record<string, Handoff>;
  /* scoring engine shapes */
  scoringSessions: Session[];
  scoringMatches: Match[];
  playerMap: Record<string, Player>;
  playerById: Record<string, DbPlayer>;
  /* the signed-in player */
  mePlayerId: string;
  meKey: string;
  meIsCommissioner: boolean;
  /** signed in, but no player row carries this account (seat not claimable) */
  unclaimed: boolean;
  /** true when the server was unreachable and this came from the cached snapshot */
  offline: boolean;
}

/** The raw tables of one good fetch — cached in IndexedDB for offline opens. */
interface RawTables {
  event: DbEvent;
  teams: DbTeam[];
  players: DbPlayer[];
  courses: DbCourse[];
  rounds: DbRound[];
  teeGroups: DbTeeGroup[];
  matches: DbMatch[];
  matchHoles: DbMatchHole[];
  switches?: DbFeedEvent[];
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

async function fetchTables(): Promise<RawTables> {
  const [
    { data: events, error: e1 },
    { data: teams, error: e2 },
    { data: players, error: e3 },
    { data: courses, error: e4 },
    { data: rounds, error: e5 },
    { data: teeGroups, error: e6 },
    { data: matches, error: e7 },
    { data: matchHoles, error: e8 },
    { data: switches, error: e9 },
  ] = await Promise.all([
    supabase.from('event').select('*'),
    supabase.from('team').select('*'),
    supabase.from('player').select('*'),
    supabase.from('course').select('*'),
    supabase.from('round').select('*').order('seq'),
    supabase.from('tee_group').select('*').order('seq'),
    supabase.from('match').select('*').order('seq'),
    supabase.from('match_hole').select('*'),
    supabase.from('feed_event').select('*').eq('kind', 'scorer_switch').order('occurred_at', { ascending: false }),
  ]);

  const err = e1 || e2 || e3 || e4 || e5 || e6 || e7 || e8 || e9;
  if (err) throw new Error(err.message);

  const event = (events as DbEvent[])[0];
  if (!event) throw new Error('No event found');

  return {
    event,
    teams: teams as DbTeam[],
    players: players as DbPlayer[],
    courses: courses as DbCourse[],
    rounds: rounds as DbRound[],
    teeGroups: teeGroups as DbTeeGroup[],
    matches: matches as DbMatch[],
    matchHoles: matchHoles as DbMatchHole[],
    switches: switches as DbFeedEvent[],
  };
}

export function useEventData() {
  const [data, setData] = useState<EventData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    let raw: RawTables;
    let offline = false;

    // who is signed in (local read, works offline)
    const { data: { session } } = await supabase.auth.getSession();
    const uid = session?.user.id ?? null;

    try {
      raw = await fetchTables();
      // remember this fetch for offline opens; best-effort
      idbPut('snapshot', 'tables', raw).catch(() => {});
    } catch (e) {
      // server unreachable (or errored): fall back to the last good snapshot
      const snap = await idbGet<RawTables>('snapshot', 'tables').catch(() => undefined);
      if (!snap) {
        setError(e instanceof Error ? e.message : String(e));
        setLoading(false);
        return;
      }
      raw = snap;
      offline = true;
    }

    // first sign-in on this seat: bind the auth account to the player row
    // that carries this email (see claim_seat in freeman-cup-auth.sql)
    let me = uid ? raw.players.find(p => p.auth_uid === uid) : undefined;
    if (!me && uid && !offline) {
      const { data: claimedId } = await supabase.rpc('claim_seat');
      if (claimedId) {
        raw = {
          ...raw,
          players: raw.players.map(p => p.id === claimedId ? { ...p, auth_uid: uid } : p),
        };
        me = raw.players.find(p => p.id === claimedId);
        idbPut('snapshot', 'tables', raw).catch(() => {});
      }
    }

    // scores entered but not yet synced sit on top of whatever we have
    const queued = await getQueuedWrites();

    const { event } = raw;
    const teamList = raw.teams;
    const playerList = raw.players;
    const courseList = raw.courses;
    const roundList = raw.rounds;
    const tgList = raw.teeGroups;
    const matchList = raw.matches;
    const holeList = overlayQueue(raw.matchHoles, queued);

    // Latest handoff per tee group (rows arrive newest first)
    const handoffs: Record<string, Handoff> = {};
    for (const ev of raw.switches || []) {
      const tg = ev.body.tee_group_id as string | undefined;
      if (!tg || handoffs[tg]) continue;
      handoffs[tg] = {
        from: (ev.body.from as string | null) ?? null,
        to: (ev.body.to as string | null) ?? null,
        by: (ev.body.by as string | null) ?? null,
        at: ev.occurred_at,
      };
    }

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

    const mePlayerId = me?.id || '';
    const meKey = me ? playerKey(me.id) : '';
    const meIsCommissioner = me?.is_commissioner ?? false;
    const unclaimed = !!uid && !me;

    // Set the scoring engine context
    setContext(playerMap, scoringSessions, scoringMatches);

    setData({
      event, teams: teamList, players: playerList, courses: courseList,
      rounds: roundList, teeGroups: tgList, matches: matchList, matchHoles: holeList, handoffs,
      scoringSessions, scoringMatches, playerMap, playerById,
      mePlayerId, meKey, meIsCommissioner, unclaimed, offline,
    });
    setError(null);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  // Reload whenever the write queue changes (a score was entered or synced)
  useEffect(() => onQueueChange(() => { load(); }), [load]);

  // Realtime: holes, scorer changes and feed lines all reload the data
  useEffect(() => {
    const channel = supabase
      .channel('cup_changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'match_hole' }, () => { load(); })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tee_group' }, () => { load(); })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'feed_event' }, () => { load(); })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [load]);

  return { data, loading, error, reload: load };
}
