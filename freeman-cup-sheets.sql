-- The captain's sheet (Sep 7 2026).
--
-- The night before a round each captain seals his lineup in the app.
-- When both are in, the commissioner taps Reveal and each captain gets
-- an envelope holding his OWN sheet, to read aloud to the table.
-- When both envelopes are opened the matches for the round are built,
-- slot to slot, and the round is public. A 9:00 pm deadline (the night
-- before, Sand Valley time) fills in a missing sheet with the default
-- lineup, reveals, opens, and builds, so one slow captain never holds
-- up a round.
--
-- Matches are no longer seeded. "Clear all scores" in Settings (reset_event)
-- now clears the seeded pairings too, so run it once before the trip and
-- the sheets take over from there. Until you do, the seeded pairings stand
-- and the app behaves exactly as before: the sheet only appears for a
-- round that has no matches.
--
-- Run in the Supabase SQL editor after the other freeman-cup-*.sql files.

create table if not exists captain_sheet (
  id         uuid primary key default gen_random_uuid(),
  round_id   uuid not null references round(id) on delete cascade,
  team_id    uuid not null references team(id),
  slots      jsonb not null,            -- [[pid,pid],[pid,pid]] or [[pid],[pid],[pid],[pid]]
  sealed_at  timestamptz not null default now(),
  sealed_by  uuid references player(id),
  auto       boolean not null default false,   -- filled in by the deadline
  opened_at  timestamptz,               -- when the opposing captain opened it
  opened_by  uuid references player(id),
  unique (round_id, team_id)
);

alter table round add column if not exists revealed_at timestamptz;

alter table captain_sheet enable row level security;

-- Who may read a sheet: its own captain always; everyone once the
-- matches exist. Nobody reads the other side's lineup before it's read
-- aloud. Metadata for the "who has sealed" card comes from
-- sheet_status() below, which carries no lineups.
create or replace function my_captain_team() returns uuid as $$
  select team_id from player where auth_uid = auth.uid() and is_captain limit 1;
$$ language sql stable security definer;

drop policy if exists sheet_read on captain_sheet;
create policy sheet_read on captain_sheet for select to authenticated using (
  team_id = my_captain_team()
  or exists (select 1 from match where match.round_id = captain_sheet.round_id)
);
-- no insert/update/delete policy: writes go through the functions below.

create or replace function sheet_status()
returns table (round_id uuid, team_id uuid, sealed_at timestamptz, auto boolean, opened_at timestamptz) as $$
  select round_id, team_id, sealed_at, auto, opened_at from captain_sheet;
$$ language sql stable security definer;

-- 9:00 pm the evening before, course time. A second round on the same
-- day (Friday afternoon) can't be sealed until the morning round has
-- posted, so its deadline is 90 minutes before its first tee instead.
create or replace function sheet_due(r uuid) returns timestamptz as $$
  select case
    when exists (select 1 from round x where x.event_id = me.event_id and x.play_date = me.play_date and x.seq < me.seq)
      then (me.play_date::timestamp + (select min(tee_time) from tee_group where round_id = me.id) - interval '90 minutes')
           at time zone 'America/Chicago'
    else ((me.play_date - 1)::timestamp + time '21:00') at time zone 'America/Chicago'
  end
  from round me where me.id = r;
$$ language sql stable;

-- Pairs this team has already used in earlier team rounds.
create or replace function used_pairs(t uuid, r uuid)
returns table (p1 uuid, p2 uuid) as $$
  with me_side as (select side from team where id = t),
       earlier as (
         select m.* from match m join round x on x.id = m.round_id
          where x.event_id = (select event_id from round where id = r)
            and x.seq < (select seq from round where id = r)
            and x.format <> 'singles')
  select least(s[1], s[2]), greatest(s[1], s[2])
    from earlier e,
         lateral (select case when (select side from me_side) = 'a' then e.side_a else e.side_b end) as q(s)
   where array_length(s, 1) = 2;
$$ language sql stable;

-- The lineup a slow captain gets: for team rounds the first unused
-- pairing with the pairs in roster order, for singles the roster order.
create or replace function default_slots(r uuid, t uuid) returns jsonb as $$
declare
  ps uuid[];
  fmt text;
  cand uuid[][];
  i int;
