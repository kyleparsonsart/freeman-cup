import { describe, it, expect, beforeAll } from 'vitest';
import { setContext, calc, type Match, type Session, type HoleData } from './scoring';
import {
  matchCard, dayCard, finaleCard, shootoutCard, playerCard, weekCard, liveCard, spikes,
  recordOf, submittedFinals, leadSeries, matchStory, type CardData,
} from './cards';

const par18 = [4, 4, 5, 3, 4, 4, 5, 3, 4, 4, 5, 4, 3, 4, 5, 3, 4, 5];
const si18 = [11, 9, 3, 15, 5, 13, 1, 17, 7, 12, 4, 8, 18, 14, 6, 16, 10, 2];

const S: Session[] = [
  { id: 'r1', rd: 'Round 1', day: 'Thu Oct 8', fmt: 'Four-ball', course: 'Mammoth Dunes', holes: 18, tees: ['12:00 PM', '12:10 PM'], scorer: [], state: 'final', par: par18, si: si18 },
  { id: 'r2', rd: 'Round 2', day: 'Fri Oct 9', fmt: 'Singles', course: 'Sedge Valley', holes: 18, tees: ['10:10 AM', '10:30 AM'], scorer: [], state: 'live', par: par18, si: si18 },
];

const P = {
  griffin: { n: 'Griffin', t: 'a' as const, h: 7, cap: true }, matt: { n: 'Matt', t: 'a' as const, h: 14 },
  kyle: { n: 'Kyle', t: 'b' as const, h: 9, cap: true }, jt: { n: 'JT', t: 'b' as const, h: 12 },
};

/** results as a string: A/B/H per hole, '.' unplayed; scores optional per hole */
function match(id: string, s: string, g: number, a: string[], b: string[], res: string, sc: Record<number, Record<string, number>> = {}): Match {
  const N = S.find(x => x.id === s)!.holes;
  const hs: HoleData[] = Array.from({ length: N }, (_, i) => {
    const c = res[i] || '.';
    return { r: c === '.' ? null : (c as 'A' | 'B' | 'H'), sc: sc[i + 1] || (c === '.' ? {} : { [a[0]]: 4, [b[0]]: 4 }), d: c !== '.', by: null, at: null };
  });
  return { id, s, g, a, b, hs };
}

// R1: Griffin & Matt beat Kyle & JT 4 & 2 (A 8, B 4 after 16 holes)
const r1res = 'AHAHAAHBAAABHBBAAA'.slice(0, 17) + '.';
// R2 singles, live: Griffin v Kyle all square thru 9; Matt v JT: JT 4 straight (holes 2-5), 4 up thru 9
const m1 = match('m1', 'r1', 0, ['griffin', 'matt'], ['kyle', 'jt'], r1res, { 7: { griffin: 3, matt: 5, kyle: 4, jt: 5 } }); // eagle on the par-5 7th
const m2 = match('m2', 'r2', 0, ['griffin'], ['kyle'], 'AHBHHAHB.');
const m3 = match('m3', 'r2', 1, ['matt'], ['jt'], 'HBBBBHHHH');

const data: CardData = {
  scoringSessions: S, scoringMatches: [m1, m2, m3],
  matches: [
    { id: 'm1', round_id: 'r1', tee_group_id: 'g1', seq: 1, side_a: [], side_b: [], odds_a: null, odds_b: null },
    { id: 'm2', round_id: 'r2', tee_group_id: 'g2', seq: 1, side_a: [], side_b: [], odds_a: null, odds_b: null },
    { id: 'm3', round_id: 'r2', tee_group_id: 'g2', seq: 2, side_a: [], side_b: [], odds_a: null, odds_b: null },
  ],
  teeGroups: [
    { id: 'g1', round_id: 'r1', seq: 1, tee_time: '12:00', scorer_player_id: null, submitted_at: '2026-10-08T22:00:00Z' },
    { id: 'g2', round_id: 'r2', seq: 1, tee_time: '10:10', scorer_player_id: null, submitted_at: null },
  ],
  players: [], playerById: {}, meKey: 'kyle',
  event: { clinch_points: 1.5, year: 2026, venue: 'Sand Valley', trophy: 'The Lassie' },
};

beforeAll(() => setContext(P, S, [m1, m2, m3]));

describe('match card', () => {
  it('reads the finished match', () => {
    const c = matchCard(data, 'm1')!;
    expect(c.winner).toBe('a');
    expect(c.r.label).toBe('4 & 2');
    expect(c.endedOn).toBe(16);
    expect(c.holes[0]).toBe('a');
    expect(c.holes[1]).toBe('h');
    expect(c.holes[16]).toBeNull();
  });
  it('is null while the match is live', () => {
    expect(matchCard(data, 'm2')).toBeNull();
  });
  it('lists finals whose card is in', () => {
    expect(submittedFinals(data).map(c => c.m.id)).toEqual(['m1']);
  });
});

