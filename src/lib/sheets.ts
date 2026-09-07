/**
 * The captain's sheet, client side. Pure helpers over the raw tables:
 * which pairings a captain can still choose, when the sheet is due, and
 * what the signed-in player should see for a round that has no matches
 * yet. The rules themselves live in freeman-cup-sheets.sql; this only
 * mirrors them so the UI can grey out a used pairing before the server
 * says no.
 */
import type { DbCaptainSheet, DbMatch, DbPlayer, DbRound, DbSheetStatus, DbTeam, DbTeeGroup } from './types';

export const SHEET_TZ = 'America/Chicago';
export const SHEET_DUE_TIME = '21:00';

/** A course-time wall clock (Y-M-D + minutes) as a Date. */
function zoned(y: number, m: number, d: number, minutes: number): Date {
  const eve = new Date(Date.UTC(y, m - 1, d, 0, 0, 0) + minutes * 60_000);
  // shift by the zone's offset at that moment (CDT in October, but don't assume)
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: SHEET_TZ, hour12: false, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit',
  }).formatToParts(eve).reduce<Record<string, number>>((o, p) => (p.type !== 'literal' ? (o[p.type] = Number(p.value), o) : o), {});
  const asIfUtc = Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour % 24, parts.minute);
  return new Date(eve.getTime() - (asIfUtc - eve.getTime()));
}

/**
 * When the sheet is due: 9:00 pm the evening before, course time. A second
 * round on the same day (Friday afternoon) can't be sealed until the
 * morning round has posted, so it's due 90 minutes before its first tee.
 */
export function sheetDue(round: Pick<DbRound, 'id' | 'play_date' | 'seq' | 'event_id'>, rounds: DbRound[] = [], teeGroups: DbTeeGroup[] = []): Date {
  const [y, m, d] = round.play_date.split('-').map(Number);
  const sameDayEarlier = rounds.some(r => r.event_id === round.event_id && r.play_date === round.play_date && r.seq < round.seq);
  if (sameDayEarlier) {
    const tees = teeGroups.filter(t => t.round_id === round.id).map(t => t.tee_time).sort();
    if (tees.length) {
      const [hh, mm] = tees[0].split(':').map(Number);
      return zoned(y, m, d, hh * 60 + mm - 90);
    }
  }
  return zoned(y, m, d - 1, 21 * 60);
}

const key = (a: string, b: string) => (a < b ? `${a}|${b}` : `${b}|${a}`);

/** Pairs this team has already used in earlier team rounds (from the matches). */
export function usedPairs(team: DbTeam, round: DbRound, rounds: DbRound[], matches: DbMatch[]): Set<string> {
  const out = new Set<string>();
  const earlier = new Set(rounds.filter(r => r.seq < round.seq && r.format !== 'singles').map(r => r.id));
  for (const m of matches) {
    if (!earlier.has(m.round_id)) continue;
    const side = team.side === 'a' ? m.side_a : m.side_b;
    if (side.length === 2) out.add(key(side[0], side[1]));
  }
  return out;
}

export interface PairingOption { pairs: [string[], string[]]; used: boolean }

/** The three ways to split four into pairs, first player anchored; used ones flagged. */
export function pairingOptions(players: DbPlayer[], used: Set<string>): PairingOption[] {
  const ps = [...players].sort((a, b) => a.name.localeCompare(b.name)).map(p => p.id);
  if (ps.length !== 4) return [];
  const combos: [string[], string[]][] = [
    [[ps[0], ps[1]], [ps[2], ps[3]]],
    [[ps[0], ps[2]], [ps[1], ps[3]]],
    [[ps[0], ps[3]], [ps[1], ps[2]]],
  ];
  return combos.map(pairs => ({ pairs, used: pairs.some(p => used.has(key(p[0], p[1]))) }));
}

export type SheetStage =
  | 'locked'    // a captain, but an earlier round hasn't posted yet
  | 'open'      // a captain who hasn't sealed yet
  | 'sealed'    // sealed, waiting on the other side or the reveal
  | 'envelope'  // revealed, this captain hasn't opened
  | 'opened'    // this captain opened, the other hasn't
  | 'waiting';  // not a captain: pairings post tonight

