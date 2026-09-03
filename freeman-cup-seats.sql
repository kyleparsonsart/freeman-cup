-- =====================================================================
--  THE FREEMAN CUP 2026 — seats from the phone
--  Paste into the Supabase SQL editor and run once.
--  Companion to freeman-cup-schema.sql; the record of what ran.
-- =====================================================================

-- Invite day without the SQL editor: the commissioner unbinds a stale
-- account from a seat so the right email can claim it (claim_seat runs
-- on next sign-in, one-way as before).
create or replace function clear_seat(p uuid) returns void as $$
begin
  if not is_commissioner() then
    raise exception 'commissioner only';
  end if;
  update player set auth_uid = null where id = p;
end $$ language plpgsql security definer;

revoke execute on function clear_seat(uuid) from anon, public;
grant execute on function clear_seat(uuid) to authenticated;