describe('the match story', () => {
  it('reads the lead hole by hole and never trailed means never trailed', () => {
    expect(leadSeries(m1).slice(0, 5)).toEqual([1, 1, 2, 2, 3]);
    expect(leadSeries(m1)).toHaveLength(17);
    const story = matchStory(m1, S[0], calc(m1));
    expect(story).toContain('Griffin & Matt');
    expect(story).toMatch(/16th/);
  });
  it('calls a comeback a comeback', () => {
    const cb = match('cb', 'r1', 1, ['griffin'], ['kyle'], 'BBBBAAAAAAHHHHH...');
    setContext(P, S, [m1, m2, m3, cb]);
    const story = matchStory(cb, S[0], calc(cb));
    expect(story).toMatch(/4 up through 4/);
    expect(story).toMatch(/Griffin/);
    setContext(P, S, [m1, m2, m3]);
  });
});

describe('records and player cards', () => {
  it('counts wins, losses and halves', () => {
    expect(recordOf(data, 'griffin')).toEqual({ w: 1, l: 0, h: 0 });
    expect(recordOf(data, 'kyle')).toEqual({ w: 0, l: 1, h: 0 });
  });
  it('player card has the first tee from the pairings', () => {
    const c = playerCard(data, 'kyle')!;
    expect(c.side).toBe('b');
    expect(c.captain).toBe(true);
    expect(c.first?.tee).toBe('12:00');
    expect(c.first?.s.course).toBe('Mammoth Dunes');
  });
  it('week card counts holes won, the streak and the closeout', () => {
    const g = weekCard(data, 'griffin')!;
    expect(g.record).toEqual({ w: 1, l: 0, h: 0 });
    expect(g.closeouts[0]).toMatchObject({ opp: 'Kyle & JT', hole: 16, label: '4 & 2' });
    expect(g.eagles).toBe(1);
    expect(g.best).toMatchObject({ what: 'Eagle', hole: 7 });
    expect(g.partners).toEqual(['Matt']);
    const jt = weekCard(data, 'jt')!;
    expect(jt.streak?.n).toBe(4);
    expect(jt.complete).toBe(false);
  });
});

describe('day, live and finale', () => {
  it('day recap carries the running score', () => {
    const d = dayCard(data, 'Thu Oct 8')!;
    expect(d.pts).toEqual({ a: 1, b: 0 });
    expect(d.cum).toEqual({ a: 1, b: 0 });
    expect(d.groups).toHaveLength(1);
    expect(d.next?.course).toBe('Sedge Valley');
    expect(d.clinch).toBe(1.5);
  });
  it('live card projects the matches on the course', () => {
    const l = liveCard(data)!;
    expect(l.s.id).toBe('r2');
    expect(l.pts).toEqual({ a: 1, b: 0 });
    // m2 all square (½ each), m3 JT up (1 to b)
    expect(l.proj).toEqual({ a: 1.5, b: 1.5 });
    expect(l.rows.find(r => r.m.id === 'm3')?.lead).toBe('b');
  });
  it('finale needs the clinch', () => {
    expect(finaleCard(data, {}, null)).toBeNull();
    const done = { ...data, scoringMatches: [m1, match('m2', 'r2', 0, ['griffin'], ['kyle'], 'AAAAAAAAAA'), m3] };
    setContext(P, S, done.scoringMatches);
    const f = finaleCard(done, { 'm1:17': 1, 'm2:10': 2 }, null)!;
    expect(f.winner).toBe('a');
    expect(f.clinch?.m.id).toBe('m2');
    setContext(P, S, [m1, m2, m3]);
  });
  it('shootout card totals the stations', () => {
    const s = shootoutCard(data, { a: [2, 2, 1], b: [3, 2, 2] })!;
    expect(s).toMatchObject({ ta: 5, tb: 7, winner: 'a', captains: { a: 'Griffin', b: 'Kyle' } });
    expect(shootoutCard(data, { a: [2, 2, 2], b: [2, 2, 2] })).toBeNull();
  });
});

describe('spikes', () => {
  it('finds the eagle, the streak and a walk-off', () => {
    const wk = match('m4', 'r1', 1, ['griffin'], ['kyle'], 'ABABABABABABABABAB'.slice(0, 17) + 'A', { 18: { griffin: 4, kyle: 5 } });
    const d = { ...data, scoringMatches: [m1, m2, m3, wk] };
    setContext(P, S, d.scoringMatches);
    const sp = spikes(d);
    expect(sp.find(x => x.type === 'eagle')).toMatchObject({ who: 'Griffin', hole: 7, num: '3', side: 'a' });
    expect(sp.find(x => x.type === 'streak')).toMatchObject({ who: 'JT', hole: 5, side: 'b' });
    const w = sp.find(x => x.type === 'walkoff')!;
    expect(w).toMatchObject({ who: 'Griffin', hole: 18 });
    expect(w.line).toContain('A birdie on 18 to beat Kyle, 2 up.');
    setContext(P, S, [m1, m2, m3]);
  });
});
