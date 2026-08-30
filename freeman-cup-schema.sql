-- =====================================================================
--  THE FREEMAN CUP 2026
--  Schema + seed. Paste into the Supabase SQL editor and run once.
--  Course data transcribed from the Sand Valley scorecards, Aug 30 2026.
-- =====================================================================

-- ---------- extensions ----------
create extension if not exists "pgcrypto";

-- ---------- tables ----------

create table event (
  id            uuid primary key default gen_random_uuid(),
  name          text not null,
  year          int  not null,
  trophy        text not null,
  venue         text not null,
  clinch_points numeric(4,1) not null,
  created_at    timestamptz not null default now()
);

create table team (
  id        uuid primary key default gen_random_uuid(),
  event_id  uuid not null references event(id) on delete cascade,
  side      char(1) not null check (side in ('a','b')),   -- a = red, b = blue
  name      text not null,
  short     text not null,
  unique (event_id, side)
);

create table player (
  id             uuid primary key default gen_random_uuid(),
  event_id       uuid not null references event(id) on delete cascade,
  team_id        uuid not null references team(id),
  name           text not null,
  handicap_index numeric(4,1) not null,
  is_captain     boolean not null default false,
  is_commissioner boolean not null default false,
  email          text not null,
  auth_uid       uuid unique,                              -- null until they claim the seat
  unique (event_id, email)
);

create table course (
  id           uuid primary key default gen_random_uuid(),
  name         text not null unique,
  holes        int  not null,
  par          int[] not null,
  stroke_index int[] not null,
  constraint par_len   check (array_length(par,1) = holes),
  constraint si_len    check (array_length(stroke_index,1) = holes)
);

create table round (
  id        uuid primary key default gen_random_uuid(),
  event_id  uuid not null references event(id) on delete cascade,
  seq       int  not null,
  label     text not null,
  play_date date not null,
  format    text not null check (format in ('four-ball','foursomes','singles')),
  course_id uuid not null references course(id),
  holes     int  not null,
  locked    boolean not null default false,               -- commissioner-only edits after this
  unique (event_id, seq)
);

create table tee_group (
  id               uuid primary key default gen_random_uuid(),
  round_id         uuid not null references round(id) on delete cascade,
  seq              int not null,
  tee_time         time not null,
  scorer_player_id uuid references player(id),
  unique (round_id, seq)
);

create table match (
  id           uuid primary key default gen_random_uuid(),
  round_id     uuid not null references round(id) on delete cascade,
  tee_group_id uuid not null references tee_group(id) on delete cascade,
  seq          int not null,
  side_a       uuid[] not null,                            -- player ids
  side_b       uuid[] not null,
  odds_a       uuid,                                       -- foursomes: who tees off on odds
  odds_b       uuid,
  unique (round_id, seq)
);

-- one row per hole. this is the whole sync design: upsert, never replace an array.
create table match_hole (
  match_id   uuid not null references match(id) on delete cascade,
  hole       int  not null check (hole between 1 and 18),
  result     char(1) check (result in ('A','B','H')),
  scores     jsonb not null default '{}'::jsonb,           -- {player_id|side: int|"X"}
  derived    boolean not null default true,                -- false once a human overrides
  entered_by uuid references player(id),
  updated_at timestamptz not null default now(),
  primary key (match_id, hole)
);

-- every write is kept, so an argument on Saturday is settled by looking
create table match_hole_history (
  id          bigserial primary key,
  match_id    uuid not null,
  hole        int  not null,
  old_result  char(1),
  new_result  char(1),
  old_scores  jsonb,
  new_scores  jsonb,
  changed_by  uuid references player(id),
  changed_at  timestamptz not null default now()
);

create table feed_event (
  id         bigserial primary key,
  event_id   uuid not null references event(id) on delete cascade,
  round_id   uuid references round(id),
  match_id   uuid references match(id),
  kind       text not null,          -- hole_won | match_final | lead_change | broadcast | ...
  tier       text not null           -- none | other_group | all
               check (tier in ('none','other_group','all')),
  body       jsonb not null,
  occurred_at timestamptz not null default now()
);

create table push_subscription (
  id         bigserial primary key,
  player_id  uuid not null references player(id) on delete cascade,
  endpoint   text not null unique,
  keys       jsonb not null,
  created_at timestamptz not null default now()
);

create index on match_hole (match_id);
create index on feed_event (event_id, occurred_at desc);

-- ---------- history trigger ----------
create or replace function log_match_hole() returns trigger as $$
begin
  insert into match_hole_history(match_id,hole,old_result,new_result,old_scores,new_scores,changed_by)
  values (new.match_id, new.hole,
          case when tg_op='UPDATE' then old.result end, new.result,
          case when tg_op='UPDATE' then old.scores end, new.scores,
          new.entered_by);
  new.updated_at := now();
  return new;
end $$ language plpgsql security definer;

create trigger match_hole_history_trg
  before insert or update on match_hole
  for each row execute function log_match_hole();

