-- =====================================================================
--  THE FREEMAN CUP 2026 — handing in the card
--  Paste into the Supabase SQL editor and run once.
--  Companion to freeman-cup-schema.sql; the record of what ran.
-- =====================================================================

-- The signed-card rule: when the scorer submits, the tee group's card
-- is in and its scores lock for everyone but the commissioner. The
-- round-level lock (round.state = final) still sits above this.
alter table tee_group add column if not exists submitted_at timestamptz;
alter table tee_group add column if not exists submitted_by uuid references player(id);

-- Scoring now also requires the card to still be open. Recreated from
-- the schema version with the one extra condition.
create or replace function scores_this_match(m uuid) returns boolean as $$
  select exists (
    select 1
    from match mt
    join tee_group tg on tg.id = mt.tee_group_id
    join round r      on r.id  = mt.round_id
    where mt.id = m
      and tg.scorer_player_id = me()
      and r.locked = false
      and tg.submitted_at is null
  );
$$ language sql stable security definer;

-- The scorer (or the commissioner) hands the card in; only the
-- commissioner reopens it.
create or replace function submit_card(tg uuid) returns void as $$
begin
  if not (is_commissioner() or exists (
    select 1 from tee_group where id = tg and scorer_player_id = me()
  )) then
    raise exception 'only the scorer hands in this card';
  end if;
  update tee_group
     set submitted_at = now(), submitted_by = me()
   where id = tg and submitted_at is null;
end $$ language plpgsql security definer;

create or replace function reopen_card(tg uuid) returns void as $$
begin
  if not is_commissioner() then
    raise exception 'commissioner only';
  end if;
  update tee_group set submitted_at = null, submitted_by = null where id = tg;
end $$ language plpgsql security definer;

revoke execute on function submit_card(uuid) from anon, public;
grant execute on function submit_card(uuid) to authenticated;
revoke execute on function reopen_card(uuid) from anon, public;
grant execute on function reopen_card(uuid) to authenticated;

-- The card coming home is news: log it to the feed the way scorer
-- switches are logged. A reopen is a correction, not news — no line.
create or replace function log_card_in() returns trigger as $$
declare
  v_event uuid;
begin
  if new.submitted_at is not null and old.submitted_at is null then
    select event_id into v_event from round where id = new.round_id;
    insert into feed_event (event_id, round_id, kind, tier, body)
    values (
      v_event, new.round_id, 'card_in', 'none',
      jsonb_build_object(
        'tee_group_id', new.id,
        'seq',          new.seq,
        'by',           coalesce(new.submitted_by, me())
      )
    );
  end if;
  return new;
end $$ language plpgsql security definer;

drop trigger if exists tee_group_card_in_trg on tee_group;
create trigger tee_group_card_in_trg
  after update on tee_group
  for each row execute function log_card_in();

-- The pre-Thursday reset also reopens every card.
create or replace function reset_event() returns void as $$
begin
  if not is_commissioner() then
    raise exception 'commissioner only';
  end if;
  delete from match_hole;
  update round set state = 'upcoming';
  update event set shootout = null;
  update tee_group set submitted_at = null, submitted_by = null;
end $$ language plpgsql security definer;
