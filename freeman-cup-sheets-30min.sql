-- =====================================================================
--  THE FREEMAN CUP 2026: Round 3's sheet is due 30 minutes before its
--  first tee, not 90 (Oct 9). Paste into the Supabase SQL editor and run
--  once. Mirrors sheetDue in src/lib/sheets.ts.
-- =====================================================================
create or replace function sheet_due(r uuid) returns timestamptz as $$
  select case
    when exists (select 1 from round x where x.event_id = me.event_id and x.play_date = me.play_date and x.seq < me.seq)
      then (me.play_date::timestamp + (select min(tee_time) from tee_group where round_id = me.id) - interval '30 minutes')
           at time zone 'America/Chicago'
    else ((me.play_date - 1)::timestamp + time '21:00') at time zone 'America/Chicago'
  end
  from round me where me.id = r;
$$ language sql stable;

-- check: Round 3 should read 2026-10-09 12:40 (Chicago), Round 2 10-08 21:00
select seq, label, sheet_due(id) at time zone 'America/Chicago' as due_chicago
from round where seq in (2, 3) order by seq;
