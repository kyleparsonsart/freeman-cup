-- =====================================================================
--  THE FREEMAN CUP 2026: rounds go live 15 minutes before the first tee,
--  not 30 (Oct 9). Paste into the Supabase SQL editor and run once.
--  Mirrors AUTO_LIVE_MINUTES in src/lib/autolive.ts.
-- =====================================================================
create or replace function round_tick(r uuid) returns boolean as $$
declare
  rd round%rowtype;
  first_tee timestamptz;
begin
  if auth.uid() is null then raise exception 'sign in first'; end if;
  select * into rd from round where id = r;
  if rd.id is null or rd.state <> 'upcoming' or rd.auto_live_at is not null then return false; end if;
  if not exists (select 1 from match m where m.round_id = r) then return false; end if;
  select min((rd.play_date + g.tee_time) at time zone 'America/Chicago') into first_tee
    from tee_group g where g.round_id = r;
  if first_tee is null or now() < first_tee - interval '15 minutes' then return false; end if;
  update round set state = 'live', auto_live_at = now() where id = r;
  return true;
end $$ language plpgsql security definer set search_path = public;
