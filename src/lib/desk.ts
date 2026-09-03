/**
 * The desk: the commissioner's day derived onto one card. Which round
 * is today's, whether it's ready to go live, how each group is moving
 * while it's live, and whether the cards are home at the end.
 */
import { calc, type Match, type Session } from './scoring';
import { holesShort } from './card';
import type { DbMatch, DbMatchHole, DbRound, DbTeeGroup } from './types';

export interface DeskGroup {
  tgId: string;
  letter: string;
  scorer: string | null;      // player id
  thru: number;               // fewest consecutive holes decided among its matches
  lastAt: number | null;      // epoch ms of the group's latest score
  submitted: boolean;
  open: number;               // holes without a result across its matches
}

export interface DeskState {
  round: DbRound;
  session: Session;
  state: 'upcoming' | 'live' | 'final';
  pairingsSet: number;
  pairingsTotal: number;
  scorersSet: number;
  groups: DeskGroup[];
  cardsIn: number;
  openHoles: number;
}

export interface DeskInput {
  rounds: DbRound[];
  scoringSessions: Session[];
  scoringMatches: Match[];
  matches: DbMatch[];
  teeGroups: DbTeeGroup[];
  matchHoles: DbMatchHole[];
}

/** The round the desk watches: the live one, else the earliest not finished. */
export function deskFor(input: DeskInput): DeskState | null {
  const { rounds, scoringSessions, scoringMatches, matches, teeGroups, matchHoles } = input;

  const session =
    scoringSessions.find(s => s.state === 'live') ||
    scoringSessions.find(s => s.state !== 'final') ||
    null;
  if (!session) return null;
  const round = rounds.find(r => r.id === session.id);
  if (!round) return null;

  const sms = scoringMatches.filter(m => m.s === session.id);
  const dms = matches.filter(m => m.round_id === round.id);
  const tgs = teeGroups.filter(t => t.round_id === round.id).sort((a, b) => a.seq - b.seq);

  const slots = round.format === 'singles' ? 1 : 2;
  const pairingsSet = dms.filter(m => m.side_a.length >= slots && m.side_b.length >= slots).length;

  const groups: DeskGroup[] = tgs.map((tg, gi) => {
    const groupDb = dms.filter(m => m.tee_group_id === tg.id);
    const ids = groupDb.map(m => m.id);
    const groupSm = sms.filter(m => ids.includes(m.id));
    const thru = groupSm.length ? Math.min(...groupSm.map(m => calc(m).played)) : 0;
    let lastAt: number | null = null;
    matchHoles.forEach(h => {
      if (!ids.includes(h.match_id)) return;
      const at = new Date(h.updated_at).getTime();
      if (lastAt === null || at > lastAt) lastAt = at;
    });
    return {
      tgId: tg.id,
      letter: String.fromCharCode(65 + gi),
      scorer: tg.scorer_player_id,
      thru,
      lastAt,
      submitted: !!tg.submitted_at,
      open: holesShort(groupSm, session.holes),
    };
  });

  const anyPlay = sms.some(m => calc(m).played > 0);
  const state: DeskState['state'] =
    session.state === 'final' ? 'final' : session.state === 'live' || anyPlay ? 'live' : 'upcoming';

  return {
    round,
    session,
    state,
    pairingsSet,
    pairingsTotal: dms.length,
    scorersSet: groups.filter(g => g.scorer).length,
    groups,
    cardsIn: groups.filter(g => g.submitted).length,
    openHoles: groups.reduce((t, g) => t + g.open, 0),
  };
}

/** 'quiet 38 min' / 'last score 9:41' material. */
export function quietMins(lastAt: number | null, now = Date.now()): number | null {
  if (lastAt === null) return null;
  return Math.max(0, Math.round((now - lastAt) / 60000));
}
