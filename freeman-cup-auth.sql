-- =====================================================================
--  THE FREEMAN CUP 2026 — Sprint 2 auth additions
--  Paste into the Supabase SQL editor and run once.
--  Companion to freeman-cup-schema.sql; the record of what ran.
-- =====================================================================

-- Claiming a seat: a signed-in user binds their auth account to the
-- player row carrying their email. Runs as definer because the RLS
-- update policies (rightly) don't let a player edit a row that isn't
-- theirs yet. One-way: a claimed seat is never rebound; the
-- commissioner clears auth_uid by hand if someone changes address.
create or replace function claim_seat() returns uuid as $$
  update player
     set auth_uid = auth.uid()
   where auth_uid is null
     and auth.uid() is not null
     and lower(email) = lower(auth.jwt()->>'email')
  returning id;
$$ language sql security definer;

revoke execute on function claim_seat() from anon, public;
grant execute on function claim_seat() to authenticated;