-- ---------- helpers used by the policies ----------
create or replace function me() returns uuid as $$
  select id from player where auth_uid = auth.uid() limit 1;
$$ language sql stable security definer;

create or replace function is_commissioner() returns boolean as $$
  select coalesce((select is_commissioner from player where auth_uid = auth.uid()), false);
$$ language sql stable security definer;

create or replace function scores_this_match(m uuid) returns boolean as $$
  select exists (
    select 1
    from match mt
    join tee_group tg on tg.id = mt.tee_group_id
    join round r      on r.id  = mt.round_id
    where mt.id = m
      and tg.scorer_player_id = me()
      and r.locked = false
  );
$$ language sql stable security definer;

-- ---------- RLS ----------
alter table event      enable row level security;
alter table team       enable row level security;
alter table player     enable row level security;
alter table course     enable row level security;
alter table round      enable row level security;
alter table tee_group  enable row level security;
alter table match      enable row level security;
alter table match_hole enable row level security;
alter table match_hole_history enable row level security;
alter table feed_event enable row level security;
alter table push_subscription enable row level security;

-- everyone signed in reads everything
create policy read_all on event      for select to authenticated using (true);
create policy read_all on team       for select to authenticated using (true);
create policy read_all on player     for select to authenticated using (true);
create policy read_all on course     for select to authenticated using (true);
create policy read_all on round      for select to authenticated using (true);
create policy read_all on tee_group  for select to authenticated using (true);
create policy read_all on match      for select to authenticated using (true);
create policy read_all on match_hole for select to authenticated using (true);
-- the audit trail is readable by the group and written only by the trigger,
-- which runs as definer. no client insert, update or delete policy exists.
create policy read_all on match_hole_history for select to authenticated using (true);
create policy read_all on feed_event for select to authenticated using (true);

-- the elected scorer writes their group's holes; the commissioner writes anything
create policy scorer_writes on match_hole for insert to authenticated
  with check (scores_this_match(match_id) or is_commissioner());
create policy scorer_updates on match_hole for update to authenticated
  using      (scores_this_match(match_id) or is_commissioner())
  with check (scores_this_match(match_id) or is_commissioner());

-- nobody deletes a hole. ever.
-- (absence of a delete policy is the policy)

-- the scorer role can be handed on by anyone in that group, or by the commissioner
create policy handoff on tee_group for update to authenticated
  using (is_commissioner() or exists (
    select 1 from match mt
    where mt.tee_group_id = tee_group.id
      and (me() = any(mt.side_a) or me() = any(mt.side_b))))
  with check (true);

-- commissioner sets pairings, tee times and round state
create policy commish_rounds on round     for update to authenticated using (is_commissioner());
create policy commish_matches on match    for update to authenticated using (is_commissioner());
create policy commish_players on player   for update to authenticated
  using (is_commissioner() or auth_uid = auth.uid());   -- or claiming your own seat

create policy own_subs on push_subscription for all to authenticated
  using (player_id = me()) with check (player_id = me());

-- =====================================================================
--  SEED
-- =====================================================================

insert into event (name, year, trophy, venue, clinch_points)
values ('The Freeman Cup', 2026, 'The Lassie', 'Sand Valley', 5.5);

insert into team (event_id, side, name, short)
select id,'a','Vikes','VIK' from event union all
select id,'b','Celts','CEL' from event;

-- ---------- roster ----------
insert into player (event_id, team_id, name, handicap_index, is_captain, is_commissioner, email)
select e.id, t.id, v.name, v.hi, v.cap, v.comm, v.email
from event e
join (values
  ('a','Griffin S.',15.0,true ,false,'griffin@example.com'),
  ('a','Devin E.'  , 7.0,false,false,'devin@example.com'),
  ('a','Brian K.'  , 6.0,false,false,'brian@example.com'),
  ('a','Matt J.'   ,15.0,false,false,'matt@example.com'),
  ('b','Kyle P.'   ,15.0,true ,true ,'kyle@example.com'),
  ('b','Phil J.'   ,11.0,false,false,'phil@example.com'),
  ('b','Justin D.' , 7.0,false,false,'justin@example.com'),
  ('b','JT W.'     ,15.0,false,false,'jt@example.com')
) as v(side,name,hi,cap,comm,email) on true
join team t on t.event_id = e.id and t.side = v.side;

-- ---------- courses, straight off the cards ----------
insert into course (name, holes, par, stroke_index) values
 ('Mammoth Dunes', 18,
  '{4,4,5,3,4,4,5,3,4, 4,5,4,3,4,5,3,4,5}',
  '{11,9,3,15,5,13,1,17,7, 12,4,8,18,14,6,16,10,2}'),      -- par 73

 ('The Commons', 12,
  '{5,3,4,4,3,4, 4,3,4,4,3,4}',
  '{11,7,5,3,9,1, 8,12,10,2,4,6}'),                        -- par 45, unrated but allocated

 ('Sand Valley', 18,
  '{4,4,3,5,3,4,5,3,4, 5,4,5,4,3,4,4,3,5}',
  '{9,7,13,1,15,5,3,17,11, 2,12,6,8,18,14,10,16,4}'),      -- par 72

 ('Sedge Valley', 18,
  '{4,4,4,4,3,4,3,3,4, 4,5,4,3,4,3,4,4,4}',
  '{13,9,1,3,7,15,17,11,5, 8,2,14,18,6,16,4,10,12}');      -- par 68

