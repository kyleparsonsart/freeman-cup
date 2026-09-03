/**
 * Recap moments — the day recap, the cup finale and the Captains
 * Shootout — derived from the data exactly the way the feed is: a pure
 * function of the tables, so a correction re-derives the moment instead
 * of leaving a stale one behind.
 *
 * Each moment auto-opens once per device (localStorage keeps the seen
 * keys) and then lives on in its home: the finale in the strip and the
 * feed, the shootout in the pinned banner until the putts are in, the
 * day recaps in the feed and on the Schedule day rows.
 */
import {
  calc, P, CFG,
  type Match, type Session,
} from './scoring';
import { mvp, relLabel } from './standings';
import type { DbMatchHole, DbPlayer, DbTeam, ShootoutJson } from './types';

/* The Captains Shootout, as decided. */
export const TIEBREAK = {
  name: 'Captains Shootout',
  where: 'practice green',
  stations: [
    { d: 30, n: 'The Long Rail', hint: 'across the biggest break' },
    { d: 15, n: 'The Fringe', hint: 'from the fringe, putter only' },
    { d: 5, n: 'The Knee Knocker', hint: 'dead silence' },
  ],
  maxStrokes: 5,
};

export interface DayMoment {
  key: string;              // 'day:Thu Oct 8'
  day: string;              // as sessions carry it: 'Thu Oct 8'
  dow: string;              // 'Thursday'
  courses: string;
  headline: string;
  pts: { a: number; b: number };   // this day
  cum: { a: number; b: number };   // through this day
  toClinch: number;                // 0 = already clinched
  rows: { a: string; b: string; label: string; w: 'a' | 'b' | 'h' }[];
  next: { course: string; rd: string; fmt: string; holes: number; tees: string } | null;
}

export interface WonMoment {
  key: 'won';
  winner: 'a' | 'b';
  pts: { a: number; b: number };
  kick: string;
  how: string;
  viaShootout: boolean;
  shootout: { a: number[]; b: number[]; ta: number; tb: number } | null;
  roster: string;
  mvp: { name: string; line: string } | null;
}

export interface MomentsState {
  days: DayMoment[];
  /** all points played, level, no shootout on the books yet */
  duelPending: boolean;
  tie: { a: number; b: number } | null;
  won: WonMoment | null;
  captains: { a: string; b: string };
}

export interface MomentsInput {
  sessions: Session[];
  matches: Match[];
  matchHoles: DbMatchHole[];
  clinchPoints: number;
  shootout: ShootoutJson | null | undefined;
  players: DbPlayer[];
  teams: DbTeam[];
}

const fn = (n?: string | null) => (n || '').split(' ')[0];
const names = (keys: string[]) => keys.map(k => fn(P[k]?.n) || k).join(' / ');

const DOW: Record<string, string> = {
  Sun: 'Sunday', Mon: 'Monday', Tue: 'Tuesday', Wed: 'Wednesday',
  Thu: 'Thursday', Fri: 'Friday', Sat: 'Saturday',
};
export const dowOf = (day: string): string => DOW[day.split(' ')[0]] || day;

const ampm = (ms: number): string => {
  const d = new Date(ms);
  let h = d.getHours();
  const ap = h >= 12 ? 'pm' : 'am';
  h = ((h + 11) % 12) + 1;
  return `${h}:${String(d.getMinutes()).padStart(2, '0')}${ap}`;
};

const list = (xs: string[]): string =>
  xs.length <= 1 ? xs.join('') : `${xs.slice(0, -1).join(', ')} and ${xs[xs.length - 1]}`;

