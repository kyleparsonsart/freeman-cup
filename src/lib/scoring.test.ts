import { describe, it, expect, beforeEach } from 'vitest';
import {
  setContext, calc, derive, settle, strokeMap, getsStroke, holeComplete,
  runningAt, headline, roundState,
  type Player, type Session, type Match, type HoleData,
} from './scoring';

/* ---- test helpers ---- */

function mkHole(r: 'A' | 'B' | 'H' | null = null, sc: Record<string, number | 'X' | undefined> = {}, d = true): HoleData {
  return { r, sc, d, by: null, at: null, pend: false };
}

function emptyHole(): HoleData {
  return { r: null, sc: {}, d: false, by: null, at: null, pend: false };
}

const PLAYERS: Record<string, Player> = {
  griffin: { n: 'Griffin S.', t: 'a', h: 15 },
  devin:  { n: 'Devin E.',  t: 'a', h: 7 },
  brian:  { n: 'Brian K.',  t: 'a', h: 6 },
  matt:   { n: 'Matt J.',   t: 'a', h: 15 },
  kyle:   { n: 'Kyle P.',   t: 'b', h: 15 },
  phil:   { n: 'Phil J.',   t: 'b', h: 11 },
  justin: { n: 'Justin D.', t: 'b', h: 7 },
  jt:     { n: 'JT W.',     t: 'b', h: 15 },
};

/* 18-hole four-ball session */
const fourBallSession: Session = {
  id: 'r1', rd: 'Round 1', day: 'Thu Oct 8', fmt: 'Four-ball',
  course: 'Mammoth Dunes', holes: 18,
  tees: ['12:00 PM', '12:10 PM'], scorer: ['griffin', 'justin'], state: 'live',
  par: [4, 4, 5, 3, 4, 4, 5, 3, 4, 4, 5, 4, 3, 4, 5, 3, 4, 5],
  si:  [11, 9, 3, 15, 5, 13, 1, 17, 7, 12, 4, 8, 18, 14, 6, 16, 10, 2],
};

/* 12-hole foursomes session */
const foursomesSession: Session = {
  id: 'r2', rd: 'Round 2', day: 'Fri Oct 9', fmt: 'Foursomes',
  course: 'The Commons', holes: 12,
  tees: ['8:00 AM', '8:10 AM'], scorer: ['kyle', 'phil'], state: 'live',
  par: [5, 3, 4, 4, 3, 4, 4, 3, 4, 4, 3, 4],
  si:  [11, 7, 5, 3, 9, 1, 8, 12, 10, 2, 4, 6],
};

/* 18-hole singles session */
const singlesSession: Session = {
  id: 'r4', rd: 'Round 4', day: 'Sat Oct 10', fmt: 'Singles',
  course: 'Sedge Valley', holes: 18,
  tees: ['10:10 AM', '10:30 AM'], scorer: ['devin', 'phil'], state: 'upcoming',
  par: [4, 4, 4, 4, 3, 4, 3, 3, 4, 4, 5, 4, 3, 4, 3, 4, 4, 4],
  si:  [13, 9, 1, 3, 7, 15, 17, 11, 5, 8, 2, 14, 18, 6, 16, 4, 10, 12],
};

