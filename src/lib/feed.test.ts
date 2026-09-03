import { describe, it, expect, beforeEach } from 'vitest';
import { setContext, type Player, type Session, type Match, type HoleData } from './scoring';
import { buildFeed } from './feed';
import type { DbMatchHole, DbFeedEvent } from './types';

const PLAYERS: Record<string, Player> = {
  griffin: { n: 'Griffin S.', t: 'a', h: 15 },
  matt:    { n: 'Matt J.',    t: 'a', h: 15 },
  kyle:    { n: 'Kyle P.',    t: 'b', h: 15 },
  jt:      { n: 'JT W.',      t: 'b', h: 15 },
};

const singles: Session = {
  id: 'r4', rd: 'Round 4', day: 'Sat Oct 10', fmt: 'Singles',
  course: 'Sedge Valley', holes: 18,
  tees: ['10:10 AM', '10:30 AM'], scorer: ['griffin', 'kyle'], state: 'live',
  par: [4, 4, 4, 4, 3, 4, 3, 3, 4, 4, 5, 4, 3, 4, 3, 4, 4, 4],
  si:  [13, 9, 1, 3, 7, 15, 17, 11, 5, 8, 2, 14, 18, 6, 16, 4, 10, 12],
};

const hole = (r: 'A' | 'B' | 'H' | null, sc: Record<string, number> = {}): HoleData =>
  ({ r, sc, d: true, by: null, at: null, pend: false });
const empty = (): HoleData => ({ r: null, sc: {}, d: false, by: null, at: null, pend: false });

/** A singles match with the given results from hole 1, padded to 18. */
function match(id: string, a: string, b: string, results: ('A' | 'B' | 'H')[], scores: Record<string, number>[] = []): Match {
  const hs = Array.from({ length: 18 }, (_, i) =>
    i < results.length ? hole(results[i], scores[i] || {}) : empty());
  return { id, s: 'r4', g: 0, a: [a], b: [b], hs };
}

const T0 = Date.UTC(2026, 9, 10, 17, 0, 0); // 10 Oct 2026 10:00 PT-ish
const holesFor = (m: Match): DbMatchHole[] =>
  m.hs.map((h, i) => h.r ? ({
    match_id: m.id, hole: i + 1, result: h.r, scores: h.sc as Record<string, number>,
    derived: true, entered_by: null, updated_at: new Date(T0 + i * 15 * 60000).toISOString(),
  }) : null).filter((x): x is DbMatchHole => !!x);

const base = (matches: Match[], switches: DbFeedEvent[] = []) => ({
  sessions: [singles], matches,
  matchHoles: matches.flatMap(holesFor),
  switches, playerById: {}, clinchPoints: 5.5,
});

describe('buildFeed', () => {
  beforeEach(() => setContext(PLAYERS, [singles], []));

  it('is empty before anyone has scored', () => {
    const m = match('m1', 'griffin', 'kyle', []);
    setContext(PLAYERS, [singles], [m]);
    expect(buildFeed(base([m]))).toEqual([]);
  });

  it('opens with the round under way and lists holes won, newest first', () => {
    const m = match('m1', 'griffin', 'kyle', ['A', 'H', 'B'], [{ griffin: 3, kyle: 4 }, {}, { griffin: 5, kyle: 4 }]);
    setContext(PLAYERS, [singles], [m]);
    const [day] = buildFeed(base([m]));
    expect(day.day).toBe('Sat Oct 10');
    const keys = day.items.map(i => i.key);
    expect(keys[0]).toBe('h:m1:2');          // hole 3 won, newest
    expect(keys[keys.length - 1]).toBe('open'); // cup under way, oldest
    const h1 = day.items.find(i => i.key === 'h:m1:0')!;
    expect(h1.who).toEqual({ side: 'a', name: 'Griffin' });
    expect(h1.tag).toBe('Birdie');           // 3 on a par 4
    expect(h1.text).toContain('won 1 with a birdie');
  });

  it('uses the real updated_at as the timestamp', () => {
    const m = match('m1', 'griffin', 'kyle', ['A']);
    setContext(PLAYERS, [singles], [m]);
    const [day] = buildFeed(base([m]));
    expect(day.items.find(i => i.key === 'h:m1:0')!.at).toBe(T0);
  });

  it('flags dormie and the match final', () => {
    // A wins holes 1-10: 10 up with 8 to play -> match over 10&8; dormie fires at 9 up w/ 9 left
    const m = match('m1', 'griffin', 'kyle', Array(10).fill('A'));
    setContext(PLAYERS, [singles], [m]);
    const [day] = buildFeed(base([m]));
    expect(day.items.some(i => i.tag === 'Dormie')).toBe(true);
    const fin = day.items.find(i => i.key === 'f:m1')!;
    expect(fin.big).toBe(true);
    expect(fin.side).toBe('a win');
    expect(fin.hl).toContain('Griffin win');
  });

  it('reports a lead change when the first match lands, not again while the lead holds', () => {
    const m1 = match('m1', 'griffin', 'kyle', Array(10).fill('A'));
    const m2 = { ...match('m2', 'matt', 'jt', Array(10).fill('A')), g: 1 };
    setContext(PLAYERS, [singles], [m1, m2]);
    const [day] = buildFeed(base([m1, m2]));
    const leads = day.items.filter(i => i.tag === 'Lead change');
    expect(leads).toHaveLength(1);
    expect(leads[0].hl).toBe('Vikes lead');
    expect(leads[0].score).toEqual({ a: 1, b: 0 });
  });

  it('halved matches split the point and never change the lead', () => {
    const m = match('m1', 'griffin', 'kyle', Array(18).fill('H'));
    setContext(PLAYERS, [singles], [m]);
    const [day] = buildFeed(base([m]));
    expect(day.items.find(i => i.key === 'f:m1')!.hl).toBe('Halved');
    expect(day.items.some(i => i.tag === 'Lead change')).toBe(false);
  });

  it('adds scorer switches from feed_event', () => {
    const m = match('m1', 'griffin', 'kyle', ['A']);
    setContext(PLAYERS, [singles], [m]);
    const sw: DbFeedEvent = {
      id: 1, event_id: 'e', round_id: 'r4', match_id: null, kind: 'scorer_switch', tier: 'none',
      body: { seq: 1, from: 'p1', to: 'p2', tee_group_id: 'tg' },
      occurred_at: new Date(T0 + 5 * 60000).toISOString(),
    };
    const input = { ...base([m], [sw]), playerById: { p1: { name: 'Griffin S.' }, p2: { name: 'Kyle P.' } } as never };
    const [day] = buildFeed(input);
    const s = day.items.find(i => i.key === 's:1')!;
    expect(s.text).toContain('Kyle');
    expect(s.text).toContain('Group A');
    expect(s.text).toContain('from Griffin');
  });

  it('announces a card coming home', () => {
    const m = match('m1', 'griffin', 'kyle', ['A']);
    setContext(PLAYERS, [singles], [m]);
    const ci: DbFeedEvent = {
      id: 2, event_id: 'e', round_id: 'r4', match_id: null, kind: 'card_in', tier: 'none',
      body: { seq: 1, by: 'p1', tee_group_id: 'tg' },
      occurred_at: new Date(T0 + 9 * 60000).toISOString(),
    };
    const input = { ...base([m], [ci]), playerById: { p1: { name: 'Griffin S.' } } as never };
    const [day] = buildFeed(input);
    const line = day.items.find(i => i.key === 'ci:2')!;
    expect(line.text).toBe("**Griffin** handed in Group A's card for Round 4.");
  });
});
