/** Database row types matching the Supabase schema */

export interface DbEvent {
  id: string;
  name: string;
  year: number;
  trophy: string;
  venue: string;
  clinch_points: number;
}

export interface DbTeam {
  id: string;
  event_id: string;
  side: 'a' | 'b';
  name: string;
  short: string;
}

export interface DbPlayer {
  id: string;
  event_id: string;
  team_id: string;
  name: string;
  handicap_index: number;
  is_captain: boolean;
  is_commissioner: boolean;
  email: string;
  auth_uid: string | null;
}

export interface DbCourse {
  id: string;
  name: string;
  holes: number;
  par: number[];
  stroke_index: number[];
}

export interface DbRound {
  id: string;
  event_id: string;
  seq: number;
  label: string;
  play_date: string;
  format: 'four-ball' | 'foursomes' | 'singles';
  course_id: string;
  holes: number;
  locked: boolean;
}

export interface DbTeeGroup {
  id: string;
  round_id: string;
  seq: number;
  tee_time: string;
  scorer_player_id: string | null;
}

export interface DbMatch {
  id: string;
  round_id: string;
  tee_group_id: string;
  seq: number;
  side_a: string[];
  side_b: string[];
  odds_a: string | null;
  odds_b: string | null;
}

export interface DbMatchHole {
  match_id: string;
  hole: number;
  result: 'A' | 'B' | 'H' | null;
  scores: Record<string, number | string>;
  derived: boolean;
  entered_by: string | null;
  updated_at: string;
}

export interface DbFeedEvent {
  id: number;
  event_id: string;
  round_id: string | null;
  match_id: string | null;
  kind: string;
  tier: 'none' | 'other_group' | 'all';
  body: Record<string, unknown>;
  occurred_at: string;
}
