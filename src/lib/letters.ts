/**
 * The letters. When the commissioner sends a round's pairings (the
 * matches appear with round.revealed_at set), every player gets a
 * sealed letter on his phone: his partner, his opponents, his tee time
 * and the strokes. Opened once per device, like the recap moments.
 */
import type { EventData } from '../hooks/useEventData';
import { calc, getsStroke, strokeMap, type Match, type Session } from './scoring';
import type { DbRound } from './types';

export interface Letter {
  key: string;            // 'letter:<round id>:<sent at>' (a re-sent round is a new letter)
  round: DbRound;
  session: Session;
  match: Match;
  mine: boolean;          // the signed-in player is in this match (else a spectator's copy)
  partner: string | null; // player key
  opponents: string[];    // player keys
  tee: string;
  strokes: { key: string; n: number }[];   // who gets shots in this match
}

const SEEN = 'fc-letters-seen';
const seen = (): string[] => { try { return JSON.parse(localStorage.getItem(SEEN) || '[]') as string[]; } catch { return []; } };
export function markLetterSeen(key: string): void {
  try { const s = seen(); if (!s.includes(key)) localStorage.setItem(SEEN, JSON.stringify([...s, key])); } catch { /* shows again */ }
}
export function letterSeen(key: string): boolean { return seen().includes(key); }

/** The letter for a round, for the signed-in player. */
export function letterFor(data: EventData, round: DbRound): Letter | null {
  const session = data.scoringSessions.find(s => s.id === round.id);
  const ms = data.scoringMatches.filter(m => m.s === round.id);
  if (!session || !ms.length) return null;
  const me = data.meKey;
  const match = ms.find(m => m.a.includes(me) || m.b.includes(me)) || ms[0];
  const mine = match.a.includes(me) || match.b.includes(me);
  const side = match.a.includes(me) ? 'a' : match.b.includes(me) ? 'b' : null;
  const mySide = side ? match[side] : match.b;
  const theirSide = side ? match[side === 'a' ? 'b' : 'a'] : match.a;
  const partner = mine ? mySide.find(k => k !== me) || null : null;
  const sm = strokeMap(match);
  const strokes = Object.entries(sm).filter(([, n]) => n > 0).map(([key, n]) => ({ key, n }));
  const tee = (session.tees[match.g] || '').replace(/\s*(AM|PM)/i, x => x.trim().toLowerCase());
  return { key: `letter:${round.id}:${round.revealed_at || ''}`, round, session, match, mine, partner, opponents: theirSide, tee, strokes };
}

/** The letter to open now: the latest sent round nobody has scored yet, not seen on this device. */
export function pendingLetter(data: EventData): Letter | null {
  const sent = data.rounds
    .filter(r => r.revealed_at && data.matches.some(m => m.round_id === r.id))
    .sort((a, b) => b.seq - a.seq);
  for (const r of sent) {
    const ms = data.scoringMatches.filter(m => m.s === r.id);
    if (ms.some(m => calc(m).played > 0)) continue;       // the round is under way, the moment has passed
    if (letterSeen(`letter:${r.id}:${r.revealed_at || ''}`)) continue;
    return letterFor(data, r);
  }
  return null;
}

/** Holes where a player gets a stroke, for the letter's fine print. */
export function strokeHoles(m: Match, key: string, holes: number): number[] {
  const out: number[] = [];
  for (let i = 0; i < holes; i++) if (getsStroke(m, key, i)) out.push(i + 1);
  return out;
}
