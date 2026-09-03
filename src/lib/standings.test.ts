import { describe, it, expect, beforeEach } from 'vitest';
import { setContext, type Player, type Session, type Match, type HoleData } from './scoring';
import { mvpBoard, mvp, roundRaces, relLabel } from './standings';

const PLAYERS: Record<string, Player> = {
  griffin: { n: 'Griffin S.', t: 'a', h: 15 },
  kyle:    { n: 'Kyle P.',    t: 'b', h: 15 },
  matt:    { n: 'Matt J.',    t: 'a', h: 15 },
  jt:      { n: 'JT W.',      t: 'b', h: 15 },
};
const PAR = Array(18).fill(4);
const ses = (id: string, fmt: Session['fmt'], state: string): Session => ({
  id, rd: id.toUpperCase(), day: 'Thu Oct 8', fmt, course: 'Mammoth Dunes', holes: 18,
  tees: ['12:00 PM'], scorer: ['griffin'], state, par: PAR, si: null,
});
const hole = (sc: Record<string, number>): HoleData =>
  ({ r: 'H', sc, d: true, by: null, at: null, pend: false });
const mk = (id: string, sid: string, a: string, b: string, hs: HoleData[]): Match =>
  ({ id, s: sid, g: 0, a: [a], b: [b], hs });

const full = (a: string, av: number, b: string, bv: number) =>
  Array.from({ length: 18 }, () => hole({ [a]: av, [b]: bv }));

describe('mvpBoard', () => {
  beforeEach(() => setContext(PLAYERS, [], []));

  it('ranks full cards by net against par and drops short cards below', () => {
    const s = ses('r1', 'Singles', 'final');
    const m1 = mk('m1', 'r1', 'griffin', 'kyle', full('griffin', 4, 'kyle', 5));
    // matt only has 9 holes on the card
    const m2 = mk('m2', 'r1', 'matt', 'jt', [
      ...Array.from({ length: 9 }, () => hole({ matt: 3, jt: 4 })),
      ...Array.from({ length: 9 }, () => hole({ jt: 4 })),
    ]);
    setContext(PLAYERS, [s], [m1, m2]);
    const board = mvpBoard([s], [m1, m2]);
    expect(board.map(r => r.name)).toEqual(['Griffin', 'JT', 'Kyle', 'Matt']);
    expect(board[0].rel).toBe(0);
    expect(board.find(r => r.name === 'Matt')!.eligible).toBe(false);
    // Matt is 9 under but ineligible — the full-card rule holds
    expect(board.find(r => r.name === 'Matt')!.rel).toBe(-9);
    expect(mvp([s], [m1, m2])!.name).toBe('Griffin');
  });

  it('ignores foursomes cards entirely', () => {
    const s = ses('r2', 'Foursomes', 'final');
    const m = mk('m1', 'r2', 'griffin', 'kyle', full('a' as never, 4, 'b' as never, 5));
    setContext(PLAYERS, [s], [m]);
    expect(mvpBoard([s], [m])).toEqual([]);
  });
});

describe('roundRaces', () => {
  it('names a winner only when the round is in the book', () => {
    const live = ses('r1', 'Singles', 'live');
    const m = mk('m1', 'r1', 'griffin', 'kyle', full('griffin', 3, 'kyle', 4));
    setContext(PLAYERS, [live], [m]);
    expect(roundRaces([live], [m])[0]).toMatchObject({ state: 'live', winner: null });

    const fin = ses('r1', 'Singles', 'final');
    setContext(PLAYERS, [fin], [m]);
    const race = roundRaces([fin], [m])[0];
    expect(race.state).toBe('final');
    expect(race.winner).toMatchObject({ name: 'Griffin', rel: -18 });
  });

  it('leaves foursomes rounds off the race list', () => {
    const s = ses('r2', 'Foursomes', 'final');
    setContext(PLAYERS, [s], []);
    expect(roundRaces([s], [])).toEqual([]);
  });
});

describe('relLabel', () => {
  it('speaks golf', () => {
    expect(relLabel(0)).toBe('E');
    expect(relLabel(3)).toBe('+3');
    expect(relLabel(-4)).toBe('−4');
  });
});
