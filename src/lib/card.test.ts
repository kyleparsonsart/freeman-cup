import { describe, it, expect, beforeEach } from 'vitest';
import { setContext, type Player, type Session, type Match, type HoleData } from './scoring';
import { openHoles, holesShort, cardComplete, byeProgress, groupMatches } from './card';

const PLAYERS: Record<string, Player> = {
  griffin: { n: 'Griffin S.', t: 'a', h: 15 },
  kyle:    { n: 'Kyle P.',    t: 'b', h: 15 },
  matt:    { n: 'Matt J.',    t: 'a', h: 15 },
  jt:      { n: 'JT W.',      t: 'b', h: 15 },
};
const s: Session = {
  id: 'r4', rd: 'Round 4', day: 'Sat Oct 10', fmt: 'Singles',
  course: 'Sedge Valley', holes: 18, tees: ['10:10 AM'], scorer: ['griffin'], state: 'live',
  par: Array(18).fill(4), si: null,
};
const hole = (r: 'A' | 'B' | 'H' | null, sc: Record<string, number> = {}): HoleData =>
  ({ r, sc, d: true, by: null, at: null, pend: false });
const empty = (): HoleData => ({ r: null, sc: {}, d: false, by: null, at: null, pend: false });

const mk = (id: string, hs: HoleData[], g = 0): Match =>
  ({ id, s: 'r4', g, a: ['griffin'], b: ['kyle'], hs });

beforeEach(() => setContext(PLAYERS, [s], []));

describe('openHoles', () => {
  it('flags a skipped hole behind the frontier, not the future', () => {
    const hs = [hole('A'), empty(), hole('B'), ...Array.from({ length: 15 }, empty)];
    const m = mk('m1', hs);
    setContext(PLAYERS, [s], [m]);
    expect(openHoles([m], 18)).toEqual([{ matchId: 'm1', hole: 1 }]);
  });

  it('counts a hole with scores but no result as the frontier itself', () => {
    const hs = [hole('A'), hole(null, { griffin: 4 }), ...Array.from({ length: 16 }, empty)];
    const m = mk('m1', hs);
    expect(openHoles([m], 18)).toEqual([{ matchId: 'm1', hole: 1 }]);
  });

  it('spans both matches of a group, oldest hole first', () => {
    const m1 = mk('m1', [hole('A'), empty(), hole('B'), ...Array.from({ length: 15 }, empty)]);
    const m2 = mk('m2', [empty(), hole('A'), ...Array.from({ length: 16 }, empty)]);
    expect(openHoles([m1, m2], 18).map(o => `${o.matchId}:${o.hole}`)).toEqual(['m2:0', 'm1:1']);
  });
});

describe('cardComplete / holesShort', () => {
  it('is whole only when every hole of every match has a result', () => {
    const full = mk('m1', Array.from({ length: 18 }, () => hole('H')));
    const short = mk('m2', [...Array.from({ length: 17 }, () => hole('A')), empty()]);
    expect(cardComplete([full], 18)).toBe(true);
    expect(cardComplete([full, short], 18)).toBe(false);
    expect(holesShort([full, short], 18)).toBe(1);
  });
});

describe('byeProgress', () => {
  it('tracks byes on a closed match and is null on a live one', () => {
    // A wins 10 straight: closed 10&8, byes are holes 11-18
    const closed = mk('m1', [
      ...Array.from({ length: 10 }, () => hole('A')),
      hole('H'), ...Array.from({ length: 7 }, empty),
    ]);
    setContext(PLAYERS, [s], [closed]);
    expect(byeProgress(closed, 18)).toEqual({ got: 1, total: 8 });
    const live = mk('m2', [hole('A'), ...Array.from({ length: 17 }, empty)]);
    expect(byeProgress(live, 18)).toBeNull();
  });
});

describe('groupMatches', () => {
  it('keeps only the tee group the scorer carries', () => {
    const a = mk('m1', Array.from({ length: 18 }, empty), 0);
    const b = mk('m2', Array.from({ length: 18 }, empty), 0);
    const c = mk('m3', Array.from({ length: 18 }, empty), 1);
    expect(groupMatches([a, b, c], 'r4', 0).map(m => m.id)).toEqual(['m1', 'm2']);
  });
});
