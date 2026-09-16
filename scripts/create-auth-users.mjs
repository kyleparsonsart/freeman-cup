#!/usr/bin/env node
/**
 * Create the seven auth users the safe way: through the admin API, with
 * email confirmed, so sign-in by code works. Raw inserts into auth.users
 * leave token columns null (GoTrue 500s on lookup) and an unconfirmed
 * user gets the "Confirm signup" template, which carries no code.
 *
 * Reads every player row with an email, creates a user for each address
 * that has none, and prints a table. Idempotent: existing users are left
 * alone. The seat links itself on the player's first sign-in (claim_seat).
 *
 *   SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... node scripts/create-auth-users.mjs
 *
 * The service key never goes in the repo or the client; pass it on the
 * command line from the dashboard (Settings, API) and forget it after.
 */
import { createClient } from '@supabase/supabase-js';

const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error('Need SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in the environment.');
  process.exit(1);
}
const admin = createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });

const { data: players, error } = await admin.from('player').select('name, email, auth_uid').order('name');
if (error) { console.error(error.message); process.exit(1); }

const { data: list, error: lerr } = await admin.auth.admin.listUsers({ perPage: 200 });
if (lerr) { console.error(lerr.message); process.exit(1); }
const byEmail = new Map(list.users.map(u => [String(u.email).toLowerCase(), u]));

const rows = [];
for (const p of players) {
  const email = (p.email || '').trim().toLowerCase();
  if (!email) { rows.push([p.name, '(no email on the seat)', 'skipped']); continue; }
  const existing = byEmail.get(email);
  if (existing) {
    rows.push([p.name, email, existing.email_confirmed_at ? 'already there' : 'EXISTS BUT UNCONFIRMED: confirm in the dashboard']);
    continue;
  }
  const { data, error: cerr } = await admin.auth.admin.createUser({ email, email_confirm: true });
  rows.push([p.name, email, cerr ? `FAILED: ${cerr.message}` : `created ${data.user.id.slice(0, 8)}`]);
}
const w = Math.max(...rows.map(r => r[1].length));
for (const [n, e, s] of rows) console.log(`${n.padEnd(12)} ${e.padEnd(w)}  ${s}`);
console.log('\nNow check Settings, Setup, Seats in the app: every chip should read Open (or Claimed), not No account.');