describe('calc — match scoring', () => {
  beforeEach(() => {
    setContext(PLAYERS, [fourBallSession, foursomesSession, singlesSession], []);
  });

  it('match won on the final hole reads "1 up", not "1 & 0"', () => {
    // Side A wins 10 holes, Side B wins 9 holes across all 18 = 1 up at the end
    const hs: HoleData[] = [];
    for (let i = 0; i < 18; i++) {
      if (i < 10) hs.push(mkHole('A', { griffin: 4, matt: 5, kyle: 5, jt: 6 }));
      else if (i < 18) hs.push(mkHole('B', { griffin: 5, matt: 6, kyle: 4, jt: 5 }));
      // But we need exactly A wins 10, B wins 8 → diff = 2 at end. Let me fix:
    }
    // Actually, let's be precise: A wins holes 1-10 (10 wins), B wins holes 11-18 (8 wins) → diff = 2 = "2 up"
    // For "1 up" on final hole: A wins 10, B wins 9, 1 halved
    const hs2: HoleData[] = [];
    for (let i = 0; i < 18; i++) {
      if (i < 10) hs2.push(mkHole('A', { griffin: 4, matt: 5, kyle: 5, jt: 6 }));
      else if (i < 17) hs2.push(mkHole('B', { griffin: 5, matt: 6, kyle: 4, jt: 5 }));
      else hs2.push(mkHole('B', { griffin: 5, matt: 6, kyle: 4, jt: 5 }));
    }
    // A: 10 wins, B: 8 wins → 2 up. Need A:10, B:9, H:— no, total must be 18.
    // For exactly 1 up: e.g. A wins 5, B wins 4, halved 9
    const holes: HoleData[] = Array.from({ length: 18 }, (_, i) => {
      if (i < 5) return mkHole('A', { griffin: 4, matt: 5, kyle: 5, jt: 6 });
      if (i < 9) return mkHole('B', { griffin: 5, matt: 6, kyle: 4, jt: 5 });
      return mkHole('H', { griffin: 4, matt: 5, kyle: 4, jt: 5 });
    });
    const m: Match = { id: 'm1', s: 'r1', g: 0, a: ['griffin', 'matt'], b: ['kyle', 'jt'], hs: holes };
    setContext(PLAYERS, [fourBallSession], [m]);
    const r = calc(m);
    expect(r.done).toBe(true);
    expect(r.label).toBe('1 up');
    expect(r.label).not.toContain('&');
    expect(r.w).toBe('a');
  });

  it('a match that ends 3 & 2 says exactly that', () => {
    // A leads by 3 after 16 holes → 3 & 2
    const holes: HoleData[] = Array.from({ length: 18 }, (_, i) => {
      if (i < 16) {
        if (i < 5) return mkHole('A', { griffin: 4, matt: 5, kyle: 5, jt: 6 });
        if (i < 7) return mkHole('B', { griffin: 5, matt: 6, kyle: 4, jt: 5 });
        return mkHole('H', { griffin: 4, matt: 5, kyle: 4, jt: 5 });
      }
      return emptyHole();
    });
    const m: Match = { id: 'm1', s: 'r1', g: 0, a: ['griffin', 'matt'], b: ['kyle', 'jt'], hs: holes };
    setContext(PLAYERS, [fourBallSession], [m]);
    const r = calc(m);
    expect(r.done).toBe(true);
    expect(r.label).toBe('3 & 2');
  });

  it('halved match returns 0.5 points each', () => {
    const holes: HoleData[] = Array.from({ length: 18 }, (_, i) => {
      if (i < 5) return mkHole('A', { griffin: 4, matt: 5, kyle: 5, jt: 6 });
      if (i < 10) return mkHole('B', { griffin: 5, matt: 6, kyle: 4, jt: 5 });
      return mkHole('H', { griffin: 4, matt: 5, kyle: 4, jt: 5 });
    });
    const m: Match = { id: 'm1', s: 'r1', g: 0, a: ['griffin', 'matt'], b: ['kyle', 'jt'], hs: holes };
    setContext(PLAYERS, [fourBallSession], [m]);
    const r = calc(m);
    expect(r.done).toBe(true);
    expect(r.label).toBe('Halved');
    expect(r.pts).toEqual({ a: 0.5, b: 0.5 });
  });
});

describe('holeComplete — result requires all scores', () => {
  beforeEach(() => {
    setContext(PLAYERS, [fourBallSession, foursomesSession, singlesSession], []);
  });

  it('hole result only exists once every player in the match has a score (four-ball)', () => {
    const hole = emptyHole();
    hole.sc = { griffin: 4, matt: 5, kyle: 5 }; // missing jt
    const m: Match = { id: 'm1', s: 'r1', g: 0, a: ['griffin', 'matt'], b: ['kyle', 'jt'],
      hs: [hole, ...Array.from({ length: 17 }, emptyHole)] };
    setContext(PLAYERS, [fourBallSession], [m]);

    expect(holeComplete(m, 0)).toBe(false);
    settle(m, 0);
    expect(m.hs[0].r).toBeNull(); // no result yet

    // Now add the missing score
    hole.sc.jt = 6;
    settle(m, 0);
    expect(holeComplete(m, 0)).toBe(true);
    expect(m.hs[0].r).not.toBeNull();
  });
});

