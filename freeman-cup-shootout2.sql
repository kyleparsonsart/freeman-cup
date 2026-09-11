-- =====================================================================
--  THE FREEMAN CUP 2026: shootout replays (Sep 11)
--  Paste into the Supabase SQL editor and run once.
--  Companion to freeman-cup-shootout.sql; the record of what ran.
-- =====================================================================

-- Level after three stations and the Knee Knocker replays as extra
-- entries, so a shootout may carry three or more strokes a side, always
-- the same number each.
create or replace function set_shootout(s jsonb) returns void as $$
begin
  if not is_commissioner() then
    raise exception 'commissioner only';
  end if;
  if s is not null then
    if jsonb_typeof(s->'a') <> 'array' or jsonb_typeof(s->'b') <> 'array'
       or jsonb_array_length(s->'a') < 3
       or jsonb_array_length(s->'a') <> jsonb_array_length(s->'b') then
      raise exception 'shootout needs at least three strokes a side, the same number each';
    end if;
  end if;
  update event set shootout = s;
end $$ language plpgsql security definer;
