import { describe, it, expect } from 'vitest';
import { sheetDue, usedPairs, pairingOptions, sheetView } from './sheets';
import type { DbCaptainSheet, DbMatch, DbPlayer, DbRound, DbSheetStatus, DbTeam } from './types';

const teams: DbTeam[] = [
  { id: 'TA', event_id: 'E', side: 'a', name: 'Vikes', short: 'VIK' },
  { id: 'TB', event_id: 'E', side: 'b', name: 'Celts', short: 'CEL' },
];
const P = (id: string, team: string, name: string, cap = false): DbPlayer =>
  ({ id, event_id: 'E', team_id: team, name, handicap_index: 10, is_captain: cap, is_commissioner: id === 'kyle', email: '', auth_uid: null });
const players = [
  P('griffin', 'TA', 'Griffin', true), P('devin', 'TA', 'Devin'), P('brian', 'TA', 'Brian'), P('matt', 'TA', 'Matt'),
  P('kyle', 'TB', 'Kyle', true), P('phil', 'TB', 'Phil'), P('justin', 'TB', 'Justin'), P('jt', 'TB', 'JT'),
];
const R = (seq: number, format: DbRound['format'], play_date: string, revealed_at: string | null = null): DbRound =>
  ({ id: `R${seq}`, event_id: 'E', seq, label: `Round ${seq}`, play_date, format, course_id: 'C', holes: 18, locked: false, state: 'upcoming', revealed_at });
const rounds = [R(1, 'four-ball', '2026-10-08'), R(2, 'aggregate', '2026-10-09'), R(3, 'four-ball', '2026-10-09'), R(4, 'singles', '2026-10-10')];
const M = (round_id: string, a: string[], b: string[]): DbMatch => ({ id: `${round_id}-${a[0]}`, round_id, tee_group_id: 'G', seq: 1, side_a: a, side_b: b, odds_a: null, odds_b: null });

describe('sheetDue', () => {
  it('is 9:00 pm Chicago the evening before', () => {
    const d = sheetDue(rounds[0]);
    expect(d.toISOString()).toBe('2026-10-08T02:00:00.000Z'); // Oct 7, 21:00 CDT (UTC-5)
  });
  it('handles standard time too', () => {
    expect(sheetDue(R(9, 'singles', '2027-01-10')).toISOString()).toBe('2027-01-10T03:00:00.000Z'); // CST
  });
  it('a second round on the same day is due 90 minutes before its first tee', () => {
    const tgs = [{ id: 'G31', round_id: 'R3', seq: 1, tee_time: '13:10:00', scorer_player_id: null }, { id: 'G32', round_id: 'R3', seq: 2, tee_time: '13:20:00', scorer_player_id: null }];
    expect(sheetDue(rounds[2], rounds, tgs as never).toISOString()).toBe('2026-10-09T16:40:00.000Z'); // 11:40 CDT
    expect(sheetDue(rounds[1], rounds, tgs as never).toISOString()).toBe('2026-10-09T02:00:00.000Z');
  });
});

describe('pairing options', () => {
  it('lists the three splits, alphabetical anchor', () => {
    const celts = players.filter(p => p.team_id === 'TB');
    const opts = pairingOptions(celts, new Map());
    expect(opts.map(o => o.pairs)).toEqual([
      [['jt', 'justin'], ['kyle', 'phil']],
      [['jt', 'kyle'], ['justin', 'phil']],
      [['jt', 'phil'], ['justin', 'kyle']],
    ]);
    expect(opts.every(o => !o.used)).toBe(true);
  });
  it('flags a pairing whose pair has already played', () => {
    const used = usedPairs(teams[1], rounds[1], rounds, [M('R1', ['griffin', 'matt'], ['kyle', 'jt'])]);
    const opts = pairingOptions(players.filter(p => p.team_id === 'TB'), used);
    expect(opts.map(o => o.used)).toEqual([false, true, false]);
    expect(opts[1].usedIn).toBe('Round 1');
  });
  it('ignores singles and later rounds when collecting used pairs', () => {
    const used = usedPairs(teams[0], rounds[1], rounds, [
      M('R4', ['griffin'], ['kyle']), M('R3', ['griffin', 'devin'], ['kyle', 'phil']),
    ]);
    expect(used.size).toBe(0);
  });
});

describe('sheetView', () => {
  const S = (team_id: string, opened = false): DbSheetStatus => ({ round_id: 'R1', team_id, sealed_at: '2026-10-08T01:12:00Z', auto: false, opened_at: opened ? '2026-10-08T01:40:00Z' : null });
  const sheet = (team_id: string): DbCaptainSheet => ({ id: team_id, round_id: 'R1', team_id, slots: [['a'], ['b']], sealed_at: '', sealed_by: null, auto: false, opened_at: null, opened_by: null });
  const base = { round: rounds[0], teams, players, sheets: [] as DbCaptainSheet[], status: [] as DbSheetStatus[], now: new Date('2026-10-08T00:00:00Z') };

  it('a non-captain waits', () => {
    expect(sheetView({ ...base, mePlayerId: 'phil', meIsCommissioner: false }).stage).toBe('waiting');
  });
  it('a captain is locked until the earlier rounds post', () => {
    const v = sheetView({ ...base, round: rounds[1], rounds, matches: [], mePlayerId: 'kyle', meIsCommissioner: true });
    expect(v.stage).toBe('locked');
    const v2 = sheetView({ ...base, round: rounds[1], rounds, matches: [M('R1', ['griffin', 'matt'], ['kyle', 'jt'])], mePlayerId: 'kyle', meIsCommissioner: true });
    expect(v2.stage).toBe('open');
  });
  it('a captain with no sheet is open, then sealed', () => {
    expect(sheetView({ ...base, mePlayerId: 'kyle', meIsCommissioner: true }).stage).toBe('open');
    expect(sheetView({ ...base, status: [S('TB')], sheets: [sheet('TB')], mePlayerId: 'kyle', meIsCommissioner: true }).stage).toBe('sealed');
  });
  it('the commissioner can reveal only with both sheets, or past the deadline', () => {
    expect(sheetView({ ...base, status: [S('TB')], mePlayerId: 'kyle', meIsCommissioner: true }).canReveal).toBe(false);
    expect(sheetView({ ...base, status: [S('TB'), S('TA')], mePlayerId: 'kyle', meIsCommissioner: true }).canReveal).toBe(true);
    expect(sheetView({ ...base, status: [S('TB')], mePlayerId: 'kyle', meIsCommissioner: true, now: new Date('2026-10-08T02:01:00Z') }).canReveal).toBe(true);
    expect(sheetView({ ...base, status: [S('TB'), S('TA')], mePlayerId: 'griffin', meIsCommissioner: false }).canReveal).toBe(false);
  });
  it('lists status Celts first with captains', () => {
    const v = sheetView({ ...base, mePlayerId: 'phil', meIsCommissioner: false });
    expect(v.status.map(s => s.team.name)).toEqual(['Celts', 'Vikes']);
    expect(v.status.map(s => s.captain?.name)).toEqual(['Kyle', 'Griffin']);
  });
});
