import { describe, it, expect, beforeEach } from 'vitest';
import { setContext, type Player, type Session, type Match, type HoleData } from './scoring';
import { deriveMoments, nextUnseen, markSeen, type MomentsInput } from './moments';
import type { DbMatchHole, DbPlayer, DbTeam, ShootoutJson } from './types';

const PLAYERS: Record<string, Player> = {
  griffin: { n: 'Griffin S.', t: 'a', h: 15, cap: true },
  matt:    { n: 'Matt J.',    t: 'a', h: 15 },
  kyle:    { n: 'Kyle P.',    t: 'b', h: 15, cap: true },
  jt:      { n: 'JT W.',      t: 'b', h: 15 },
};

const TEAMS: DbTeam[] = [
  { id: 'ta', event_id: 'e', side: 'a', name: 'Vikes', short: 'VIK' },
  { id: 'tb', event_id: 'e', side: 'b', name: 'Celts', short: 'CEL' },
];
const dbP = (id: string, name: string, team: string, cap = false): DbPlayer => ({
  id, event_id: 'e', team_id: team, name, handicap_index: 15,
  is_captain: cap, is_commissioner: false, email: '', auth_uid: null,
});
const DBPLAYERS = [
  dbP('p1', 'Griffin S.', 'ta', true), dbP('p2', 'Matt J.', 'ta'),
  dbP('p3', 'Kyle P.', 'tb', true), dbP('p4', 'JT W.', 'tb'),
];

const PAR = [4, 4, 4, 4, 3, 4, 3, 3, 4, 4, 5, 4, 3, 4, 3, 4, 4, 4];
const SI = [13, 9, 1, 3, 7, 15, 17, 11, 5, 8, 2, 14, 18, 6, 16, 4, 10, 12];

const ses = (id: string, day: string, state: string, rd = 'Round 4', course = 'Sedge Valley'): Session => ({
  id, rd, day, fmt: 'Singles', course, holes: 18,
  tees: ['10:10 AM'], scorer: ['griffin'], state, par: PAR, si: SI,
});

const hole = (r: 'A' | 'B' | 'H' | null, sc: Record<string, number> = {}): HoleData =>
  ({ r, sc, d: true, by: null, at: null, pend: false });
const empty = (): HoleData => ({ r: null, sc: {}, d: false, by: null, at: null, pend: false });

function match(id: string, sid: string, a: string, b: string, results: ('A' | 'B' | 'H')[], scores: Record<string, number>[] = []): Match {
  const hs = Array.from({ length: 18 }, (_, i) =>
    i < results.length ? hole(results[i], scores[i] || {}) : empty());
  return { id, s: sid, g: 0, a: [a], b: [b], hs };
}

const T0 = Date.UTC(2026, 9, 10, 17, 0, 0);
const holesFor = (m: Match): DbMatchHole[] =>
  m.hs.map((h, i) => h.r ? ({
    match_id: m.id, hole: i + 1, result: h.r, scores: h.sc as Record<string, number>,
    derived: true, entered_by: null, updated_at: new Date(T0 + i * 15 * 60000).toISOString(),
  }) : null).filter((x): x is DbMatchHole => !!x);

const input = (sessions: Session[], matches: Match[], shootout: ShootoutJson | null = null, clinch = 5.5): MomentsInput => ({
  sessions, matches, matchHoles: matches.flatMap(holesFor),
  clinchPoints: clinch, shootout, players: DBPLAYERS, teams: TEAMS,
});

// A wins 10&8 with holes 1-10; B likewise with all 'B'
const sweep = (id: string, sid: string, a: string, b: string, w: 'A' | 'B') =>
  match(id, sid, a, b, Array(10).fill(w));
// halved match: alternate wins over 18
const level = (id: string, sid: string, a: string, b: string) =>
  match(id, sid, a, b, Array.from({ length: 18 }, (_, i) => (i % 2 ? 'A' : 'B')));