begin
  select format into fmt from round where id = r;
  select array_agg(id order by name) into ps from player where team_id = t;
  if fmt = 'singles' then
    return (select jsonb_agg(jsonb_build_array(p)) from unnest(ps) as p);
  end if;
  if array_length(ps, 1) <> 4 then
    raise exception 'team needs four players for a team round';
  end if;
  -- the three ways to split four into pairs, first player anchored
  cand := array[
    array[array[ps[1], ps[2]], array[ps[3], ps[4]]],
    array[array[ps[1], ps[3]], array[ps[2], ps[4]]],
    array[array[ps[1], ps[4]], array[ps[2], ps[3]]]
  ];
  for i in 1..3 loop
    if not exists (
      select 1 from used_pairs(t, r) u
       where (u.p1, u.p2) in ((least(cand[i][1][1], cand[i][1][2]), greatest(cand[i][1][1], cand[i][1][2])),
                              (least(cand[i][2][1], cand[i][2][2]), greatest(cand[i][2][1], cand[i][2][2])))
    ) then
      return jsonb_build_array(
        jsonb_build_array(cand[i][1][1], cand[i][1][2]),
        jsonb_build_array(cand[i][2][1], cand[i][2][2]));
    end if;
  end loop;
  raise exception 'no unused pairing left for this team';
end $$ language plpgsql stable;

-- A sheet is two pairs covering the team (team rounds) or four singles,
-- every player on the team, no pair reused from an earlier round.
create or replace function validate_slots(r uuid, t uuid, slots jsonb) returns void as $$
declare
  fmt text;
  n int;
  want int;
  all_ids uuid[];
  slot jsonb;
  ids uuid[];
begin
  select format into fmt from round where id = r;
  if jsonb_typeof(slots) <> 'array' then raise exception 'slots must be an array'; end if;
  n := jsonb_array_length(slots);
  want := case when fmt = 'singles' then 1 else 2 end;
  if (fmt = 'singles' and n <> 4) or (fmt <> 'singles' and n <> 2) then
    raise exception 'wrong number of slots for %', fmt;
  end if;
  all_ids := array[]::uuid[];
  for slot in select * from jsonb_array_elements(slots) loop
    if jsonb_typeof(slot) <> 'array' or jsonb_array_length(slot) <> want then
      raise exception 'each slot needs % player(s)', want;
    end if;
    ids := array(select (jsonb_array_elements_text(slot))::uuid);
    all_ids := all_ids || ids;
    if want = 2 and exists (
      select 1 from used_pairs(t, r) u
       where u.p1 = least(ids[1], ids[2]) and u.p2 = greatest(ids[1], ids[2])
    ) then
      raise exception 'that pair has already played together';
    end if;
  end loop;
  if (select count(distinct x) from unnest(all_ids) x) <> array_length(all_ids, 1) then
    raise exception 'a player appears twice';
  end if;
  if (select count(*) from player where team_id = t) <> array_length(all_ids, 1)
     or exists (select 1 from unnest(all_ids) x where not exists (select 1 from player where id = x and team_id = t)) then
    raise exception 'the sheet must name every player on the team once';
  end if;
end $$ language plpgsql stable;

-- Builds the round's matches from the two sheets, slot to slot.
-- Vikes (side a) fill side_a, Celts (side b) fill side_b. Team rounds:
-- slot i is match i in tee group i. Singles: matches 1 and 2 in group 1,
-- 3 and 4 in group 2.
create or replace function build_round_matches(r uuid) returns void as $$
declare
  ev uuid;
  a_slots jsonb;
  b_slots jsonb;
  n int;
  i int;
  tg uuid;
  tgs uuid[];
  fmt text;
