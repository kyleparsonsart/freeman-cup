import { describe, it, expect, beforeAll } from 'vitest';
import { setContext, type Match, type Session, type HoleData } from '../scoring';
import { pairingsMail, weekOutMail, recapMail } from './emails';

const par = Array(18).fill(4), si = Array.from({ length: 18 }, (_, i) => i + 1);
const S: Session[] = [
  { id: 'r1', rd: 'Round 1', day: 'Thu Oct 8', fmt: 'Four-ball', course: 'Mammoth Dunes', holes: 18, tees: ['12:00 PM'], scorer: ['griffin'], state: 'final', par, si },
  { id: 'r2', rd: 'Round 2', day: 'Fri Oct 9', fmt: 'Singles', course: 'Sedge Valley', holes: 18, tees: ['10:10 AM'], scorer: [], state: 'upcoming', par, si },
];
const P = { griffin: { n: 'Griffin S', t: 'a' as const, h: 7 }, matt: { n: 'Matt J', t: 'a' as const, h: 15 }, kyle: { n: 'Kyle P', t: 'b' as const, h: 15 }, jt: { n: 'JT R', t: 'b' as const, h: 12 } };
const hole = (r: 'A' | 'B' | 'H'): HoleData => ({ r, sc: { griffin: 4, matt: 4, kyle: 4, jt: 4 }, d: true, by: null, at: null });
const m1: Match = { id: 'm1', s: 'r1', g: 0, a: ['griffin', 'matt'], b: ['kyle', 'jt'], hs: [...'AAAAAAAAAAHHHHHHHH'].map(c => hole(c as 'A' | 'B' | 'H')) };
const players = [
  { id: 'p1', name: 'Griffin S', email: 'griffin@x.test', team_id: 't1' }, { id: 'p2', name: 'Matt J', email: 'matt@example.com', team_id: 't1' },
  { id: 'p3', name: 'Kyle P', email: 'kyle@x.test', team_id: 't2' }, { id: 'p4', name: 'JT R', email: 'jt@x.test', team_id: 't2' },
];
const data = {
  event: { year: 2026, venue: 'Sand Valley', trophy: 'The Lassie', clinch_points: 5.5, shootout: null },
  players, playerById: Object.fromEntries(players.map(p => [p.id, p])), mePlayerId: 'p3', meKey: 'kyle',
  rounds: [{ id: 'r1', seq: 1, label: 'Round 1', play_date: '2026-10-08', revealed_at: 'x' }, { id: 'r2', seq: 2, label: 'Round 2', play_date: '2026-10-09', revealed_at: null }],
  matches: [{ id: 'm1', round_id: 'r1', tee_group_id: 'g1', seq: 1, side_a: ['p1', 'p2'], side_b: ['p3', 'p4'], odds_a: null, odds_b: null }],
  teeGroups: [{ id: 'g1', round_id: 'r1', seq: 1, tee_time: '12:00', scorer_player_id: 'p1', submitted_at: 'x' }],
  matchHoles: [], scoringSessions: S, scoringMatches: [m1], mailSent: [],
} as never;

beforeAll(() => setContext(P, S, [m1]));

describe('the emails', () => {
  it('pairings: one per real address, addressed to the player, with his strokes', () => {
    const ms = pairingsMail(data, (data as { rounds: { id: string }[] }).rounds[0] as never);
    expect(ms.map(m => m.to)).toEqual(['griffin@x.test', 'kyle@x.test', 'jt@x.test']);   // matt@example.com is skipped
    const kyle = ms.find(m => m.to === 'kyle@x.test')!;
    expect(kyle.subject).toBe('Round 1: Kyle & JT v Griffin & Matt, off at 12:00pm');
    expect(kyle.html).toContain('Kyle, you&#8217;re off at 12:00pm.');
    expect(kyle.html).toContain('You get 7 strokes');      // 15 - 7 = 8, at 90% = 7
    expect(kyle.html).toContain('Scorer');
    expect(kyle.html).not.toContain('__');
  });
  it('recap: the day’s score, the matches and their stories', () => {
    const ms = recapMail(data, 'Thu Oct 8');
    expect(ms).toHaveLength(3);
    expect(ms[0].subject).toBe('Thursday recap: Vikes lead, 1 to 0');
    expect(ms[0].html).toContain('Griffin &amp; Matt');
    expect(ms[0].html).toContain('10 &amp; 8');
  });
  it('week out: the schedule by day', () => {
    const ms = weekOutMail(data);
    expect(ms[0].html).toContain('Mammoth Dunes');
    expect(ms[0].html).toContain('Sedge Valley');
  });
});
