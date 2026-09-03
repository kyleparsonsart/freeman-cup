-- =====================================================================
--  THE FREEMAN CUP 2026 — Round 2 becomes Aggregate Match Play
--  Paste into the Supabase SQL editor and run once.
--  Companion to freeman-cup-schema.sql; the record of what ran.
-- =====================================================================

-- Aggregate match play: 2v2, everyone plays their own ball, and the
-- hole goes to the lower SUM of the two partners' net scores. Decided
-- Sep 3: full-difference handicaps off the low man (like four-ball),
-- prorated to 12 holes, and Round 2 now counts toward the MVP board
-- and carries its own Player of the Round ball marker.

alter table round drop constraint if exists round_format_check;
alter table round add constraint round_format_check
  check (format in ('four-ball', 'foursomes', 'aggregate', 'singles'));

-- The Commons flips. Existing Round 2 test scores were entered as team
-- rows ('a'/'b'), which aggregate cannot read — clear them so the
-- round starts clean. (The real event starts from reset_event anyway.)
delete from match_hole
  where match_id in (select id from match where round_id in
    (select id from round where format = 'foursomes'));
update round set format = 'aggregate' where format = 'foursomes';
