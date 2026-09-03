import { describe, it, expect, beforeEach } from 'vitest';
import { setContext, type Player, type Session, type Match, type HoleData } from './scoring';
import { deskFor, quietMins } from './desk';
import type { DbMatch, DbMatchHole, DbRound, DbTeeGroup } from './types';

const PLAYERS: Record<string, Player> = {
  griffin: { n: 'Griffin S.', t: 'a', h: 15 },
  kyle:    { n: 'Kyle P.',    t: 'b', h: 15 },
};
const ses = (state: string): Session => ({
  id: 'r1', rd: 'Round 1', day: 'Thu Oct 8', fmt: 'Singles',
  course: 'Mammoth Dunes', holes: 18, tees: ['12:00 PM'], scorer: ['griffin'],
  state, par: Array(18).fill(4), si: null,
});
const round = (state: DbRound['state']): DbRound => ({
  id: 'r1', event_id: 'e', seq: 1, label: 'Round 1', play_date: '2026-10-08',
  format: 'singles', course_id: 'c', holes: 18, locked: state === 'final', state,
});
const tg = (submitted = false): DbTeeGroup => ({
  id: 'tg1', round_id: 'r1', seq: 1, tee_time: '12:00',
  scorer_player_id: submitted ? 'p1' : null,
  submitted_at: submitted ? '2026-10-08T20:00:00Z' : null,
});
const dbm: DbMatch = {
  id: 'm1', round_id: 'r1', tee_group_id: 'tg1', seq: 1,
  side_a: ['p1'], side_b: ['p2'], odds_a: null, odds_b: null,
};
const hole = (r: 'A' | 'B' | 'H'): HoleData => ({ r, sc: {}, d: true, by: null, at: null, pend: false });
const empty = (): HoleData => ({ r: null, sc: {}, d: false, by: null, at: null, pend: false });
const match = (n: number): Match => ({
  id: 'm1', s: 'r1', g: 0, a: ['griffin'], b: ['kyle'],
  hs: [...Array.from({ length: n }, () => hole('A')), ...Array.from({ length: 18 - n }, empty)],
});
const mh = (holeN: number, at: string): DbMatchHole => ({
  match_id: 'm1', hole: holeN, result: 'A', scores: {}, derived: true, entered_by: null, updated_at: at,
});

describe('deskFor', () => {
  beforeEach(() => setContext(PLAYERS, [ses('upcoming')], []));

  it('reports readiness before the round goes live', () => {
    const m = match(0);
    setContext(PLAYERS, [ses('upcoming')], [m]);
    const d = deskFor({
      rounds: [round('upcoming')], scoringSessions: [ses('upcoming')], scoringMatches: [m],
      matches: [dbm], teeGroups: [tg()], matchHoles: [],
    })!;
    expect(d.state).toBe('upcoming');
    expect(d.pairingsSet).toBe(1);
    expect(d.scorersSet).toBe(0);   // nobody named yet
    expect(d.cardsIn).toBe(0);
  });

  it('tracks progress, freshness and open holes while live', () => {
    const m = match(8);
    setContext(PLAYERS, [ses('live')], [m]);
    const d = deskFor({
      rounds: [round('live')], scoringSessions: [ses('live')], scoringMatches: [m],
      matches: [dbm], teeGroups: [tg(true)], matchHoles: [mh(8, '2026-10-08T15:41:00Z')],
    })!;
    expect(d.state).toBe('live');
    expect(d.groups[0].thru).toBe(8);
    expect(d.groups[0].lastAt).toBe(new Date('2026-10-08T15:41:00Z').getTime());
    expect(d.groups[0].open).toBe(10);
    expect(d.openHoles).toBe(10);
    expect(d.cardsIn).toBe(1);
  });

  it('watches the next round once today is in the book', () => {
    const m = match(18);
    const fin = ses('final');
    const next: Session = { ...ses('upcoming'), id: 'r2', rd: 'Round 2' };
    setContext(PLAYERS, [fin, next], [m]);
    const d = deskFor({
      rounds: [round('final'), { ...round('upcoming'), id: 'r2', label: 'Round 2', seq: 2 }],
      scoringSessions: [fin, next], scoringMatches: [m],
      matches: [], teeGroups: [], matchHoles: [],
    })!;
    expect(d.round.id).toBe('r2');
    expect(d.state).toBe('upcoming');
  });
});

describe('quietMins', () => {
  it('rounds to minutes and handles silence', () => {
    const now = Date.UTC(2026, 9, 8, 16, 20);
    expect(quietMins(Date.UTC(2026, 9, 8, 15, 41), now)).toBe(39);
    expect(quietMins(null)).toBeNull();
  });
});
