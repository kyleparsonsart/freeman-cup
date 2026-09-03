/**
 * IndexedDB write queue for match_hole upserts.
 *
 * Every score post goes through here. The row is stored first (one per
 * match+hole, latest wins — the same shape as the server upsert), then a
 * flush is attempted immediately. Flushes also run on app open, when the
 * browser comes back online, when the tab becomes visible, and on a timer.
 *
 * A network failure keeps rows for the next flush. A server rejection
 * (RLS — the round marked Complete or the card handed in while rows were
 * waiting) keeps the row too, flagged `blocked`, so nothing the scorer
 * entered ever disappears silently: the scoring screen shows blocked
 * rows and they keep retrying, clearing themselves the moment the
 * commissioner unlocks. A newer write to the same hole replaces a
 * blocked row like any other. Deleting one is a deliberate act
 * (dismissBlocked), never a side effect.
 */
import { supabase } from './supabase';
import { idbGetAll, idbPut, idbDelete } from './db';
import type { DbMatchHole } from './types';

export interface QueuedHoleWrite {
  match_id: string;
  hole: number;
  scores: Record<string, number | string>;
  result: 'A' | 'B' | 'H' | null;
  derived: boolean;
  entered_by: string | null;
  queued_at: number;
  /** set when the server refused this row for a permanent reason */
  blocked?: string;
}

export type UpsertError = { code?: string; message: string } | null;
export type Upserter = (
  row: Omit<QueuedHoleWrite, 'queued_at'>,
) => Promise<{ error: UpsertError }>;

const defaultUpsert: Upserter = async ({ match_id, hole, scores, result, derived, entered_by }) => {
  const { error } = await supabase
    .from('match_hole')
    .upsert({ match_id, hole, scores, result, derived, entered_by }, { onConflict: 'match_id,hole' });
  return { error };
};

/* ---------- listeners ---------- */

const listeners = new Set<() => void>();

export function onQueueChange(cb: () => void): () => void {
  listeners.add(cb);
  return () => {
    listeners.delete(cb);
  };
}

function notify() {
  listeners.forEach(cb => cb());
}

/* ---------- queue ---------- */

const keyOf = (w: { match_id: string; hole: number }) => `${w.match_id}:${w.hole}`;

export async function getQueuedWrites(): Promise<QueuedHoleWrite[]> {
  try {
    const rows = await idbGetAll<QueuedHoleWrite>('write_queue');
    return rows.sort((a, b) => a.queued_at - b.queued_at);
  } catch {
    return [];
  }
}

export async function enqueueHoleWrite(
  row: Omit<QueuedHoleWrite, 'queued_at' | 'blocked'>,
  upsert: Upserter = defaultUpsert,
): Promise<void> {
  const queued: QueuedHoleWrite = { ...row, queued_at: Date.now() };
  try {
    await idbPut('write_queue', keyOf(queued), queued);
  } catch (e) {
    // IndexedDB unavailable: write straight through rather than lose it
    console.error('write_queue put failed, writing direct:', e);
    await upsert(row);
    return;
  }
  notify();
  await flushQueue(upsert);
}

/** Network-ish failures have no PostgREST error code (or a fetch message). */
function isNetworkError(error: NonNullable<UpsertError>): boolean {
  return !error.code || /fetch|network|load failed|timed? ?out/i.test(error.message);
}

let flushing: Promise<boolean> | null = null;

/** Returns true if at least one queued row reached the server. */
export function flushQueue(upsert: Upserter = defaultUpsert): Promise<boolean> {
  if (flushing) return flushing;
  flushing = (async () => {
    let synced = false;
    let changed = false;
    // fresh rows first so a blocked row never delays a new score
    const rows = (await getQueuedWrites()).sort(
      (a, b) => Number(!!a.blocked) - Number(!!b.blocked) || a.queued_at - b.queued_at,
    );
    for (const row of rows) {
      const { error } = await upsert(row).catch((e: Error) => ({
        error: { message: e.message } as UpsertError,
      }));
      if (!error) {
        await idbDelete('write_queue', keyOf(row));
        synced = true;
        changed = true;
      } else if (isNetworkError(error)) {
        break; // offline — keep everything for the next trigger
      } else if (row.blocked !== error.message) {
        // refused for a permanent reason: keep the row, say so, retry later
        console.error(`Score for hole ${row.hole} refused, kept as blocked:`, error.message);
        await idbPut('write_queue', keyOf(row), { ...row, blocked: error.message });
        changed = true;
      }
    }
    if (changed) notify();
    return synced;
  })().finally(() => {
    flushing = null;
  });
  return flushing;
}

/** Deliberately throw away one blocked row (the card's Dismiss). */
export async function dismissBlocked(match_id: string, hole: number): Promise<void> {
  await idbDelete('write_queue', keyOf({ match_id, hole }));
  notify();
}

/* ---------- overlay ---------- */

/**
 * Lay queued (not yet synced) writes over rows fetched from the server or
 * snapshot, so the UI always shows what the scorer entered. Pure function.
 */
export function overlayQueue(holes: DbMatchHole[], queued: QueuedHoleWrite[]): DbMatchHole[] {
  if (!queued.length) return holes;
  const out = holes.map(h => ({ ...h }));
  for (const q of queued) {
    const patch = {
      result: q.result,
      scores: q.scores,
      derived: q.derived,
      entered_by: q.entered_by,
      updated_at: new Date(q.queued_at).toISOString(),
    };
    const existing = out.find(h => h.match_id === q.match_id && h.hole === q.hole);
    if (existing) Object.assign(existing, patch);
    else out.push({ match_id: q.match_id, hole: q.hole, ...patch });
  }
  return out;
}

/* ---------- lifecycle ---------- */

let initialized = false;

/** Flush on open, on reconnect, on tab focus, and every 20 seconds. */
export function initWriteQueue(): void {
  if (initialized || typeof window === 'undefined') return;
  initialized = true;
  window.addEventListener('online', () => {
    flushQueue();
  });
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) flushQueue();
  });
  setInterval(() => {
    flushQueue();
  }, 20_000);
  flushQueue();
}