export function deriveMoments(input: MomentsInput): MomentsState {
  const { sessions, matches, matchHoles, clinchPoints, shootout, players, teams } = input;

  const when: Record<string, number> = {};
  matchHoles.forEach(h => { when[`${h.match_id}:${h.hole}`] = new Date(h.updated_at).getTime(); });

  // captains: the flagged player a side, else the first on the roster
  const sideOf = (p: DbPlayer): 'a' | 'b' =>
    teams.find(t => t.id === p.team_id)?.side || 'a';
  const capOf = (side: 'a' | 'b'): string => {
    const ps = players.filter(p => sideOf(p) === side);
    return fn((ps.find(p => p.is_captain) || ps[0])?.name) || CFG.teams[side].name;
  };
  const captains = { a: capOf('a'), b: capOf('b') };
  const rosterOf = (side: 'a' | 'b'): string =>
    list(players.filter(p => sideOf(p) === side).map(p => fn(p.name))) || CFG.teams[side].name;

  // every match final, in the order it landed
  interface Final { at: number; m: Match; s: Session }
  const finals: Final[] = [];
  matches.forEach(m => {
    const r = calc(m);
    if (!r.done) return;
    const s = sessions.find(x => x.id === m.s);
    if (!s) return;
    let at = 0;
    m.hs.forEach((h, i) => { if (h.r) at = Math.max(at, when[`${m.id}:${i + 1}`] || 0); });
    finals.push({ at, m, s });
  });
  finals.sort((x, y) => x.at - y.at);

  // day recaps: every round of the day marked Complete, with golf played
  const dayOrder = [...new Set(sessions.map(s => s.day))];
  const days: DayMoment[] = [];
  let cumA = 0, cumB = 0;
  dayOrder.forEach((day, di) => {
    const ss = sessions.filter(s => s.day === day);
    const ms = matches.filter(m => ss.some(s => s.id === m.s));
    let da = 0, db = 0;
    ms.forEach(m => { const r = calc(m); da += r.pts.a; db += r.pts.b; });
    cumA += da; cumB += db;
    const done = ss.length > 0 && ss.every(s => s.state === 'final') && ms.some(m => calc(m).done);
    if (!done) return;

    const dow = dowOf(day);
    const w = da > db ? 'a' : db > da ? 'b' : null;
    const headline = w
      ? `${CFG.teams[w].name} take ${di === 0 ? 'the opening day' : dow}`
      : `${dow} ends all square`;

    const rows = ms.map(m => {
      const r = calc(m);
      return {
        a: names(m.a), b: names(m.b),
        label: r.w === 'h' ? 'Halved' : r.w ? `${CFG.teams[r.w].short} ${r.label}` : '',
        w: (r.w || 'h') as 'a' | 'b' | 'h',
      };
    });

    const ns = dayOrder[di + 1] ? sessions.find(s => s.day === dayOrder[di + 1]) : undefined;
    days.push({
      key: `day:${day}`, day, dow,
      courses: [...new Set(ss.map(s => s.course))].join(' & '),
      headline, pts: { a: da, b: db }, cum: { a: cumA, b: cumB },
      toClinch: Math.max(0, clinchPoints - Math.max(cumA, cumB)),
      rows,
      next: ns ? {
        course: ns.course, rd: ns.rd, fmt: ns.fmt, holes: ns.holes,
        tees: ns.tees.map(t => t.replace(/\s*(AM|PM)/i, x => x.trim().toLowerCase())).join(' and '),
      } : null,
    });
  });

  // overall points, and the clinch walked final by final
  let a = 0, b = 0;
  matches.forEach(m => { const r = calc(m); a += r.pts.a; b += r.pts.b; });
  const allDone = matches.length > 0 && matches.every(m => calc(m).done);

  let wa = 0, wb = 0;
  let clincher: Final | null = null;
  let clinchSide: 'a' | 'b' | null = null;
  for (const f of finals) {
    const r = calc(f.m);
    wa += r.pts.a; wb += r.pts.b;
    if (wa >= clinchPoints || wb >= clinchPoints) {
      clincher = f;
      clinchSide = wa >= clinchPoints ? 'a' : 'b';
      break;
    }
  }

  // the shootout, if the commissioner has entered one
  const sum = (xs: number[]) => xs.reduce((t, x) => t + (Number(x) || 0), 0);
  const shA = shootout?.a || [], shB = shootout?.b || [];
  const shOk = shA.length === 3 && shB.length === 3 && shootout?.done !== false;
  const shTa = sum(shA), shTb = sum(shB);
  const shWinner: 'a' | 'b' | null = shOk && shTa !== shTb ? (shTa < shTb ? 'a' : 'b') : null;

  const tie = allDone && a === b ? { a, b } : null;

  let won: WonMoment | null = null;
  if (clinchSide && clincher) {
    const r = calc(clincher.m);
    const how = r.w === 'h'
      ? `Clinched when ${names(clincher.m.a)} and ${names(clincher.m.b)} halved the match that mattered.`
      : r.w
        ? `Clinched when ${names(clincher.m[r.w])} closed out ${names(clincher.m[r.w === 'a' ? 'b' : 'a'])}, ${r.label}.`
        : '';
    won = {
      key: 'won', winner: clinchSide, pts: { a, b },
      kick: `${dowOf(clincher.s.day)} · ${clincher.s.course} · ${ampm(clincher.at)}`,
      how, viaShootout: false, shootout: null,
      roster: rosterOf(clinchSide), mvp: null,
    };
  } else if (tie && shWinner) {
    const l: 'a' | 'b' = shWinner === 'a' ? 'b' : 'a';
    const wT = shWinner === 'a' ? shTa : shTb, lT = shWinner === 'a' ? shTb : shTa;
    won = {
      key: 'won', winner: shWinner, pts: { a, b },
      kick: `${dowOf(dayOrder[dayOrder.length - 1] || '')} · the ${TIEBREAK.where}`,
      how: `Won on the ${TIEBREAK.where}: ${captains[shWinner]} ${wT}, ${captains[l]} ${lT} in the ${TIEBREAK.name}.`,
      viaShootout: true,
      shootout: { a: shA, b: shB, ta: shTa, tb: shTb },
      roster: rosterOf(shWinner), mvp: null,
    };
  }
  if (won) won.mvp = mvpOf(sessions, matches);

  return { days, duelPending: !!tie && !won, tie, won, captains };
}

/**
 * MVP of the Freeman Cup: the top of the standings board (see
 * lib/standings.ts — net against par, own-ball rounds, full cards only).
 */
function mvpOf(sessions: Session[], matches: Match[]): { name: string; line: string } | null {
  const top = mvp(sessions, matches);
  if (!top) return null;
  const rel = top.rel === 0 ? 'even net' : `${relLabel(top.rel)} net`;
  const n = top.rounds;
  const span = n === 1 ? 'the round' : n === 2 ? 'two rounds' : n === 3 ? 'three rounds' : `${n} rounds`;
  return { name: top.name, line: `${rel} across ${span}` };
}

/* ---- once per device ---- */

const SEEN = 'fc-moments-seen';

const seen = (): string[] => {
  try { return JSON.parse(localStorage.getItem(SEEN) || '[]') as string[]; } catch { return []; }
};

export function markSeen(key: string): void {
  try {
    const s = seen();
    if (!s.includes(key)) localStorage.setItem(SEEN, JSON.stringify([...s, key]));
  } catch { /* private mode: the moment simply shows again */ }
}

/**
 * The one moment to auto-open now, by weight: the cup, then the
 * shootout, then only the latest finished day — miss two days and you
 * get one recap, not a queue.
 */
export function nextUnseen(ms: MomentsState): string | null {
  const order: string[] = [];
  if (ms.won) order.push('won');
  if (ms.duelPending) order.push('duel');
  const last = ms.days[ms.days.length - 1];
  if (last) order.push(last.key);
  const s = seen();
  return order.find(k => !s.includes(k)) || null;
}