begin
  if exists (select 1 from match where round_id = r) then return; end if;
  select event_id, format into ev, fmt from round where id = r;
  select s.slots into a_slots from captain_sheet s join team t on t.id = s.team_id
   where s.round_id = r and t.side = 'a';
  select s.slots into b_slots from captain_sheet s join team t on t.id = s.team_id
   where s.round_id = r and t.side = 'b';
  if a_slots is null or b_slots is null then raise exception 'both sheets are needed'; end if;
  select array_agg(id order by seq) into tgs from tee_group where round_id = r;
  if tgs is null then raise exception 'the round has no tee groups'; end if;
  n := jsonb_array_length(a_slots);
  for i in 1..n loop
    tg := case when fmt = 'singles' then tgs[least(((i + 1) / 2), array_length(tgs, 1))]
               else tgs[least(i, array_length(tgs, 1))] end;
    insert into match (round_id, tee_group_id, seq, side_a, side_b)
    values (r, tg, i,
      array(select (jsonb_array_elements_text(a_slots -> (i - 1)))::uuid),
      array(select (jsonb_array_elements_text(b_slots -> (i - 1)))::uuid));
  end loop;
  -- The pencil: a seeded scorer who isn't in his group any more can't hold
  -- it. Keep him if he is; otherwise the first Celt in the group's first
  -- match holds it until the group hands it on.
  update tee_group g
     set scorer_player_id = coalesce(
       (select g.scorer_player_id where exists (
          select 1 from match m where m.tee_group_id = g.id
             and (g.scorer_player_id = any(m.side_a) or g.scorer_player_id = any(m.side_b)))),
       (select m.side_b[1] from match m where m.tee_group_id = g.id order by m.seq limit 1))
   where g.round_id = r;
end $$ language plpgsql;

-- Past the deadline: fill what's missing, reveal, open, build. Safe to
-- call any time; does nothing before the deadline or once matches exist.
create or replace function sheet_settle(r uuid) returns void as $$
declare
  t record;
begin
  if exists (select 1 from match where round_id = r) then return; end if;
  if now() < sheet_due(r) then return; end if;
  for t in select id from team where event_id = (select event_id from round where id = r) loop
    insert into captain_sheet (round_id, team_id, slots, auto)
    select r, t.id, default_slots(r, t.id), true
     where not exists (select 1 from captain_sheet where round_id = r and team_id = t.id);
  end loop;
  update round set revealed_at = coalesce(revealed_at, now()) where id = r;
  update captain_sheet set opened_at = coalesce(opened_at, now()) where round_id = r;
  perform build_round_matches(r);
end $$ language plpgsql;

-- The captain seals his lineup. One shot; a sealed sheet cannot change.
create or replace function seal_sheet(r uuid, slots jsonb) returns void as $$
declare
  t uuid;
begin
  t := my_captain_team();
  if t is null then raise exception 'captains only'; end if;
  if exists (select 1 from match where round_id = r) then raise exception 'pairings are already posted'; end if;
  -- the rotation check reads earlier matches, so earlier rounds must be posted first
  if exists (select 1 from round x where x.event_id = (select event_id from round where id = r)
               and x.seq < (select seq from round where id = r)
               and not exists (select 1 from match where round_id = x.id)) then
    raise exception 'the earlier round has to post first';
  end if;
  if exists (select 1 from captain_sheet where round_id = r and team_id = t) then
    raise exception 'your sheet is already sealed';
  end if;
  perform validate_slots(r, t, slots);
  insert into captain_sheet (round_id, team_id, slots, sealed_by) values (r, t, slots, me());
end $$ language plpgsql security definer;

-- The commissioner hands out the envelopes. Needs both sheets, unless
-- the deadline has passed, in which case the missing one is defaulted.
create or replace function reveal_sheets(r uuid) returns void as $$
declare
  t record;
begin
  if not is_commissioner() then raise exception 'commissioner only'; end if;
  if exists (select 1 from match where round_id = r) then return; end if;
  if (select count(*) from captain_sheet where round_id = r) < 2 then
    if now() < sheet_due(r) then raise exception 'both sheets are needed first'; end if;
    for t in select id from team where event_id = (select event_id from round where id = r) loop
      insert into captain_sheet (round_id, team_id, slots, auto)
      select r, t.id, default_slots(r, t.id), true
       where not exists (select 1 from captain_sheet where round_id = r and team_id = t.id);
    end loop;
  end if;
  update round set revealed_at = coalesce(revealed_at, now()) where id = r;
end $$ language plpgsql security definer;

-- A captain opens his envelope, which holds his own sheet, and reads
-- it to the table. The second opening builds the matches.
create or replace function open_envelope(r uuid) returns void as $$
declare
  t uuid;
begin
  t := my_captain_team();
  if t is null then raise exception 'captains only'; end if;
  if (select revealed_at from round where id = r) is null then raise exception 'not revealed yet'; end if;
  update captain_sheet set opened_at = coalesce(opened_at, now()), opened_by = coalesce(opened_by, me())
   where round_id = r and team_id = t;
  if (select count(*) from captain_sheet where round_id = r and opened_at is not null) = 2 then
    perform build_round_matches(r);
  end if;