describe('bye holes — holes after match closes', () => {
  beforeEach(() => {
    setContext(PLAYERS, [fourBallSession], []);
  });

  it('holes played after a match closes are recorded but do not count', () => {
    // A wins every hole. After hole 11: A=11, B=0, left=7, 11>7 → closed 11 & 7.
    // Holes 12-18 still have B results (bye holes) but calc stops at the closure.
    const holes: HoleData[] = Array.from({ length: 18 }, (_, i) => {
      if (i < 11) return mkHole('A', { griffin: 3, matt: 4, kyle: 5, jt: 6 });
      return mkHole('B', { griffin: 6, matt: 7, kyle: 3, jt: 4 });
    });
    const m: Match = { id: 'm1', s: 'r1', g: 0, a: ['griffin', 'matt'], b: ['kyle', 'jt'], hs: holes };
    setContext(PLAYERS, [fourBallSession], [m]);

    const r = calc(m);
    expect(r.done).toBe(true);
    expect(r.w).toBe('a');
    expect(r.label).toBe('10 & 8');
    expect(r.played).toBe(10);
    expect(r.pts).toEqual({ a: 1, b: 0 });
    expect(r.byeStart).toBe(10);
  });
});

describe('format-specific scoring keys', () => {
  it('foursomes keys scores by side (a/b), not by player', () => {
    const holes: HoleData[] = Array.from({ length: 12 }, () =>
      mkHole('H', { a: 4, b: 4 })
    );
    const m: Match = {
      id: 'm3', s: 'r2', g: 0,
      a: ['griffin', 'brian'], b: ['kyle', 'justin'],
      hs: holes,
    };
    setContext(PLAYERS, [foursomesSession], [m]);

    // In foursomes, scores are keyed by 'a' and 'b', not by player ids
    expect(holeComplete(m, 0)).toBe(true);

    // If we try to key by player, it would fail
    const badHole = mkHole(null, { griffin: 4, brian: 5, kyle: 4, justin: 5 });
    const m2: Match = {
      id: 'm3b', s: 'r2', g: 0,
      a: ['griffin', 'brian'], b: ['kyle', 'justin'],
      hs: [badHole, ...Array.from({ length: 11 }, emptyHole)],
    };
    setContext(PLAYERS, [foursomesSession], [m2]);
    // holeComplete checks for keys 'a' and 'b', not player IDs
    expect(holeComplete(m2, 0)).toBe(false);
  });

  it('four-ball keys scores by player', () => {
    const hole = mkHole(null, { griffin: 4, matt: 5, kyle: 4, jt: 5 });
    const m: Match = {
      id: 'm1', s: 'r1', g: 0,
      a: ['griffin', 'matt'], b: ['kyle', 'jt'],
      hs: [hole, ...Array.from({ length: 17 }, emptyHole)],
    };
    setContext(PLAYERS, [fourBallSession], [m]);
    expect(holeComplete(m, 0)).toBe(true);
  });

  it('singles keys scores by player', () => {
    const hole = mkHole(null, { griffin: 4, kyle: 5 });
    const m: Match = {
      id: 'm7', s: 'r4', g: 0,
      a: ['griffin'], b: ['kyle'],
      hs: [hole, ...Array.from({ length: 17 }, emptyHole)],
    };
    setContext(PLAYERS, [singlesSession], [m]);
    expect(holeComplete(m, 0)).toBe(true);
  });
});

