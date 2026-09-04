-- =====================================================================
--  THE FREEMAN CUP 2026 — public scoreboard (thefreemancup.com)
--  Run once in the Supabase SQL editor, after every other freeman-cup-*.sql.
--
--  One security-definer RPC, callable by anon, returning a JSON snapshot of
--  the same tables the app loads, minus anything private:
--    players: id, team_id, first name only, handicap_index (needed to place
--             stroke marks), is_captain. No email, no auth_uid, no commissioner.
--    match_hole: match_id, hole, result, scores, derived, updated_at.
--             No entered_by, no history.
--    feed_event: none. The page derives its own moments from match_hole,
--             exactly like the app's Live screen does.
--  Nothing here is writable. RLS on the tables is untouched.
-- =====================================================================

-- last year's winner, for the "holds the Lassie" line. Null = inaugural.
alter table event add column if not exists previous_winner text;   -- 'a' | 'b' | null
alter table event add column if not exists previous_year int;

create or replace function public_scoreboard() returns jsonb as $$
  select jsonb_build_object(
    'event', (
      select jsonb_build_object(
        'id', e.id, 'name', e.name, 'year', e.year, 'trophy', e.trophy,
        'venue', e.venue, 'clinch_points', e.clinch_points,
        'shootout', e.shootout,
        'previous_winner', e.previous_winner, 'previous_year', e.previous_year)
      from event e order by e.year desc limit 1),
    'teams', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'id', t.id, 'event_id', t.event_id, 'side', t.side,
        'name', t.name, 'short', t.short) order by t.side), '[]'::jsonb)
      from team t),
    'players', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'id', p.id, 'event_id', p.event_id, 'team_id', p.team_id,
        'name', split_part(p.name, ' ', 1),
        'handicap_index', p.handicap_index,
        'is_captain', p.is_captain) order by p.name), '[]'::jsonb)
      from player p),
    'courses', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'id', c.id, 'name', c.name, 'holes', c.holes,
        'par', to_jsonb(c.par), 'stroke_index', to_jsonb(c.stroke_index))), '[]'::jsonb)
      from course c),
    'rounds', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'id', r.id, 'event_id', r.event_id, 'seq', r.seq, 'label', r.label,
        'play_date', r.play_date, 'format', r.format, 'course_id', r.course_id,
        'holes', r.holes, 'locked', r.locked, 'state', r.state) order by r.seq), '[]'::jsonb)
      from round r),
    'tee_groups', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'id', g.id, 'round_id', g.round_id, 'seq', g.seq,
        'tee_time', g.tee_time, 'submitted_at', g.submitted_at) order by g.round_id, g.seq), '[]'::jsonb)
      from tee_group g),
    'matches', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'id', m.id, 'round_id', m.round_id, 'tee_group_id', m.tee_group_id,
        'seq', m.seq, 'side_a', to_jsonb(m.side_a), 'side_b', to_jsonb(m.side_b),
        'odds_a', m.odds_a, 'odds_b', m.odds_b) order by m.round_id, m.seq), '[]'::jsonb)
      from match m),
    'match_holes', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'match_id', h.match_id, 'hole', h.hole, 'result', h.result,
        'scores', h.scores, 'derived', h.derived, 'updated_at', h.updated_at)), '[]'::jsonb)
      from match_hole h),
    'generated_at', now()
  );
$$ language sql stable security definer set search_path = public;

revoke all on function public_scoreboard() from public;
grant execute on function public_scoreboard() to anon, authenticated;

-- sanity: expect one JSON object with 8 players, 4 rounds, 10 matches
-- select jsonb_array_length(public_scoreboard()->'players'),
--        jsonb_array_length(public_scoreboard()->'rounds'),
--        jsonb_array_length(public_scoreboard()->'matches');