-- ---------- rounds ----------
insert into round (event_id, seq, label, play_date, format, course_id, holes)
select e.id, v.seq, v.label, v.d::date, v.fmt, c.id, v.holes
from event e
join (values
  (1,'Round 1','2026-10-08','four-ball','Mammoth Dunes',18),
  (2,'Round 2','2026-10-09','foursomes','The Commons'  ,12),
  (3,'Round 3','2026-10-09','four-ball','Sand Valley'  ,18),
  (4,'Round 4','2026-10-10','singles'  ,'Sedge Valley' ,18)
) as v(seq,label,d,fmt,course,holes) on true
join course c on c.name = v.course;

-- ---------- tee groups ----------
insert into tee_group (round_id, seq, tee_time, scorer_player_id)
select r.id, v.g, v.t::time, p.id
from round r
join (values
  (1,1,'12:00','Griffin S.'), (1,2,'12:10','Justin D.'),
  (2,1,'08:00','Kyle P.'),    (2,2,'08:10','Phil J.'),
  (3,1,'13:10','Devin E.'),   (3,2,'13:20','JT W.'),
  (4,1,'10:10','Devin E.'),   (4,2,'10:30','Phil J.')
) as v(seq,g,t,scorer) on v.seq = r.seq
join player p on p.name = v.scorer;

-- ---------- matches ----------
-- pairings are the commissioner's to change; these are the prototype's.
create or replace function pid(n text) returns uuid as $$
  select id from player where name = n;
$$ language sql stable;

insert into match (round_id, tee_group_id, seq, side_a, side_b)
select r.id, tg.id, v.seq,
       array_remove(array[pid(v.a1), pid(v.a2)], null),
       array_remove(array[pid(v.b1), pid(v.b2)], null)
from round r
join tee_group tg on tg.round_id = r.id
join (values
  (1,1,1,'Griffin S.','Matt J.'   ,'Kyle P.'  ,'JT W.'),
  (1,2,2,'Devin E.'  ,'Brian K.'  ,'Phil J.'  ,'Justin D.'),
  (2,1,1,'Griffin S.','Brian K.'  ,'Kyle P.'  ,'Justin D.'),
  (2,2,2,'Devin E.'  ,'Matt J.'   ,'Phil J.'  ,'JT W.'),
  (3,1,1,'Griffin S.','Devin E.'  ,'Kyle P.'  ,'Phil J.'),
  (3,2,2,'Brian K.'  ,'Matt J.'   ,'Justin D.','JT W.'),
  (4,1,1,'Griffin S.',null        ,'Kyle P.'  ,null),
  (4,1,2,'Devin E.'  ,null        ,'Justin D.',null),
  (4,2,3,'Brian K.'  ,null        ,'Phil J.'  ,null),
  (4,2,4,'Matt J.'   ,null        ,'JT W.'    ,null)
) as v(rseq,gseq,seq,a1,a2,b1,b2) on v.rseq = r.seq and v.gseq = tg.seq;

drop function pid(text);

-- ---------- sanity checks: run these, expect the numbers in the comments ----------
-- select count(*) from player;                      -- 8
-- select count(*) from round;                       -- 4
-- select count(*) from tee_group;                   -- 8
-- select count(*) from match;                       -- 10
-- select name, holes, array_length(par,1),
--        (select sum(x) from unnest(par) x) as total_par from course;
--        -- Mammoth 18/73, Commons 12/45, Sand Valley 18/72, Sedge 18/68
-- select r.label, c.name, count(m.*) from round r
--   join course c on c.id=r.course_id left join match m on m.round_id=r.id
--   group by 1,2 order by 1;                        -- 2,2,2,4

-- =====================================================================
--  RLS TEST CHECKLIST  — write these as integration tests before anything else.
--  Policies that silently return empty sets are the most common failure here.
--
--   as a player who is NOT the scorer
--     [ ] can select every match_hole in the event
--     [ ] insert into match_hole is rejected
--     [ ] update of match_hole is rejected
--   as the elected scorer for tee_group 3.1
--     [ ] insert / update on that group's match_hole succeeds
--     [ ] the same on tee_group 3.2 is rejected
--     [ ] after round 3 is locked, both are rejected
--   as the commissioner
--     [ ] insert / update on any match_hole succeeds, locked or not
--     [ ] update of round, match and tee_group succeeds
--   everybody
--     [ ] delete from match_hole is rejected
--     [ ] match_hole_history gains a row on every write
-- =====================================================================
