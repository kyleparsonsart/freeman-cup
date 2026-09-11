import { describe, it, expect } from 'vitest';
import { firstTeeMs, autoLiveAt, dueForTick, clockCourse } from './autolive';
import type { DbRound, DbTeeGroup, DbMatch } from './types';

const round: DbRound = { id: 'r1', event_id: 'e', seq: 1, label: 'Round 1', play_date: '2026-10-08', format: 'four-ball', course_id: 'c', holes: 18, locked: false, state: 'upcoming' };
const tgs: DbTeeGroup[] = [
  { id: 'g1', round_id: 'r1', seq: 1, tee_time: '12:00:00', scorer_player_id: null },
  { id: 'g2', round_id: 'r1', seq: 2, tee_time: '12:10:00', scorer_player_id: null },
];
const ms: DbMatch[] = [{ id: 'm', round_id: 'r1', tee_group_id: 'g1', seq: 1, side_a: [], side_b: [], odds_a: null, odds_b: null }];

describe('auto live', () => {
  it('reads the first tee in Central time (CDT in October)', () => {
    // 12:00 CDT on Oct 8 2026 is 17:00 UTC
    expect(firstTeeMs(round, tgs)).toBe(Date.UTC(2026, 9, 8, 17, 0));
    expect(clockCourse(firstTeeMs(round, tgs)!)).toBe('12:00pm');
  });
  it('goes live thirty minutes before', () => {
    expect(autoLiveAt(round, tgs)).toBe(Date.UTC(2026, 9, 8, 16, 30));
    expect(clockCourse(autoLiveAt(round, tgs)!)).toBe('11:30am');
  });
  it('is due only with pairings, only once, only when the time has come', () => {
    const at = Date.UTC(2026, 9, 8, 16, 30);
    expect(dueForTick([round], tgs, ms, at - 1)).toBeNull();
    expect(dueForTick([round], tgs, ms, at)?.id).toBe('r1');
    expect(dueForTick([round], tgs, [], at)).toBeNull();
    expect(dueForTick([{ ...round, auto_live_at: 'x' }], tgs, ms, at)).toBeNull();
    expect(dueForTick([{ ...round, state: 'live' }], tgs, ms, at)).toBeNull();
  });
});