describe('strokeMap — stroke allocation follows SI, hardest first', () => {
  it('strokes land on the holes with the lowest stroke index numbers', () => {
    // In singles, griffin (h:15) vs brian (h:6). Brian is lowest → scratch.
    // Griffin gets pr(15-6) = pr(9) = 9 strokes (100%, 18/18).
    // Those 9 strokes should land on SI 1..9.
    const sess: Session = { ...singlesSession, id: 'test_si' };
    const m: Match = {
      id: 'mtest', s: 'test_si', g: 0,
      a: ['griffin'], b: ['brian'],
      hs: Array.from({ length: 18 }, emptyHole),
    };
    setContext(PLAYERS, [sess], [m]);

    const sm = strokeMap(m);
    expect(sm.griffin).toBe(9);
    expect(sm.brian).toBe(0);

    // Verify strokes land on the 9 hardest holes (SI 1-9)
    const strokeHoles: number[] = [];
    for (let i = 0; i < 18; i++) {
      if (getsStroke(m, 'griffin', i)) strokeHoles.push(i);
    }
    expect(strokeHoles.length).toBe(9);

    // Each stroke hole should have SI <= 9
    for (const h of strokeHoles) {
      expect(sess.si![h]).toBeLessThanOrEqual(9);
    }

    // Each non-stroke hole should have SI > 9
    for (let i = 0; i < 18; i++) {
      if (!strokeHoles.includes(i)) {
        expect(sess.si![i]).toBeGreaterThan(9);
      }
    }
  });

  it('foursomes uses combined handicap difference at 50%', () => {
    // a: griffin(15) + brian(6) = 21
    // b: kyle(15) + justin(7) = 22
    // diff = 1, 50% = 0.5, round = 1, prorate for 12 holes = round(1 * 12/18) = round(0.667) = 1
    const m: Match = {
      id: 'mfs', s: 'r2', g: 0,
      a: ['griffin', 'brian'], b: ['kyle', 'justin'],
      hs: Array.from({ length: 12 }, emptyHole),
    };
    setContext(PLAYERS, [foursomesSession], [m]);

    const sm = strokeMap(m);
    // b side has higher combined (22 vs 21), so b gets strokes
    // pr(1) = Math.round(1 * 0.5 * (12/18)) = Math.round(0.333) = 0
    expect(sm.a).toBe(0);
    expect(sm.b).toBe(0); // rounds down — difference too small at 50% prorated
  });

  it('prorate reduces strokes for short rounds', () => {
    // In a 12-hole foursomes round with a bigger difference:
    // a: devin(7) + matt(15) = 22
    // b: phil(11) + jt(15) = 26
    // diff = 4, pr(4) = Math.round(4 * 0.5 * 12/18) = Math.round(1.333) = 1
    const m: Match = {
      id: 'mfs2', s: 'r2', g: 0,
      a: ['devin', 'matt'], b: ['phil', 'jt'],
      hs: Array.from({ length: 12 }, emptyHole),
    };
    setContext(PLAYERS, [foursomesSession], [m]);

    const sm = strokeMap(m);
    // b has 26, a has 22. b > a, so b gets strokes.
    // pr(26-22) = pr(4) = round(4 * 0.5 * 12/18) = round(1.333) = 1
    expect(sm.a).toBe(0);
    expect(sm.b).toBe(1);
  });
});

describe('derive — result derivation', () => {
  beforeEach(() => {
    setContext(PLAYERS, [fourBallSession], []);
  });

  it('when both sides pick up, no result', () => {
    const hole = mkHole(null, { griffin: 'X', matt: 'X', kyle: 'X', jt: 'X' });
    const m: Match = {
      id: 'm1', s: 'r1', g: 0,
      a: ['griffin', 'matt'], b: ['kyle', 'jt'],
      hs: [hole, ...Array.from({ length: 17 }, emptyHole)],
    };
    setContext(PLAYERS, [fourBallSession], [m]);

    const d = derive(m, 0);
    expect(d.r).toBeNull();
  });

  it('when one side picks up, other side wins', () => {
    const hole = mkHole(null, { griffin: 'X', matt: 'X', kyle: 4, jt: 5 });
    const m: Match = {
      id: 'm1', s: 'r1', g: 0,
      a: ['griffin', 'matt'], b: ['kyle', 'jt'],
      hs: [hole, ...Array.from({ length: 17 }, emptyHole)],
    };
    setContext(PLAYERS, [fourBallSession], [m]);

    const d = derive(m, 0);
    expect(d.r).toBe('B');
  });

  it('lower net score wins the hole', () => {
    // Par 4, both same handicap so no strokes
    // griffin: 4, matt: 5 → best A net = 4
    // kyle: 5, jt: 6 → best B net = 5
    // A wins
    const hole = mkHole(null, { griffin: 4, matt: 5, kyle: 5, jt: 6 });
    const m: Match = {
      id: 'm1', s: 'r1', g: 0,
      a: ['griffin', 'matt'], b: ['kyle', 'jt'],
      hs: [hole, ...Array.from({ length: 17 }, emptyHole)],
    };
    setContext(PLAYERS, [fourBallSession], [m], {
      hcp: { on: false, fourball: 100, foursomes: 50, aggregate: 100, singles: 100, prorate: true },
    });

    const d = derive(m, 0);
    expect(d.r).toBe('A');
  });

  it('equal net scores halve the hole', () => {
    const hole = mkHole(null, { griffin: 4, matt: 5, kyle: 4, jt: 5 });
    const m: Match = {
      id: 'm1', s: 'r1', g: 0,
      a: ['griffin', 'matt'], b: ['kyle', 'jt'],
      hs: [hole, ...Array.from({ length: 17 }, emptyHole)],
    };
    setContext(PLAYERS, [fourBallSession], [m], {
      hcp: { on: false, fourball: 100, foursomes: 50, aggregate: 100, singles: 100, prorate: true },
    });

    const d = derive(m, 0);
    expect(d.r).toBe('H');
  });
});

