/**
 * The races: the MVP board and Player of the Round, derived from the
 * tables like the feed and the moments are. Net against par over the
 * own-ball rounds (four-ball and singles; foursomes cards belong to
 * the team), with the full-card rule shown honestly: a short card
 * drops you off the board rather than flattering you.
 */
import { calc, getsStroke, P, type Match, type Session } from './scoring';

export interface BoardRow {
  key: string;            // player key
  name: string;           // first name
  side: 'a' | 'b';
  rel: number;            // net strokes against par, cumulative
  holes: number;          // holes with a score on the card
  rounds: number;         // own-ball rounds appearing on the card
  eligible: boolean;      // full card so far (ties the byes rule in)
}

export interface RoundRace {
  roundId: string;
  rd: string;
  course: string;
  day: string;
  state: 'final' | 'live' | 'upcoming';
  winner: { key: string; name: string; side: 'a' | 'b'; rel: number } | null;
}

const fn = (n?: string | null) => (n || '').split(' ')[0];

/** ±n against par; level is E. */
export const relLabel = (rel: number): string =>
  rel === 0 ? 'E' : rel > 0 ? `+${rel}` : `−${-rel}`;

interface Acc { rel: number; holes: number; rounds: Set<string> }

function accumulate(sessions: Session[], matches: Match[], only?: string): Record<string, Acc> {
  const acc: Record<string, Acc> = {};
  matches.forEach(m => {
    const s = sessions.find(x => x.id === m.s);
    if (!s || s.fmt === 'Foursomes') return;
    if (only && s.id !== only) return;
    [...m.a, ...m.b].forEach(k => {
      m.hs.forEach((h, i) => {
        const g = h.sc[k];
        if (typeof g !== 'number') return;
        const e = (acc[k] = acc[k] || { rel: 0, holes: 0, rounds: new Set<string>() });
        e.rel += g - getsStroke(m, k, i) - (s.par[i] ?? 4);
        e.holes++;
        e.rounds.add(s.id);
      });
    });
  });
  return acc;
}

/**
 * The MVP board: everyone with a scored hole, eligible (full card so
 * far) first by net, short cards after — still shown, struck through,
 * so the missing byes have a face.
 */
export function mvpBoard(sessions: Session[], matches: Match[]): BoardRow[] {
  const acc = accumulate(sessions, matches);
  const max = Math.max(0, ...Object.values(acc).map(e => e.holes));
  const rows: BoardRow[] = Object.entries(acc).map(([k, e]) => ({
    key: k,
    name: fn(P[k]?.n) || k,
    side: P[k]?.t || 'a',
    rel: e.rel,
    holes: e.holes,
    rounds: e.rounds.size,
    eligible: e.holes === max,
  }));
  return rows.sort((x, y) =>
    Number(y.eligible) - Number(x.eligible) || x.rel - y.rel || x.name.localeCompare(y.name));
}

/** The current MVP: the top of the board, if anyone is on it. */
export function mvp(sessions: Session[], matches: Match[]): BoardRow | null {
  const board = mvpBoard(sessions, matches);
  return board.find(r => r.eligible) || null;
}

/**
 * Player of the Round, one ball marker an own-ball round: lowest net
 * against par among full cards, decided only once the round is in the
 * book (marked Complete).
 */
export function roundRaces(sessions: Session[], matches: Match[]): RoundRace[] {
  return sessions
    .filter(s => s.fmt !== 'Foursomes')
    .map(s => {
      const state = s.state === 'final' ? 'final'
        : matches.some(m => m.s === s.id && calc(m).played > 0) ? 'live'
        : 'upcoming';
      let winner: RoundRace['winner'] = null;
      if (state === 'final') {
        const acc = accumulate([s], matches.filter(m => m.s === s.id), s.id);
        Object.entries(acc).forEach(([k, e]) => {
          if (e.holes !== s.holes) return; // full round card only
          if (!winner || e.rel < winner.rel) {
            winner = { key: k, name: fn(P[k]?.n) || k, side: P[k]?.t || 'a', rel: e.rel };
          }
        });
      }
      return { roundId: s.id, rd: s.rd, course: s.course, day: s.day, state, winner };
    });
}