end $$ language plpgsql security definer;

-- The safety valve: the commissioner unseals a sheet (a fat-fingered
-- seal, a captain who changed his mind before the reveal). Only while
-- the round has no matches. If the envelopes were already out, they go
-- back in: the reveal is undone and both sheets are marked unopened.
create or replace function unseal_sheet(r uuid, t uuid) returns void as $$
begin
  if not is_commissioner() then raise exception 'commissioner only'; end if;
  if exists (select 1 from match where round_id = r) then raise exception 'pairings are already posted'; end if;
  delete from captain_sheet where round_id = r and team_id = t;
  update round set revealed_at = null where id = r;
  update captain_sheet set opened_at = null, opened_by = null where round_id = r;
end $$ language plpgsql security definer;

-- Rehearsal tools, commissioner only: stand in for the other captain.
-- seal_for seals a team's sheet with the default lineup; open_for opens
-- that team's envelope. Both go through the same checks as the real thing.
create or replace function commish_seal_for(r uuid, t uuid) returns void as $$
begin
  if not is_commissioner() then raise exception 'commissioner only'; end if;
  if exists (select 1 from match where round_id = r) then raise exception 'pairings are already posted'; end if;
  if exists (select 1 from captain_sheet where round_id = r and team_id = t) then raise exception 'already sealed'; end if;
  perform validate_slots(r, t, default_slots(r, t));
  insert into captain_sheet (round_id, team_id, slots, sealed_by) values (r, t, default_slots(r, t), me());
end $$ language plpgsql security definer;

create or replace function commish_open_for(r uuid, t uuid) returns void as $$
begin
  if not is_commissioner() then raise exception 'commissioner only'; end if;
  if (select revealed_at from round where id = r) is null then raise exception 'not revealed yet'; end if;
  update captain_sheet set opened_at = coalesce(opened_at, now()), opened_by = coalesce(opened_by, me())
   where round_id = r and team_id = t;
  if (select count(*) from captain_sheet where round_id = r and opened_at is not null) = 2 then
    perform build_round_matches(r);
  end if;
end $$ language plpgsql security definer;

-- Anyone may nudge the deadline path (the app does on open after 9 pm).
create or replace function sheet_tick(r uuid) returns void as $$
begin
  if auth.uid() is null then raise exception 'sign in first'; end if;
  perform sheet_settle(r);
end $$ language plpgsql security definer;

revoke all on function build_round_matches(uuid) from public, anon, authenticated;
revoke all on function sheet_settle(uuid) from public, anon, authenticated;
revoke all on function default_slots(uuid, uuid) from public, anon, authenticated;
revoke all on function validate_slots(uuid, uuid, jsonb) from public, anon, authenticated;
revoke all on function used_pairs(uuid, uuid) from public, anon, authenticated;
grant execute on function seal_sheet(uuid, jsonb), reveal_sheets(uuid), open_envelope(uuid), unseal_sheet(uuid, uuid),
  commish_seal_for(uuid, uuid), commish_open_for(uuid, uuid),
  sheet_tick(uuid), sheet_status(), sheet_due(uuid), my_captain_team() to authenticated;

-- Realtime: sheets and new matches reach every phone. Sheet rows are
-- RLS-filtered on the wire, so a seal also nudges the round row, which
-- everyone can see; the app reloads on any round change.
do $$
begin
  alter publication supabase_realtime add table captain_sheet;
exception when duplicate_object then null;
end $$;

create or replace function nudge_round_on_sheet() returns trigger as $$
begin
  update round set locked = locked where id = new.round_id;
  return new;
end $$ language plpgsql security definer;

drop trigger if exists sheet_nudge on captain_sheet;
create trigger sheet_nudge after insert or update on captain_sheet
  for each row execute function nudge_round_on_sheet();

-- Reset now clears pairings too (they come back through the sheets).
create or replace function reset_event() returns void as $$
begin
  if not is_commissioner() then
    raise exception 'commissioner only';
  end if;
  delete from match_hole where true;
  delete from feed_event where true;
  delete from captain_sheet where true;
  delete from match where true;
  update round set state = 'upcoming', revealed_at = null where true;
  update event set shootout = null where true;
  update tee_group set submitted_at = null, submitted_by = null where true;
end $$ language plpgsql security definer;

-- (To drop only the pairings without touching anything else:
--  delete from match where true;   -- scores go with them, cascade)
