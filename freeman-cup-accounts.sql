-- =====================================================================
--  THE FREEMAN CUP 2026: which seats have a sign-in account (Sep 11)
--  Paste into the Supabase SQL editor and run once.
--  Companion to freeman-cup-schema.sql; the record of what ran.
-- =====================================================================

-- The Seats tab asks whether each seat's email has an auth user behind
-- it, so a bad invitation is caught on the Event tab rather than on the
-- night the codes should arrive. Commissioner only; returns no emails.
create or replace function seat_accounts()
returns table (id uuid, has_account boolean) as $$
begin
  if not is_commissioner() then
    raise exception 'commissioner only';
  end if;
  return query
    select p.id,
           exists (select 1 from auth.users u where lower(u.email) = lower(p.email)) as has_account
    from player p;
end $$ language plpgsql security definer set search_path = public;

revoke execute on function seat_accounts() from anon, public;
grant execute on function seat_accounts() to authenticated;
