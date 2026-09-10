/**
 * The races: the MVP board and Player of the Round, derived from the
 * tables like the feed and the moments are.
 *
 * Hole points (decided Sep 8, halves dropped Sep 9, 2/1 from Sep 9): 2 for
 * a hole your ball won on its own, 1 for a hole your side won together
 * (both partners held the best net ball, or any aggregate win), nothing
 * for a halved hole, a loss or a pick-up. Singles wins are always 2. Bye holes count
 * as if the match were live, so a 5 & 4 winner banks the same 18 holes
 * as a match that went the distance. Net against par breaks ties, and
 * stays on the board as the Medalist line. The full-card rule is shown
 * honestly: a short card drops you off the board rather than flattering
 * you.
 */
import { calc, derive, getsStroke, holeComplete, P, type Match, type Session } from './scoring';

export interface BoardRow {
  key: string;            // player key
  name: string;           // first name
  side: 'a' | 'b';
  pts: number;            // hole points, cumulative
  solo: number;           // holes won on your own ball
  team: number;           // holes won together
  halves: number;
  rel: number;            // net strokes against par, cumulative (the tiebreak)
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
  winner: RaceRow | null;
  /** next best full card, for the margin on the card */
  second: RaceRow | null;
}

export interface RaceRow { key: string; name: string; side: 'a' | 'b'; pts: number; rel: number; solo: number; team: number }

const fn = (n?: string | null) => (n || '').split(' ')[0];

/** ±n against par; level is E. */
export const relLabel = (rel: number): string =>
  rel === 0 ? 'E' : rel > 0 ? `+${rel}` : `−${-rel}`;

interface Acc { pts: number; solo: number; team: number; halves: number; rel: number; holes: number; rounds: Set<string> }

export const POINTS = { solo: 2, team: 1, half: 0 } as const;

/**
 * Hole points for one hole of one match, by player key. Empty when the
 * hole is not fully scored. Uses the derived result, so bye holes count
 * exactly like live ones.
 */
export function holePoints(m: Match, s: Session, i: number): Record<string, number> {
  const out: Record<string, number> = {};
  if (s.fmt === 'Foursomes') return out;           // the pair's ball, no personal points
  if (!m.hs[i] || !holeComplete(m, i)) return out;
  const r = derive(m, i).r;
  if (!r) return out;
  const all = [...m.a, ...m.b];
  if (r === 'H') { all.forEach(k => { out[k] = POINTS.half; }); return out; }   // 0: a halve is not a win
  const w: 'a' | 'b' = r === 'A' ? 'a' : 'b';
  all.forEach(k => { out[k] = 0; });
  if (s.fmt === 'Aggregate') { m[w].forEach(k => { out[k] = POINTS.team; }); return out; }
  // own ball: who held the side's best net
  const nets = m[w].map(k => {
    const g = m.hs[i].sc[k];
    return typeof g === 'number' ? g - getsStroke(m, k, i) : Infinity;
  });
  const best = Math.min(...nets);
  const holders = nets.filter(n => n === best).length;
  m[w].forEach((k, x) => { if (nets[x] === best) out[k] = holders === 1 ? POINTS.solo : POINTS.team; });
  return out;
}

function accumulate(sessions: Session[], matches: Match[], only?: string): Record<string, Acc> {
  const acc: Record<string, Acc> = {};
  const get = (k: string) => (acc[k] = acc[k] || { pts: 0, solo: 0, team: 0, halves: 0, rel: 0, holes: 0, rounds: new Set<string>() });
  matches.forEach(m => {
    const s = sessions.find(x => x.id === m.s);
    if (!s || s.fmt === 'Foursomes') return;
    if (only && s.id !== only) return;
    [...m.a, ...m.b].forEach(k => {
      m.hs.forEach((h, i) => {
        const g = h.sc[k];
        if (g === undefined || g === null) return;
        const e = get(k);
        // a pick-up is par plus four by the book (Art. 4.2)
        const gross = g === 'X' ? (s.par[i] ?? 4) + 4 : (g as number);
        e.rel += gross - getsStroke(m, k, i) - (s.par[i] ?? 4);
        e.holes++;
        e.rounds.add(s.id);
      });
    });
    m.hs.forEach((_h, i) => {
      const hp = holePoints(m, s, i);
      Object.entries(hp).forEach(([k, p]) => {
        const e = get(k);
        e.pts += p;
        if (p === POINTS.solo) e.solo++;
        else if (p === POINTS.team) e.team++;
        else if (p === 0 && derive(m, i).r === 'H') e.halves++;
      });
    });
  });
  return acc;
}

/**
 * The MVP board: everyone with a scored hole, eligible (full card so
 * far) first by hole points, net against par breaking ties, short cards
 * after — still shown, struck through, so the missing byes have a face.
 */
export function mvpBoard(sessions: Session[], matches: Match[]): BoardRow[] {
  const acc = accumulate(sessions, matches);
  // full card so far: every hole of every finished own-ball round. A round in
  // play never knocks anyone off the board; its byes bite once it is final.
  const due = sessions.filter(x => x.state === 'final' && x.fmt !== 'Foursomes').reduce((n, x) => n + x.holes, 0);
  const rows: BoardRow[] = Object.entries(acc).map(([k, e]) => ({
    key: k,
    name: fn(P[k]?.n) || k,
    side: P[k]?.t || 'a',
    pts: e.pts, solo: e.solo, team: e.team, halves: e.halves,
    rel: e.rel,
    holes: e.holes,
    rounds: e.rounds.size,
    eligible: e.holes >= due,
  }));
  return rows.sort((x, y) =>
    Number(y.eligible) - Number(x.eligible) || y.pts - x.pts || x.rel - y.rel || x.name.localeCompare(y.name));
}

/** The current MVP: the top of the board, if anyone is on it. */
export function mvp(sessions: Session[], matches: Match[]): BoardRow | null {
  const board = mvpBoard(sessions, matches);
  return board.find(r => r.eligible) || null;
}

/**
 * Player of the Round, one ball marker an own-ball round: most hole
 * points among full cards, net against par breaking the tie, decided
 * only once the round is in the book (marked Complete).
 */
export function roundRaces(sessions: Session[], matches: Match[]): RoundRace[] {
  return sessions
    .filter(s => s.fmt !== 'Foursomes')
    .map(s => {
      const state = s.state === 'final' ? 'final'
        : matches.some(m => m.s === s.id && calc(m).played > 0) ? 'live'
        : 'upcoming';
      const rows: RaceRow[] = [];
      if (state === 'final') {
        const acc = accumulate([s], matches.filter(m => m.s === s.id), s.id);
        Object.entries(acc).forEach(([k, e]) => {
          if (e.holes !== s.holes) return; // full round card only
          rows.push({ key: k, name: fn(P[k]?.n) || k, side: P[k]?.t || 'a', pts: e.pts, rel: e.rel, solo: e.solo, team: e.team });
        });
        rows.sort((x, y) => y.pts - x.pts || x.rel - y.rel);
      }
      return { roundId: s.id, rd: s.rd, course: s.course, day: s.day, state, winner: rows[0] || null, second: rows[1] || null };
    });
}