describe('runningAt', () => {
  it('reports correct running score', () => {
    const holes: HoleData[] = [
      mkHole('A'), mkHole('B'), mkHole('A'), mkHole('A'),
      ...Array.from({ length: 14 }, emptyHole),
    ];
    const m: Match = { id: 'm1', s: 'r1', g: 0, a: ['griffin', 'matt'], b: ['kyle', 'jt'], hs: holes };
    setContext(PLAYERS, [fourBallSession], [m]);

    expect(runningAt(m, 0)).toBe('1 up VIK');
    expect(runningAt(m, 1)).toBe('All square');
    expect(runningAt(m, 2)).toBe('1 up VIK');
    expect(runningAt(m, 3)).toBe('2 up VIK');
  });
});

describe('headline', () => {
  it('not started shows Not started', () => {
    const m: Match = {
      id: 'm1', s: 'r1', g: 0, a: ['griffin', 'matt'], b: ['kyle', 'jt'],
      hs: Array.from({ length: 18 }, emptyHole),
    };
    setContext(PLAYERS, [fourBallSession], [m]);

    const h = headline(m);
    expect(h.txt).toBe('Not started');
  });

  it('halved match headline', () => {
    const holes: HoleData[] = Array.from({ length: 18 }, (_, i) => {
      if (i < 5) return mkHole('A');
      if (i < 10) return mkHole('B');
      return mkHole('H');
    });
    const m: Match = { id: 'm1', s: 'r1', g: 0, a: ['griffin', 'matt'], b: ['kyle', 'jt'], hs: holes };
    setContext(PLAYERS, [fourBallSession], [m]);

    expect(headline(m).txt).toBe('Match halved');
  });
});

describe('roundState', () => {
  it('final when all matches done', () => {
    const holes: HoleData[] = Array.from({ length: 18 }, () => mkHole('A'));
    const m: Match = { id: 'm1', s: 'r1', g: 0, a: ['griffin', 'matt'], b: ['kyle', 'jt'], hs: holes };
    setContext(PLAYERS, [fourBallSession], [m]);

    expect(roundState(fourBallSession)).toBe('final');
  });

  it('live when any hole is posted', () => {
    const holes: HoleData[] = [mkHole('A'), ...Array.from({ length: 17 }, emptyHole)];
    const m: Match = { id: 'm1', s: 'r1', g: 0, a: ['griffin', 'matt'], b: ['kyle', 'jt'], hs: holes };
    setContext(PLAYERS, [fourBallSession], [m]);

    expect(roundState(fourBallSession)).toBe('live');
  });

  it('upcoming when no holes posted', () => {
    const m: Match = {
      id: 'm1', s: 'r1', g: 0, a: ['griffin', 'matt'], b: ['kyle', 'jt'],
      hs: Array.from({ length: 18 }, emptyHole),
    };
    setContext(PLAYERS, [{ ...fourBallSession, state: 'upcoming' }], [m]);

    expect(roundState({ ...fourBallSession, state: 'upcoming' })).toBe('upcoming');
  });
});