export interface SheetView {
  round: DbRound;
  due: Date;
  pastDue: boolean;
  revealed: boolean;
  myTeam: DbTeam | null;
  theirTeam: DbTeam | null;
  iAmCaptain: boolean;
  stage: SheetStage;
  /** my own sealed sheet, if readable */
  mine: DbCaptainSheet | null;
  /** the other side's sheet, readable once revealed (the envelope's contents) */
  theirs: DbCaptainSheet | null;
  status: { team: DbTeam; captain: DbPlayer | null; sealed: DbSheetStatus | null }[];
  bothSealed: boolean;
  /** every earlier round has its matches (the rotation check needs them) */
  earlierPosted: boolean;
  /** the commissioner may hand out the envelopes */
  canReveal: boolean;
}

export function sheetView(input: {
  round: DbRound; teams: DbTeam[]; players: DbPlayer[]; sheets: DbCaptainSheet[]; status: DbSheetStatus[];
  mePlayerId: string; meIsCommissioner: boolean; now?: Date;
  rounds?: DbRound[]; teeGroups?: DbTeeGroup[]; matches?: DbMatch[];
}): SheetView {
  const { round, teams, players, sheets, status, mePlayerId, meIsCommissioner } = input;
  const now = input.now ?? new Date();
  const rounds = input.rounds ?? [];
  const earlierPosted = rounds.filter(r => r.seq < round.seq).every(r => (input.matches ?? []).some(m => m.round_id === r.id));
  const me = players.find(p => p.id === mePlayerId) || null;
  const myTeam = me ? teams.find(t => t.id === me.team_id) || null : null;
  const theirTeam = myTeam ? teams.find(t => t.id !== myTeam.id) || null : null;
  const iAmCaptain = !!me?.is_captain;
  const due = sheetDue(round, rounds, input.teeGroups ?? []);
  const pastDue = now.getTime() >= due.getTime();
  const revealed = !!round.revealed_at;
  const forRound = (xs: { round_id: string }[]) => xs.filter(x => x.round_id === round.id);
  const st = forRound(status) as DbSheetStatus[];
  const sh = forRound(sheets) as DbCaptainSheet[];
  const mine = myTeam ? sh.find(s => s.team_id === myTeam.id) || null : null;
  const theirs = theirTeam ? sh.find(s => s.team_id === theirTeam.id) || null : null;
  const mineStatus = myTeam ? st.find(s => s.team_id === myTeam.id) || null : null;
  const theirStatus = theirTeam ? st.find(s => s.team_id === theirTeam.id) || null : null;
  const bothSealed = st.length >= 2;
  const order = [...teams].sort((a, b) => (a.side === 'b' ? -1 : 1) - (b.side === 'b' ? -1 : 1)); // Celts first, like the strip
  let stage: SheetStage = 'waiting';
  if (iAmCaptain) {
    if (!mineStatus) stage = earlierPosted ? 'open' : 'locked';
    else if (!revealed) stage = 'sealed';
    else if (!theirStatus?.opened_at) stage = 'envelope';   // I open THEIR sheet
    else stage = 'opened';
  }
  return {
    round, due, pastDue, revealed, myTeam, theirTeam, iAmCaptain, stage, mine, theirs,
    status: order.map(team => ({
      team,
      captain: players.find(p => p.team_id === team.id && p.is_captain) || null,
      sealed: st.find(s => s.team_id === team.id) || null,
    })),
    bothSealed,
    earlierPosted,
    canReveal: meIsCommissioner && !revealed && (bothSealed || pastDue),
  };
}

/** "8:12 pm" in course time */
export const clockLocal = (iso: string | Date): string =>
  new Intl.DateTimeFormat('en-US', { hour: 'numeric', minute: '2-digit', hour12: true, timeZone: SHEET_TZ })
    .format(typeof iso === 'string' ? new Date(iso) : iso).toLowerCase();
