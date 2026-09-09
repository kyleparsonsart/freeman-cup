import { describe, it, expect, beforeAll } from 'vitest';
import { setContext, type Match, type Session, type HoleData } from './scoring';
import { holePoints, mvpBoard, roundRaces, POINTS } from './standings';

// Griffin 15 and Matt 15 (Vikes), Kyle 15 and Justin 7 (Celts): the three
// 15s get a stroke on the eight hardest holes.
const P = {
  griffin: { n: 'Griffin', t: 'a' as const, h: 15 }, matt: { n: 'Matt', t: 'a' as const, h: 15 },
  kyle: { n: 'Kyle', t: 'b' as const, h: 15 }, justin: { n: 'Justin', t: 'b' as const, h: 7 },
};
const par = [4, 3, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4];
const si = [5, 18, 1, 2, 3, 4, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17]; // hole 1 gets a stroke, hole 2 does not
const S: Session[] = [
  { id: 'fb', rd: 'Round 1', day: 'Thu Oct 8', fmt: 'Four-ball', course: 'Mammoth Dunes', holes: 18, tees: ['12:00'], scorer: [], state: 'final', par, si },
  { id: 'ag', rd: 'Round 2', day: 'Fri Oct 9', fmt: 'Aggregate', course: 'The Commons', holes: 12, tees: ['8:00'], scorer: [], state: 'final', par: par.slice(0, 12), si: si.slice(0, 12) },
  { id: 'sg', rd: 'Round 4', day: 'Sat Oct 10', fmt: 'Singles', course: 'Sedge Valley', holes: 18, tees: ['10:10'], scorer: [], state: 'final', par, si },
];

const hole = (sc: Record<string, number | 'X'>): HoleData => ({ r: null, sc, d: true, by: null, at: null });
const empty = (): HoleData => ({ r: null, sc: {}, d: false, by: null, at: null });
const mk = (id: string, s: string, a: string[], b: string[], hs: HoleData[], N = 18): Match =>
  ({ id, s, g: 0, a, b, hs: [...hs, ...Array.from({ length: N - hs.length }, empty)] });

const fb = mk('fb1', 'fb', ['griffin', 'matt'], ['kyle', 'justin'], [
  hole({ griffin: 4, matt: 6, justin: 4, kyle: 5 }),   // 1: Griffin net 3 alone beats net 4 → solo
  hole({ griffin: 3, matt: 3, justin: 4, kyle: 4 }),   // 2 (no strokes): both Vikes 3 → team win
  hole({ griffin: 4, matt: 5, justin: 3, kyle: 4 }),   // 3: stroke hole; Griffin net 3, Justin 3 → halved
  hole({ griffin: 'X', matt: 5, justin: 5, kyle: 6 }), // 4: Griffin picks up; Matt net 4 beats net 4? Justin 5 (no stroke) vs Kyle net 5 → Matt solo
  hole({ griffin: 5, matt: 5, justin: 4, kyle: 5 }),   // 5: Vikes net 4 & 4, Justin 4 gross (no stroke), Kyle net 4 → halved
]);
const ag = mk('ag1', 'ag', ['griffin', 'matt'], ['kyle', 'justin'], [
  hole({ griffin: 5, matt: 5, justin: 4, kyle: 6 }),   // 1: Vikes 4+4=8 beats 4+5=9 → team
  hole({ griffin: 4, matt: 4, justin: 4, kyle: 4 }),   // 2: 8 v 8 → halved
], 12);
const sg = mk('sg1', 'sg', ['griffin'], ['kyle'], [
  hole({ griffin: 4, kyle: 5 }),                       // 1: both stroke; Griffin wins → solo
  hole({ griffin: 3, kyle: 3 }),                       // 2: halved
]);

beforeAll(() => setContext(P, S, [fb, ag, sg]));

describe('hole points', () => {
  it('scores solo, team, halved (nothing) and pick-ups at four-ball', () => {
    expect(holePoints(fb, S[0], 0)).toEqual({ griffin: 2, matt: 0, kyle: 0, justin: 0 });
    expect(holePoints(fb, S[0], 1)).toEqual({ griffin: 1, matt: 1, kyle: 0, justin: 0 });
    expect(holePoints(fb, S[0], 2)).toEqual({ griffin: 0, matt: 0, kyle: 0, justin: 0 });
    expect(holePoints(fb, S[0], 3)).toEqual({ griffin: 0, matt: 2, kyle: 0, justin: 0 });
    expect(holePoints(fb, S[0], 4)).toEqual({ griffin: 0, matt: 0, kyle: 0, justin: 0 });
  });
  it('is empty until the hole is fully scored', () => {
    expect(holePoints(fb, S[0], 5)).toEqual({});
  });
  it('aggregate wins are team wins', () => {
    expect(holePoints(ag, S[1], 0)).toEqual({ griffin: 1, matt: 1, kyle: 0, justin: 0 });
    expect(holePoints(ag, S[1], 1)).toEqual({ griffin: 0, matt: 0, kyle: 0, justin: 0 });
  });
  it('singles wins are always solo', () => {
    expect(holePoints(sg, S[2], 0)).toEqual({ griffin: POINTS.solo, kyle: 0 });
    expect(holePoints(sg, S[2], 1)).toEqual({ griffin: 0, kyle: 0 });
  });
});

describe('the board', () => {
  it('ranks by points, net breaking ties', () => {
    const board = mvpBoard(S, [fb, ag, sg]);
    const g = board.find(r => r.key === 'griffin')!;
    // four-ball 2+1+0+0+0 = 3, aggregate 1+0 = 1, singles 2+0 = 2; halves score nothing but are counted
    expect(g.pts).toBe(6);
    expect(g.solo).toBe(2);
    expect(g.team).toBe(2);
    expect(g.halves).toBe(4);
    const m = board.find(r => r.key === 'matt')!;
    expect(m.pts).toBe(0 + 1 + 0 + 2 + 0 + 1 + 0);
    expect(board[0].key).toBe('griffin');
  });
  it('player of the round wants a full card, then most points', () => {
    const races = roundRaces(S, [fb, ag, sg]);
    // no full 18-hole card anywhere, so nobody is player of the round yet
    expect(races.every(r => r.winner === null)).toBe(true);
  });
});