/* ---- Aggregate match play (Round 2, The Commons — decided Sep 3) ---- */

describe('derive — aggregate match play', () => {
  // 12-hole aggregate session on the same card as the old foursomes round
  const aggSession: Session = {
    id: 'r2a', rd: 'Round 2', day: 'Fri Oct 9', fmt: 'Aggregate',
    course: 'The Commons', holes: 12,
    tees: ['8:00 AM', '8:10 AM'], scorer: ['kyle', 'phil'], state: 'live',
    par: [5, 3, 4, 4, 3, 4, 4, 3, 4, 4, 3, 4],
    si:  [11, 7, 5, 3, 9, 1, 8, 12, 10, 2, 4, 6],
  };
  const aggMatch = (hs: HoleData[]): Match =>
    ({ id: 'am1', s: 'r2a', g: 0, a: ['griffin', 'devin'], b: ['kyle', 'phil'], hs });

  beforeEach(() => {
    // restore handicap config: earlier tests switch hcp off via setContext
    setContext(PLAYERS, [aggSession], [], {
      hcp: { on: true, fourball: 100, foursomes: 50, aggregate: 100, singles: 100, prorate: true },
    });
  });

  it('sums both partners and gives the hole to the lower total', () => {
    // hole 1 (par 5, SI 11): no strokes land at SI 11 for these indexes
    const m = aggMatch([mkHole(null, { griffin: 4, devin: 5, kyle: 5, phil: 5 })]);
    setContext(PLAYERS, [aggSession], [m]);
    const d = derive(m, 0);
    expect(d.r).toBe('A');
    expect(d.why).toContain('Vikes 4 + 5');
    expect(d.why).toContain('beats Celts 5 + 5');
  });

  it('applies handicap strokes inside the sum, prorated to 12 holes', () => {
    // Low man is brian?, no — in this match: griffin 15, devin 7, kyle 15, phil 11; low = devin 7.
    // 100% differences: griffin 8, kyle 8, phil 4, prorated ×12/18 → griffin 5.33→5, kyle 5, phil 2.67→3.
    const sm = strokeMap(aggMatch([]));
    expect(sm.devin).toBe(0);
    expect(sm.griffin).toBe(5);
    expect(sm.kyle).toBe(5);
    expect(sm.phil).toBe(3);

    // hole 6 is SI 1: griffin, kyle and phil all get a shot there
    const hs = [...Array(5)].map(() => emptyHole());
    const m = aggMatch([...hs, mkHole(null, { griffin: 5, devin: 4, kyle: 5, phil: 4 })]);
    setContext(PLAYERS, [aggSession], [m]);
    const d = derive(m, 5);
    // Vikes 5+4 less 1 = 8; Celts 5+4 less 2 = 7 — strokes decide it
    expect(d.r).toBe('B');
    expect(d.why).toContain('Celts 5 + 4 less 2 = 7');
    expect(d.why).toContain('Vikes 5 + 4 less 1 = 8');
  });

  it('halves a tied total and shows both sums', () => {
    const m = aggMatch([mkHole(null, { griffin: 4, devin: 5, kyle: 5, phil: 4 })]);
    setContext(PLAYERS, [aggSession], [m]);
    const d = derive(m, 0);
    expect(d.r).toBe('H');
    expect(d.why).toContain('Halved');
  });

  it('has no result until all four scores are in', () => {
    const m = aggMatch([mkHole(null, { griffin: 4, devin: 5, kyle: 5 })]);
    setContext(PLAYERS, [aggSession], [m]);
    expect(holeComplete(m, 0)).toBe(false);
    settle(m, 0);
    expect(m.hs[0].r).toBeNull();
  });

  it('scores the match like any other once holes settle', () => {
    const win = mkHole('A', {}), half = mkHole('H', {});
    const m = aggMatch([win, win, half, win, win, win, win, win]);
    setContext(PLAYERS, [aggSession], [m]);
    const r = calc(m);
    // 6 up after 7 with 5 left: the match closes itself 6 & 5
    expect(r.done).toBe(true);
    expect(r.label).toBe('6 & 5');
  });
});
