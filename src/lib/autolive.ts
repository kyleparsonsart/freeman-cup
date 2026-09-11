/**
 * Rounds go live on their own thirty minutes before the first tee time
 * (course time, Central). The first phone to look calls round_tick,
 * which flips the round once and records it; a round the commissioner
 * has set back to Not started stays put. Mirrors freeman-cup-autolive.sql.
 */
import type { DbRound, DbTeeGroup, DbMatch } from './types';

export const AUTO_LIVE_MINUTES = 30;
const COURSE_TZ = 'America/Chicago';

/** play_date + tee_time in course time, as epoch ms; null without a tee time */
export function firstTeeMs(r: DbRound, teeGroups: DbTeeGroup[]): number | null {
  const times = teeGroups.filter(g => g.round_id === r.id).map(g => g.tee_time).filter(Boolean).sort();
  if (!times.length) return null;
  const [h, m] = times[0].split(':').map(Number);
  // find the UTC instant whose wall clock in the course zone is play_date h:m
  const guess = Date.UTC(...(r.play_date.split('-').map(Number) as [number, number, number]).map((v, i) => (i === 1 ? v - 1 : v)) as [number, number, number], h, m);
  const fmt = new Intl.DateTimeFormat('en-US', { timeZone: COURSE_TZ, hour12: false, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' });
  const parts = Object.fromEntries(fmt.formatToParts(new Date(guess)).map(p => [p.type, p.value]));
  const wall = Date.UTC(Number(parts.year), Number(parts.month) - 1, Number(parts.day), Number(parts.hour) % 24, Number(parts.minute));
  return guess - (wall - guess);
}

/** epoch ms when the round goes live on its own, or null */
export function autoLiveAt(r: DbRound, teeGroups: DbTeeGroup[]): number | null {
  const t = firstTeeMs(r, teeGroups);
  return t === null ? null : t - AUTO_LIVE_MINUTES * 60_000;
}

/** the round the app should tick right now, if any */
export function dueForTick(rounds: DbRound[], teeGroups: DbTeeGroup[], matches: DbMatch[], now = Date.now()): DbRound | null {
  return rounds.find(r => r.state === 'upcoming' && !r.auto_live_at
    && matches.some(m => m.round_id === r.id)
    && (autoLiveAt(r, teeGroups) ?? Infinity) <= now) || null;
}

/** '12:30pm' in course time */
export function clockCourse(ms: number): string {
  return new Intl.DateTimeFormat('en-US', { timeZone: COURSE_TZ, hour: 'numeric', minute: '2-digit' }).format(new Date(ms)).toLowerCase().replace(' ', '');
}
