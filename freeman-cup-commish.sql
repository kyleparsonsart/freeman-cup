-- =====================================================================
--  THE FREEMAN CUP 2026 — Sprint 2 commissioner settings
--  Paste into the Supabase SQL editor and run once.
--  Companion to freeman-cup-schema.sql; the record of what ran.
-- =====================================================================

-- Round state the commissioner sets by hand: Not started / Live / Complete.
-- `locked` stays as the column the RLS helper reads; a trigger keeps it
-- in step so scores_this_match() is unchanged.
alter table round
  add column if not exists state text not null default 'upcoming'
  check (state in ('upcoming','live','final'));

update round set state = case when locked then 'final' else 'upcoming' end;

create or replace function sync_round_locked() returns trigger as $$
begin
  new.locked := (new.state = 'final');
  return new;
end $$ language plpgsql;

drop trigger if exists round_locked_trg on round;
create trigger round_locked_trg
  before insert or update of state on round
  for each row execute function sync_round_locked();

-- Commissioner-only reset, used once before Thursday: clears every hole
-- and puts every round back to Not started. match_hole_history and the
-- feed are kept, so the test rounds remain on the record.
create or replace function reset_event() returns void as $$
begin
  if not is_commissioner() then
    raise exception 'commissioner only';
  end if;
  delete from match_hole;
  update round set state = 'upcoming';
end $$ language plpgsql security definer;

revoke execute on function reset_event() from anon, public;
grant execute on function reset_event() to authenticated;

-- Realtime for settings changes so every phone follows along.
do $$
begin
  alter publication supabase_realtime add table round;
exception when duplicate_object then null;
end $$;

do $$
begin
  alter publication supabase_realtime add table match;
exception when duplicate_object then null;
end $$;
