-- =====================================================================
--  THE FREEMAN CUP 2026: Friday's two sheets together (Sep 11)
--  Paste into the Supabase SQL editor and run once.
--  Companion to freeman-cup-sheets.sql; the record of what ran.
-- =====================================================================

-- A captain may seal Round 3 as soon as his own Round 2 sheet is sealed,
-- without waiting for Round 2 to post. The rotation check therefore
-- counts his own sealed sheets for earlier rounds as pairs already used.

create or replace function used_pairs(t uuid, r uuid)
returns table (p1 uuid, p2 uuid) as $$
  with me_side as (select side from team where id = t),
       earlier_rounds as (
         select x.id from round x
          where x.event_id = (select event_id from round where id = r)
            and x.seq < (select seq from round where id = r)
            and x.format <> 'singles'),
       from_matches as (
         select least(s[1], s[2]) as p1, greatest(s[1], s[2]) as p2
           from match m
           join earlier_rounds x on x.id = m.round_id,
           lateral (select case when (select side from me_side) = 'a' then m.side_a else m.side_b end) as q(s)
          where array_length(s, 1) = 2),
       from_sheets as (
         select least(a, b) as p1, greatest(a, b) as p2
           from captain_sheet cs
           join earlier_rounds x on x.id = cs.round_id,
           lateral (select (slot->>0)::uuid as a, (slot->>1)::uuid as b
                      from jsonb_array_elements(cs.slots) as slot
                     where jsonb_array_length(slot) = 2) as q
          where cs.team_id = t)
  select p1, p2 from from_matches
  union
  select p1, p2 from from_sheets;
$$ language sql stable;

create or replace function seal_sheet(r uuid, slots jsonb) returns void as $$
declare
  t uuid;
begin
  t := my_captain_team();
  if t is null then raise exception 'captains only'; end if;
  if exists (select 1 from match where round_id = r) then raise exception 'pairings are already posted'; end if;
  -- every earlier team round must be posted, or sealed by this captain
  if (select format from round where id = r) <> 'singles' and exists (
       select 1 from round x
        where x.event_id = (select event_id from round where id = r)
          and x.seq < (select seq from round where id = r)
          and not exists (select 1 from match where round_id = x.id)
          and not exists (select 1 from captain_sheet where round_id = x.id and team_id = t)) then
    raise exception 'seal the earlier round first';
  end if;
  if exists (select 1 from captain_sheet where round_id = r and team_id = t) then
    raise exception 'your sheet is already sealed';
  end if;
  perform validate_slots(r, t, slots);
  insert into captain_sheet (round_id, team_id, slots, sealed_by) values (r, t, slots, me());
end $$ language plpgsql security definer;