describe('deriveMoments', () => {
  beforeEach(() => {
    (globalThis as { localStorage?: Storage }).localStorage?.clear?.();
  });

  it('recaps a day only when every round is marked Complete', () => {
    const live = ses('r1', 'Thu Oct 8', 'live');
    const m = sweep('m1', 'r1', 'griffin', 'kyle', 'A');
    setContext(PLAYERS, [live], [m]);
    expect(deriveMoments(input([live], [m])).days).toEqual([]);

    const fin = ses('r1', 'Thu Oct 8', 'final');
    setContext(PLAYERS, [fin], [m]);
    const ms = deriveMoments(input([fin], [m]));
    expect(ms.days).toHaveLength(1);
    const d = ms.days[0];
    expect(d.key).toBe('day:Thu Oct 8');
    expect(d.dow).toBe('Thursday');
    expect(d.headline).toBe('Vikes take the opening day');
    expect(d.pts).toEqual({ a: 1, b: 0 });
    expect(d.rows[0].label).toBe('VIK 10 & 8');
  });

  it('points a finished day at the next morning', () => {
    const thu = ses('r1', 'Thu Oct 8', 'final', 'Round 1', 'Mammoth Dunes');
    const fri = ses('r2', 'Fri Oct 9', 'upcoming', 'Round 2', 'The Commons');
    const m = sweep('m1', 'r1', 'griffin', 'kyle', 'A');
    setContext(PLAYERS, [thu, fri], [m]);
    const [d] = deriveMoments(input([thu, fri], [m])).days;
    expect(d.next?.course).toBe('The Commons');
    expect(d.next?.rd).toBe('Round 2');
  });

  it('declares the cup won at the clinch, with the closing match named', () => {
    const s = ses('r1', 'Sat Oct 10', 'live');
    const ms6 = ['m1', 'm2', 'm3', 'm4', 'm5', 'm6'].map((id, i) =>
      sweep(id, 'r1', i % 2 ? 'matt' : 'griffin', i % 2 ? 'jt' : 'kyle', 'A'));
    setContext(PLAYERS, [s], ms6);
    const out = deriveMoments(input([s], ms6));
    expect(out.won?.winner).toBe('a');
    expect(out.won?.viaShootout).toBe(false);
    expect(out.won?.how).toContain('Clinched when');
    expect(out.won?.roster).toBe('Griffin and Matt');
    expect(out.duelPending).toBe(false);
  });

  it('goes to the shootout at a level finish, and stays pending until scores land', () => {
    const s = ses('r1', 'Sat Oct 10', 'final');
    const ms = [sweep('m1', 'r1', 'griffin', 'kyle', 'A'), sweep('m2', 'r1', 'matt', 'jt', 'B')];
    setContext(PLAYERS, [s], ms);

    const pending = deriveMoments(input([s], ms));
    expect(pending.tie).toEqual({ a: 1, b: 1 });
    expect(pending.duelPending).toBe(true);
    expect(pending.won).toBeNull();
    expect(pending.captains).toEqual({ a: 'Griffin', b: 'Kyle' });

    const done = deriveMoments(input([s], ms, { a: [3, 2, 2], b: [3, 3, 2], done: true }));
    expect(done.duelPending).toBe(false);
    expect(done.won?.winner).toBe('a');
    expect(done.won?.viaShootout).toBe(true);
    expect(done.won?.how).toContain('Griffin 7, Kyle 8');

    const levelPutts = deriveMoments(input([s], ms, { a: [3, 2, 2], b: [2, 3, 2], done: true }));
    expect(levelPutts.duelPending).toBe(true);
    expect(levelPutts.won).toBeNull();
  });

  it('gives the MVP to the lowest full-card net against par', () => {
    const s = ses('r1', 'Sat Oct 10', 'final');
    // 18 holes, all halved, griffin nets par everywhere, kyle one over each hole
    const scores = PAR.map(p => ({ griffin: p, kyle: p + 1 }));
    const m = match('m1', 'r1', 'griffin', 'kyle', Array(18).fill('H'), scores);
    setContext(PLAYERS, [s], [m]);
    const out = deriveMoments(input([s], [m], { a: [3, 3, 3], b: [2, 2, 2], done: true }));
    expect(out.won?.mvp?.name).toBe('Griffin');
    expect(out.won?.mvp?.line).toContain('even net');
  });

  it('auto-opens by weight and only once per device', () => {
    const s = ses('r1', 'Sat Oct 10', 'final');
    const ms = [sweep('m1', 'r1', 'griffin', 'kyle', 'A'), sweep('m2', 'r1', 'matt', 'jt', 'B')];
    setContext(PLAYERS, [s], ms);
    const state = deriveMoments(input([s], ms));
    expect(nextUnseen(state)).toBe('duel');
    markSeen('duel');
    expect(nextUnseen(state)).toBe('day:Sat Oct 10');
    markSeen('day:Sat Oct 10');
    expect(nextUnseen(state)).toBeNull();
  });
});
