/**
 * Write queue unit tests. The Supabase client is mocked out entirely;
 * every flush goes through an injected upserter.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import 'fake-indexeddb/auto';
import { IDBFactory } from 'fake-indexeddb';
import { _resetDbForTests } from './db';
import type { DbMatchHole } from './types';

vi.mock('./supabase', () => ({
  supabase: {},
  ensureAuth: async () => {},
}));

import {
  enqueueHoleWrite, flushQueue, getQueuedWrites, overlayQueue,
  type QueuedHoleWrite, type Upserter,
} from './writeQueue';

const row = (hole: number, extra: Partial<QueuedHoleWrite> = {}): Omit<QueuedHoleWrite, 'queued_at'> => ({
  match_id: 'm1',
  hole,
  scores: { p1: 4 },
  result: null,
  derived: true,
  entered_by: 'p1',
  ...extra,
});

const ok: Upserter = async () => ({ error: null });
const offline: Upserter = async () => ({ error: { message: 'TypeError: Failed to fetch' } });
const rejected: Upserter = async () => ({ error: { code: '42501', message: 'permission denied' } });

const tick = () => new Promise(r => setTimeout(r, 3));

beforeEach(() => {
  // a fresh IndexedDB per test
  globalThis.indexedDB = new IDBFactory();
  _resetDbForTests();
});

describe('enqueueHoleWrite', () => {
  it('syncs immediately when the server accepts', async () => {
    const spy = vi.fn(ok);
    await enqueueHoleWrite(row(1), spy);
    expect(spy).toHaveBeenCalledTimes(1);
    expect(spy.mock.calls[0][0]).toMatchObject({ match_id: 'm1', hole: 1, scores: { p1: 4 } });
    expect(await getQueuedWrites()).toHaveLength(0);
  });

  it('keeps the row when offline, one per hole with the latest write winning', async () => {
    await enqueueHoleWrite(row(1, { scores: { p1: 5 } }), offline);
    await tick();
    await enqueueHoleWrite(row(1, { scores: { p1: 4 } }), offline);
    const q = await getQueuedWrites();
    expect(q).toHaveLength(1);
    expect(q[0].scores).toEqual({ p1: 4 });
  });
});

describe('flushQueue', () => {
  it('drains the queue in the order the holes were scored', async () => {
    await enqueueHoleWrite(row(2), offline);
    await tick();
    await enqueueHoleWrite(row(10), offline);
    await tick();
    await enqueueHoleWrite(row(3), offline);

    const spy = vi.fn(ok);
    const synced = await flushQueue(spy);
    expect(synced).toBe(true);
    expect(spy.mock.calls.map(c => c[0].hole)).toEqual([2, 10, 3]);
    expect(await getQueuedWrites()).toHaveLength(0);
  });

  it('stops at the first network failure and keeps everything', async () => {
    await enqueueHoleWrite(row(1), offline);
    await tick();
    await enqueueHoleWrite(row(2), offline);

    const spy = vi.fn(offline);
    const synced = await flushQueue(spy);
    expect(synced).toBe(false);
    expect(spy).toHaveBeenCalledTimes(1); // broke out, did not hammer the rest
    expect(await getQueuedWrites()).toHaveLength(2);
  });

  it('treats a thrown fetch error as a network failure', async () => {
    await enqueueHoleWrite(row(1), offline);
    const thrower: Upserter = async () => { throw new Error('Failed to fetch'); };
    expect(await flushQueue(thrower)).toBe(false);
    expect(await getQueuedWrites()).toHaveLength(1);
  });

  it('drops a row the server rejects so the queue never wedges', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    await enqueueHoleWrite(row(1), offline);
    await tick();
    await enqueueHoleWrite(row(2), offline);

    // hole 1 is rejected (e.g. RLS after a scorer handoff), hole 2 succeeds
    const spy = vi.fn(async (r: Omit<QueuedHoleWrite, 'queued_at'>) =>
      r.hole === 1 ? rejected(r) : ok(r));
    const synced = await flushQueue(spy);
    expect(synced).toBe(true);
    expect(await getQueuedWrites()).toHaveLength(0);
    vi.restoreAllMocks();
  });
});

describe('overlayQueue', () => {
  const serverHole = (hole: number): DbMatchHole => ({
    match_id: 'm1', hole, result: 'A', scores: { p1: 4 },
    derived: true, entered_by: 'p1', updated_at: '2026-10-08T12:00:00Z',
  });

  it('returns the input untouched when nothing is queued', () => {
    const holes = [serverHole(1)];
    expect(overlayQueue(holes, [])).toBe(holes);
  });

  it('replaces a server row with the queued (newer) write', () => {
    const out = overlayQueue([serverHole(1)], [
      { ...row(1, { scores: { p1: 3 }, result: 'B' }), queued_at: Date.now() } as QueuedHoleWrite,
    ]);
    expect(out).toHaveLength(1);
    expect(out[0].scores).toEqual({ p1: 3 });
    expect(out[0].result).toBe('B');
  });

  it('adds a queued row the server has never seen', () => {
    const out = overlayQueue([serverHole(1)], [
      { ...row(2), queued_at: Date.now() } as QueuedHoleWrite,
    ]);
    expect(out).toHaveLength(2);
    expect(out.find(h => h.hole === 2)?.scores).toEqual({ p1: 4 });
  });

  it('does not mutate the server rows', () => {
    const holes = [serverHole(1)];
    overlayQueue(holes, [{ ...row(1, { result: 'H' }), queued_at: Date.now() } as QueuedHoleWrite]);
    expect(holes[0].result).toBe('A');
  });
});
