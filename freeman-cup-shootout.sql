-- =====================================================================
--  THE FREEMAN CUP 2026 — Captains Shootout + recap moments
--  Paste into the Supabase SQL editor and run once.
--  Companion to freeman-cup-schema.sql; the record of what ran.
-- =====================================================================

-- The shootout lives on the event row as one jsonb blob:
--   { "a": [3,2,1], "b": [2,2,2], "done": true }
-- a/b are the captains' strokes on the three practice-green holes.
-- Null means no shootout (the normal case). Only the commissioner
-- writes it, through the RPC below, after the putts are actually holed.
alter table event add column if not exists shootout jsonb;

create or replace function set_shootout(s jsonb) returns void as $$
begin
  if not is_commissioner() then
    raise exception 'commissioner only';
  end if;
  if s is not null then
    if jsonb_typeof(s->'a') <> 'array' or jsonb_typeof(s->'b') <> 'array'
       or jsonb_array_length(s->'a') <> 3 or jsonb_array_length(s->'b') <> 3 then
      raise exception 'shootout needs three strokes a side';
    end if;
  end if;
  update event set shootout = s;
end $$ language plpgsql security definer;

revoke execute on function set_shootout(jsonb) from anon, public;
grant execute on function set_shootout(jsonb) to authenticated;

-- The pre-Thursday reset also clears any test shootout.
create or replace function reset_event() returns void as $$
begin
  if not is_commissioner() then
    raise exception 'commissioner only';
  end if;
  delete from match_hole;
  update round set state = 'upcoming';
  update event set shootout = null;
end $$ language plpgsql security definer;

-- Realtime on event so every phone sees the shootout land.
do $$
begin
  alter publication supabase_realtime add table event;
exception when duplicate_object then null;
end $$;
