/**
 * Shapes the public_scoreboard() snapshot into the scoring engine's
 * in-memory model. Mirrors the mapping in hooks/useEventData.ts (kept
 * separate so the app stays untouched through the freeze); if the two
 * ever drift, the app's is the reference.
 */
import { setContext, type Session, type Match, type HoleData, type Player } from '../lib/scoring';
import type { DbEvent, DbTeam, DbCourse, DbRound, DbTeeGroup, DbMatch, DbMatchHole } from '../lib/types';

/** player row as the RPC exposes it: first name only, no email or auth */
export interface PubPlayer {
  id: string;
  event_id: string;
  team_id: string;
  name: string;
  handicap_index: number;
  is_captain: boolean;
}

export interface PubEvent extends DbEvent {
  previous_winner: 'a' | 'b' | null;
  previous_year: number | null;
}

export interface Snapshot {
  event: PubEvent;
  teams: DbTeam[];
  players: PubPlayer[];
  courses: DbCourse[];
  rounds: DbRound[];
  tee_groups: DbTeeGroup[];
  matches: DbMatch[];
  match_holes: DbMatchHole[];
  generated_at: string;
}

export interface Shaped {
  snap: Snapshot;
  sessions: Session[];
  matches: Match[];
  players: Record<string, Player>;
  playerById: Record<string, PubPlayer>;
  /** player id -> engine key */
  keyOf: (id: string) => string;
  /** engine key -> side */
  sideOf: (key: string) => 'a' | 'b';
  teeTimeOf: (m: Match) => string;        // '12:00:00' raw
  courseOf: (s: Session) => DbCourse | undefined;
}

const FMT_MAP: Record<string, Session['fmt']> = {
  'four-ball': 'Four-ball',
  'foursomes': 'Foursomes',
  'aggregate': 'Aggregate',
  'singles': 'Singles',
};

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export function formatDate(d: string): string {
  const dt = new Date(d + 'T12:00:00');
  return `${DAYS[dt.getDay()]} ${MONTHS[dt.getMonth()]} ${dt.getDate()}`;
}

/** '08:10:00' -> '8:10' (course-local, as entered) */
export function teeClock(t: string): string {
  const [h, m] = t.split(':').map(Number);
  return `${((h + 11) % 12) + 1}:${String(m).padStart(2, '0')}`;
}

export function teeClockAmPm(t: string): string {
  const [h] = t.split(':').map(Number);
  return `${teeClock(t)} ${h >= 12 ? 'PM' : 'AM'}`;
}

export function shape(snap: Snapshot): Shaped {
  const playerById: Record<string, PubPlayer> = {};
  snap.players.forEach(p => { playerById[p.id] = p; });
  const teamById: Record<string, DbTeam> = {};
  snap.teams.forEach(t => { teamById[t.id] = t; });

  const keyOf = (id: string): string => {
    const p = playerById[id];
    return p ? p.name.split(' ')[0].toLowerCase() : id;
  };

  const players: Record<string, Player> = {};
  snap.players.forEach(p => {
    players[keyOf(p.id)] = {
      n: p.name,
      t: teamById[p.team_id]?.side || 'a',
      h: Number(p.handicap_index),
      cap: p.is_captain || undefined,
    };
  });

  const courseById: Record<string, DbCourse> = {};
  snap.courses.forEach(c => { courseById[c.id] = c; });

  const tgsByRound: Record<string, DbTeeGroup[]> = {};
  snap.tee_groups.forEach(tg => {
    (tgsByRound[tg.round_id] = tgsByRound[tg.round_id] || []).push(tg);
  });
  Object.values(tgsByRound).forEach(l => l.sort((a, b) => a.seq - b.seq));

  const rounds = [...snap.rounds].sort((a, b) => a.seq - b.seq);
  const sessions: Session[] = rounds.map(r => {
    const course = courseById[r.course_id];
    const tgs = tgsByRound[r.id] || [];
    return {
      id: r.id,
      rd: r.label,
      day: formatDate(r.play_date),
      fmt: FMT_MAP[r.format],
      course: course?.name || '',
      holes: r.holes,
      tees: tgs.map(tg => teeClockAmPm(tg.tee_time)),
      scorer: tgs.map(() => ''),
      state: r.state ?? (r.locked ? 'final' : 'upcoming'),
      par: course?.par || [],
      si: course?.stroke_index || null,
    };
  });

  const holesByMatch: Record<string, DbMatchHole[]> = {};
  snap.match_holes.forEach(h => {
    (holesByMatch[h.match_id] = holesByMatch[h.match_id] || []).push(h);
  });

  const tgById: Record<string, DbTeeGroup> = {};
  snap.tee_groups.forEach(tg => { tgById[tg.id] = tg; });

  const matches: Match[] = [...snap.matches]
    .sort((a, b) => (tgById[a.tee_group_id]?.seq ?? 0) - (tgById[b.tee_group_id]?.seq ?? 0) || a.seq - b.seq)
    .map(m => {
      const round = rounds.find(r => r.id === m.round_id)!;
      const tgs = tgsByRound[round.id] || [];
      const g = Math.max(0, tgs.findIndex(t => t.id === m.tee_group_id));
      const dbHoles = holesByMatch[m.id] || [];
      const hs: HoleData[] = Array.from({ length: round.holes }, (_, i) => {
        const h = dbHoles.find(x => x.hole === i + 1);
        if (!h) return { r: null, sc: {}, d: false, by: null, at: null };
        const sc: HoleData['sc'] = {};
        if (h.scores && typeof h.scores === 'object') {
          for (const [k, v] of Object.entries(h.scores)) {
            const key = k === 'a' || k === 'b' ? k : keyOf(k);
            sc[key] = v === 'X' ? 'X' : typeof v === 'number' ? v : undefined;
          }
        }
        return { r: h.result, sc, d: h.derived, by: null, at: h.updated_at };
      });
      return { id: m.id, s: round.id, g, a: m.side_a.map(keyOf), b: m.side_b.map(keyOf), hs };
    });

  setContext(players, sessions, matches, {
    teams: {
      a: { name: snap.teams.find(t => t.side === 'a')?.name || 'Vikes', short: snap.teams.find(t => t.side === 'a')?.short || 'VIK' },
      b: { name: snap.teams.find(t => t.side === 'b')?.name || 'Celts', short: snap.teams.find(t => t.side === 'b')?.short || 'CEL' },
    },
    trophy: snap.event.trophy,
  });

  const matchRow: Record<string, DbMatch> = {};
  snap.matches.forEach(m => { matchRow[m.id] = m; });

  return {
    snap, sessions, matches, players, playerById, keyOf,
    sideOf: k => players[k]?.t || 'a',
    teeTimeOf: m => tgById[matchRow[m.id]?.tee_group_id]?.tee_time || '00:00:00',
    courseOf: s => snap.courses.find(c => c.name === s.course),
  };
}
