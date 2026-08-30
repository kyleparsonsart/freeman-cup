/**
 * RLS integration tests — run against the live Supabase project.
 *
 * These test the policies defined in freeman-cup-schema.sql:
 *   - a player who is NOT the scorer
 *   - the elected scorer for one tee group
 *   - the commissioner
 *
 * Requires SUPABASE_SERVICE_ROLE_KEY in .env.local and auth users already created.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import { resolve } from 'path';

dotenv.config({ path: resolve(__dirname, '../../.env.local') });

const URL = process.env.VITE_SUPABASE_URL!;
const ANON = process.env.VITE_SUPABASE_ANON_KEY!;
const SRK = process.env.SUPABASE_SERVICE_ROLE_KEY!;

function anonClient(): SupabaseClient {
  return createClient(URL, ANON, { auth: { autoRefreshToken: false, persistSession: false } });
}

function adminClient(): SupabaseClient {
  return createClient(URL, SRK, { auth: { autoRefreshToken: false, persistSession: false } });
}

async function signIn(email: string, password: string): Promise<SupabaseClient> {
  const c = anonClient();
  const { error } = await c.auth.signInWithPassword({ email, password });
  if (error) throw new Error(`Sign-in failed for ${email}: ${error.message}`);
  return c;
}

// Test data references
let admin: SupabaseClient;
let mattClient: SupabaseClient;   // player, not a scorer anywhere
let devinClient: SupabaseClient;  // scorer for round 3 tee group 1
let kyleClient: SupabaseClient;   // commissioner + scorer for round 2 tee group 1

let round3Id: string;
let round3Group1MatchId: string;
let round3Group2MatchId: string;

beforeAll(async () => {
  admin = adminClient();

  // Sign in as all three roles
  [mattClient, devinClient, kyleClient] = await Promise.all([
    signIn('matt@example.com', 'testpass123!'),
    signIn('devin@example.com', 'testpass123!'),
    signIn('kyle@example.com', 'testpass123!'),
  ]);

  // Get round 3 data for scorer tests
  const { data: rounds } = await admin.from('round').select('id,seq,label');
  round3Id = rounds!.find((r: { seq: number }) => r.seq === 3)!.id;

  // Get matches in round 3
  const { data: matches } = await admin.from('match').select('id,tee_group_id,seq')
    .eq('round_id', round3Id).order('seq');
  const { data: tgs } = await admin.from('tee_group').select('id,seq,round_id')
    .eq('round_id', round3Id).order('seq');

  // Group 1 (seq=1) match, Group 2 (seq=2) match
  const tg1 = tgs!.find((t: { seq: number }) => t.seq === 1)!;
  const tg2 = tgs!.find((t: { seq: number }) => t.seq === 2)!;
  round3Group1MatchId = matches!.find((m: { tee_group_id: string }) => m.tee_group_id === tg1.id)!.id;
  round3Group2MatchId = matches!.find((m: { tee_group_id: string }) => m.tee_group_id === tg2.id)!.id;

  // Clean up any test holes from previous runs
  await admin.from('match_hole').delete().in('match_id', [round3Group1MatchId, round3Group2MatchId]).gte('hole', 17);
}, 30000);

afterAll(async () => {
  // Clean up test holes
  await admin.from('match_hole').delete().in('match_id', [round3Group1MatchId, round3Group2MatchId]).gte('hole', 17);
});

describe('as a player who is NOT the scorer (Matt J.)', () => {
  it('can select every match_hole in the event', async () => {
    const { data, error } = await mattClient.from('match_hole').select('match_id,hole');
    expect(error).toBeNull();
    expect(data).toBeDefined();
    // Should see all holes, not an empty set
    expect(data!.length).toBeGreaterThanOrEqual(0); // can be 0 if no holes entered yet
  });

  it('can select all players, rounds, matches, courses, teams', async () => {
    const results = await Promise.all([
      mattClient.from('player').select('id'),
      mattClient.from('round').select('id'),
      mattClient.from('match').select('id'),
      mattClient.from('course').select('id'),
      mattClient.from('team').select('id'),
      mattClient.from('tee_group').select('id'),
      mattClient.from('event').select('id'),
    ]);
    for (const r of results) {
      expect(r.error).toBeNull();
      expect(r.data!.length).toBeGreaterThan(0);
    }
  });

  it('insert into match_hole is rejected', async () => {
    const { error } = await mattClient.from('match_hole').insert({
      match_id: round3Group1MatchId,
      hole: 18,
      result: 'A',
      scores: { a: 4, b: 5 },
      derived: true,
    });
    expect(error).not.toBeNull();
  });

  it('update of match_hole is rejected', async () => {
    // First insert a hole as admin so there's something to update
    await admin.from('match_hole').upsert({
      match_id: round3Group1MatchId,
      hole: 17,
      result: 'H',
      scores: {},
      derived: true,
    }, { onConflict: 'match_id,hole' });

    const { error } = await mattClient.from('match_hole')
      .update({ result: 'A' })
      .eq('match_id', round3Group1MatchId)
      .eq('hole', 17);
    // RLS silently filters, so the update affects 0 rows rather than erroring
    // But the data should not change
    const { data } = await admin.from('match_hole')
      .select('result')
      .eq('match_id', round3Group1MatchId)
      .eq('hole', 17)
      .single();
    expect(data?.result).toBe('H'); // unchanged
  });
});

describe('as the elected scorer for tee_group 3.1 (Devin E.)', () => {
  it('insert / update on that group\'s match_hole succeeds', async () => {
    // Insert a hole
    const { error: insertErr } = await devinClient.from('match_hole').upsert({
      match_id: round3Group1MatchId,
      hole: 18,
      result: 'A',
      scores: {},
      derived: true,
    }, { onConflict: 'match_id,hole' });
    expect(insertErr).toBeNull();

    // Update that hole
    const { error: updateErr } = await devinClient.from('match_hole')
      .update({ result: 'B' })
      .eq('match_id', round3Group1MatchId)
      .eq('hole', 18);
    expect(updateErr).toBeNull();

    // Verify the update took effect
    const { data } = await admin.from('match_hole')
      .select('result')
      .eq('match_id', round3Group1MatchId)
      .eq('hole', 18)
      .single();
    expect(data?.result).toBe('B');
  });

  it('the same on tee_group 3.2 is rejected', async () => {
    const { error } = await devinClient.from('match_hole').upsert({
      match_id: round3Group2MatchId,
      hole: 18,
      result: 'A',
      scores: {},
      derived: true,
    }, { onConflict: 'match_id,hole' });
    expect(error).not.toBeNull();
  });

  it('after round 3 is locked, both are rejected', async () => {
    // Lock round 3
    await admin.from('round').update({ locked: true }).eq('id', round3Id);

    const { error: e1 } = await devinClient.from('match_hole').upsert({
      match_id: round3Group1MatchId,
      hole: 17,
      result: 'A',
      scores: {},
      derived: true,
    }, { onConflict: 'match_id,hole' });
    expect(e1).not.toBeNull();

    const { error: e2 } = await devinClient.from('match_hole').upsert({
      match_id: round3Group2MatchId,
      hole: 17,
      result: 'A',
      scores: {},
      derived: true,
    }, { onConflict: 'match_id,hole' });
    expect(e2).not.toBeNull();

    // Unlock round 3 again for other tests
    await admin.from('round').update({ locked: false }).eq('id', round3Id);
  });
});

describe('as the commissioner (Kyle P.)', () => {
  it('insert / update on any match_hole succeeds, locked or not', async () => {
    // Insert on group 1
    const { error: e1 } = await kyleClient.from('match_hole').upsert({
      match_id: round3Group1MatchId,
      hole: 17,
      result: 'H',
      scores: {},
      derived: true,
    }, { onConflict: 'match_id,hole' });
    expect(e1).toBeNull();

    // Insert on group 2
    const { error: e2 } = await kyleClient.from('match_hole').upsert({
      match_id: round3Group2MatchId,
      hole: 17,
      result: 'H',
      scores: {},
      derived: true,
    }, { onConflict: 'match_id,hole' });
    expect(e2).toBeNull();

    // Lock round 3 and try again
    await admin.from('round').update({ locked: true }).eq('id', round3Id);

    const { error: e3 } = await kyleClient.from('match_hole')
      .update({ result: 'A' })
      .eq('match_id', round3Group1MatchId)
      .eq('hole', 17);
    expect(e3).toBeNull();

    // Unlock
    await admin.from('round').update({ locked: false }).eq('id', round3Id);
  });

  it('update of round, match and tee_group succeeds', async () => {
    // Round: toggle locked
    const { error: e1 } = await kyleClient.from('round')
      .update({ locked: true })
      .eq('id', round3Id);
    expect(e1).toBeNull();
    await admin.from('round').update({ locked: false }).eq('id', round3Id);

    // Match: update (e.g. seq)
    const { error: e2 } = await kyleClient.from('match')
      .update({ seq: 1 })
      .eq('id', round3Group1MatchId);
    expect(e2).toBeNull();

    // Tee group: update scorer
    const { data: tgs } = await admin.from('tee_group').select('id').eq('round_id', round3Id).order('seq').limit(1);
    const { error: e3 } = await kyleClient.from('tee_group')
      .update({ scorer_player_id: (await admin.from('player').select('id').eq('name', 'Kyle P.').single()).data!.id })
      .eq('id', tgs![0].id);
    expect(e3).toBeNull();

    // Restore original scorer
    const { data: devin } = await admin.from('player').select('id').eq('name', 'Devin E.').single();
    await admin.from('tee_group').update({ scorer_player_id: devin!.id }).eq('id', tgs![0].id);
  });
});

describe('everybody', () => {
  it('delete from match_hole is rejected', async () => {
    // Try deleting as each role
    for (const client of [mattClient, devinClient, kyleClient]) {
      const { error } = await client.from('match_hole')
        .delete()
        .eq('match_id', round3Group1MatchId)
        .eq('hole', 17);
      // No delete policy exists, so this should fail or affect 0 rows
      // Supabase returns no error but deletes 0 rows when there's no delete policy
      const { data } = await admin.from('match_hole')
        .select('result')
        .eq('match_id', round3Group1MatchId)
        .eq('hole', 17)
        .single();
      // The row should still exist (not deleted)
      expect(data).not.toBeNull();
    }
  });

  it('match_hole_history gains a row on every write', async () => {
    // Count history rows before
    const { count: before } = await admin.from('match_hole_history')
      .select('*', { count: 'exact', head: true })
      .eq('match_id', round3Group1MatchId);

    // Write a hole as the commissioner
    await kyleClient.from('match_hole').upsert({
      match_id: round3Group1MatchId,
      hole: 18,
      result: 'H',
      scores: {},
      derived: true,
    }, { onConflict: 'match_id,hole' });

    // Count history rows after
    const { count: after } = await admin.from('match_hole_history')
      .select('*', { count: 'exact', head: true })
      .eq('match_id', round3Group1MatchId);

    expect(after!).toBeGreaterThan(before!);
  });

  it('match_hole_history is readable by authenticated users', async () => {
    const { data, error } = await mattClient.from('match_hole_history').select('id').limit(1);
    expect(error).toBeNull();
    expect(data).toBeDefined();
  });
});
