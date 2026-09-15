-- =====================================================================
--  THE FREEMAN CUP 2026: pre-mortem fixes (Sep 15)
--  Paste into the Supabase SQL editor and run once, after autolive.sql.
--  Companion to freeman-cup-schema.sql; the record of what ran.
-- =====================================================================

-- ---------------------------------------------------------------------
-- B5. A player could update his own player row, any column, including
-- is_commissioner and is_captain. Claiming a seat goes through the
-- definer claim_seat(), so the self-update branch was never needed.
-- ---------------------------------------------------------------------
drop policy if exists commish_players on player;
create policy commish_players on player for update to authenticated
  using (is_commissioner()) with check (is_commissioner());

-- ---------------------------------------------------------------------
-- B6. Any group member could update any tee_group column, including
-- submitted_at (un-handing a card past the commissioner). The handoff
-- is only ever about the scorer; everything else is the commissioner's.
-- ---------------------------------------------------------------------
drop policy if exists handoff on tee_group;
create policy handoff on tee_group for update to authenticated
  using (is_commissioner() or exists (
    select 1 from match mt
    where mt.tee_group_id = tee_group.id
      and (me() = any(mt.side_a) or me() = any(mt.side_b))))
  with check (is_commissioner() or exists (
    select 1 from match mt
    where mt.tee_group_id = tee_group.id
      and (me() = any(mt.side_a) or me() = any(mt.side_b))));

-- a trigger rather than column grants: the commissioner edits tee times
-- from the desk with the same role, so the rule is "non-commissioners
-- may change the scorer and nothing else"
create or replace function tee_group_guard() returns trigger as $$
begin
  -- submit_card, reopen_card, the resets and build_round_matches run as
  -- their owner (security definer), not as the authenticated role
  if current_user <> 'authenticated' then return new; end if;
  if is_commissioner() then return new; end if;
  if new.round_id      is distinct from old.round_id
  or new.seq           is distinct from old.seq
  or new.tee_time      is distinct from old.tee_time
  or new.submitted_at  is distinct from old.submitted_at
  or new.submitted_by  is distinct from old.submitted_by then
    raise exception 'only the scorer can change from here';
  end if;
  return new;
end $$ language plpgsql security definer set search_path = public;

drop trigger if exists tee_group_guard on tee_group;
create trigger tee_group_guard before update on tee_group
  for each row execute function tee_group_guard();

-- ---------------------------------------------------------------------
-- C1. A reset after a round's 9 pm deadline re-posted that round with
-- default lineups the moment any phone rendered the Scoring tab. A reset
-- now gives the round an hour of grace before the deadline can settle
-- it, so the commissioner can Send with the real sheets (or seal for a
-- captain) first.
-- ---------------------------------------------------------------------
alter table round add column if not exists settle_after timestamptz;

create or replace function sheet_settle(r uuid) returns void as $$
declare
  t record;
begin
  if exists (select 1 from match where round_id = r) then return; end if;
  if now() < sheet_due(r) then return; end if;
  if now() < coalesce((select settle_after from round where id = r), now()) then return; end if;
  for t in select id from team where event_id = (select event_id from round where id = r) loop
    insert into captain_sheet (round_id, team_id, slots, auto)
    select r, t.id, default_slots(r, t.id), true
     where not exists (select 1 from captain_sheet where round_id = r and team_id = t.id);
  end loop;
  update round set revealed_at = coalesce(revealed_at, now()) where id = r;
  update captain_sheet set opened_at = coalesce(opened_at, now()) where round_id = r;
  perform build_round_matches(r);
end $$ language plpgsql;

create or replace function reveal_sheets(r uuid) returns void as $$
declare
  t record;
begin
  if not is_commissioner() then raise exception 'commissioner only'; end if;
  if exists (select 1 from match where round_id = r) then return; end if;
  if (select count(*) from captain_sheet where round_id = r) < 2 then
    if now() < sheet_due(r) or now() < coalesce((select settle_after from round where id = r), now()) then
      raise exception 'both sheets are needed first';
    end if;
    for t in select id from team where event_id = (select event_id from round where id = r) loop
      insert into captain_sheet (round_id, team_id, slots, auto)
      select r, t.id, default_slots(r, t.id), true
       where not exists (select 1 from captain_sheet where round_id = r and team_id = t.id);
    end loop;
  end if;
  update round set revealed_at = coalesce(revealed_at, now()) where id = r;
  update captain_sheet set opened_at = coalesce(opened_at, now()) where round_id = r;
  perform build_round_matches(r);
end $$ language plpgsql security definer;

-- Start over: also keeps the email send-log, so a "Send to everyone"
-- already sent (the week-out mail) is not re-armed by a rehearsal clear.
create or replace function reset_event() returns void as $$
begin
  if not is_commissioner() then
    raise exception 'commissioner only';
  end if;
  delete from match_hole where true;
  delete from feed_event where kind <> 'mail_sent';
  delete from captain_sheet where true;
  delete from match where true;
  update round set state = 'upcoming', revealed_at = null, auto_live_at = null,
                   settle_after = now() + interval '1 hour' where true;
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
    update round set state = 'upcoming', revealed_at = null, auto_live_at = null,
                     settle_after = now() + interval '1 hour' where id = x.id;
  end loop;
end $$ language plpgsql security definer;

-- ---------------------------------------------------------------------
-- Check: every line should come back true.
-- ---------------------------------------------------------------------
select
  (select count(*) = 1 from pg_policies where tablename = 'player' and policyname = 'commish_players'
     and qual not like '%auth_uid%') as player_policy_tight,
  (select count(*) = 1 from pg_trigger where tgname = 'tee_group_guard') as tee_group_guarded,
  (select count(*) = 1 from information_schema.columns where table_name = 'round' and column_name = 'settle_after') as settle_after_column,
  (select prosrc like '%settle_after%' from pg_proc where proname = 'sheet_settle') as settle_guarded,
  (select prosrc like '%mail_sent%' from pg_proc where proname = 'reset_event') as reset_keeps_mail_log;
