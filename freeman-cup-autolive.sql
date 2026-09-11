-- =====================================================================
--  THE FREEMAN CUP 2026: rounds go live on their own (Sep 11)
--  Paste into the Supabase SQL editor and run once.
--  Companion to freeman-cup-schema.sql; the record of what ran.
-- =====================================================================

-- Thirty minutes before a round's first tee time (course time, Central),
-- the first phone to look flips it from Not started to Live, once. The
-- flip is recorded in auto_live_at so it never fires twice: if the
-- commissioner sets the round back to Not started (a delay), it holds.
-- Pairings must be posted; scorers are elected on the tee as before.
alter table round add column if not exists auto_live_at timestamptz;

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
  if first_tee is null or now() < first_tee - interval '30 minutes' then return false; end if;
  update round set state = 'live', auto_live_at = now() where id = r;
  return true;
end $$ language plpgsql security definer set search_path = public;

revoke execute on function round_tick(uuid) from anon, public;
grant execute on function round_tick(uuid) to authenticated;

-- Start over and Reset to sheets clear the record too, so a rehearsal
-- flip never holds the real round.
create or replace function reset_event() returns void as $$
begin
  if not is_commissioner() then
    raise exception 'commissioner only';
  end if;
  delete from match_hole where true;
  delete from feed_event where true;
  delete from captain_sheet where true;
  delete from match where true;
  update round set state = 'upcoming', revealed_at = null, auto_live_at = null where true;
  update event set shootout = null where true;
  update tee_group set submitted_at = null, submitted_by = null where true;
end $$ language plpgsql security definer;

create or replace function reset_round(r uuid) returns void as $$
declare x record;
begin
  if not is_commissioner() then
    raise exception 'commissioner only';
  end if;
  for x in select id, seq from round
            where event_id = (select event_id from round where id = r)
              and seq >= (select seq from round where id = r)
            order by seq desc loop
    delete from match_hole where match_id in (select id from match where round_id = x.id);
    delete from feed_event where round_id = x.id;
    delete from match where round_id = x.id;
    delete from captain_sheet where round_id = x.id;
    update tee_group set submitted_at = null, submitted_by = null where round_id = x.id;
    update round set state = 'upcoming', revealed_at = null, auto_live_at = null where id = x.id;
  end loop;
end $$ language plpgsql security definer;
