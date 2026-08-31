-- =====================================================================
--  THE FREEMAN CUP 2026 — Sprint 2 scorer handoff
--  Paste into the Supabase SQL editor and run once.
--  Companion to freeman-cup-schema.sql; the record of what ran.
-- =====================================================================

-- Every change of scorer is logged to the feed, so the group always
-- knows who is holding the pencil and an argument on Saturday is settled
-- by looking. Runs as definer: clients have no insert policy on feed_event.
create or replace function log_scorer_handoff() returns trigger as $$
declare
  v_event uuid;
begin
  if new.scorer_player_id is distinct from old.scorer_player_id then
    select event_id into v_event from round where id = new.round_id;
    insert into feed_event (event_id, round_id, kind, tier, body)
    values (
      v_event, new.round_id, 'scorer_switch', 'none',
      jsonb_build_object(
        'tee_group_id', new.id,
        'seq',          new.seq,
        'from',         old.scorer_player_id,
        'to',           new.scorer_player_id,
        'by',           me()
      )
    );
  end if;
  return new;
end $$ language plpgsql security definer;

drop trigger if exists tee_group_handoff_trg on tee_group;
create trigger tee_group_handoff_trg
  after update on tee_group
  for each row execute function log_scorer_handoff();

-- Other phones in the group need to see the lock flip and the feed line
-- without a refresh. match_hole is already published; add these two.
do $$
begin
  alter publication supabase_realtime add table tee_group;
exception when duplicate_object then null;
end $$;

do $$
begin
  alter publication supabase_realtime add table feed_event;
exception when duplicate_object then null;
end $$;
