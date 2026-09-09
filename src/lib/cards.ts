/**
 * Share cards — the posters behind every screenshot-and-share moment:
 * a match result, a day recap, the finale, the Captains Shootout, a
 * player card, a week in review, the state of the Cup mid-round and the
 * feed spikes (an eagle, a streak, a walk-off).
 *
 * Every card is a pure function of the data, so anything that fired once
 * can be reopened later from Schedule or Live and a correction re-derives
 * the card instead of leaving a stale one behind. Keys are strings so the
 * same state slot that opens a moment can open a card:
 *   match:<id> · day:<day> · won · shootout · player:<key> · live
 *   · spike:<type>:<matchId>:<hole>
 * The week in review is folded into the player card once golf is played.
 */
import { calc, P, CFG, type Match, type Session, type CalcResult } from './scoring';
import type { DbPlayer, DbTeeGroup, DbMatch } from './types';
import { plannedPoints } from './moments';
import { roundRaces, type RaceRow } from './standings';

export type Side = 'a' | 'b';

/** The slice of EventData the cards read. */
export interface CardData {
  scoringSessions: Session[];
  scoringMatches: Match[];
  matches: DbMatch[];
  teeGroups: DbTeeGroup[];
  players: DbPlayer[];
  playerById: Record<string, DbPlayer>;
  meKey: string;
  event: { clinch_points: number; year: number; venue: string; trophy: string };
}

/* ---- little helpers shared with the screens ---- */

const fn = (n?: string | null) => (n || '').split(' ')[0];
export const first = (k: string): string => fn(P[k]?.n) || k;
export const sideOf = (k: string): Side => P[k]?.t || 'a';
export const names = (keys: string[], sep = ' & '): string => keys.map(first).join(sep);
export const other = (s: Side): Side => (s === 'a' ? 'b' : 'a');

const DOW: Record<string, string> = {
  Sun: 'Sunday', Mon: 'Monday', Tue: 'Tuesday', Wed: 'Wednesday', Thu: 'Thursday', Fri: 'Friday', Sat: 'Saturday',
};
export const dowOf = (day: string): string => DOW[day.split(' ')[0]] || day;

/** '13:10' from the session's tee label ('1:10 PM' or '13:10') */
export const teeOf = (s: Session, g: number): string =>
  (s.tees[g] || '').replace(/\s*(AM|PM)$/i, '');

const ordinal = (n: number): string => {
  const s = ['th', 'st', 'nd', 'rd'], v = n % 100;
  return `${n}${s[(v - 20) % 10] || s[v] || s[0]}`;
};
export { ordinal };

/** Key of the player who wins the hole for a side, or null (team formats). */
function bestOf(m: Match, s: Session, i: number, side: Side): string | null {
  if (s.fmt === 'Foursomes' || s.fmt === 'Aggregate') return null;
  let bn = Infinity, k: string | null = null;
  m[side].forEach(x => {
    const g = m.hs[i]?.sc[x];
    if (g === undefined || g === null || g === 'X') return;
    if ((g as number) < bn) { bn = g as number; k = x; }
  });
  return k;
}

const sessionOf = (d: CardData, m: Match): Session | undefined => d.scoringSessions.find(s => s.id === m.s);

/* ---------------------------------------------------------------- match */

export interface MatchCard {
  kind: 'match';
  key: string;
  m: Match;
  s: Session;
  r: CalcResult;
  winner: Side | 'h';
  /** hole by hole: who took it, null once the match was over */
  holes: (Side | 'h' | null)[];
  /** the hole the match ended on (1-based) */
  endedOn: number;
}

export function matchCard(d: CardData, id: string): MatchCard | null {
  const m = d.scoringMatches.find(x => x.id === id);
  const s = m && sessionOf(d, m);
  if (!m || !s) return null;
  const r = calc(m);
  if (!r.done) return null;
  const holes = m.hs.slice(0, s.holes).map((h, i) => {
    if (i >= r.played) return null;
    return h.r === 'A' ? 'a' : h.r === 'B' ? 'b' : h.r === 'H' ? 'h' : null;
  });
  return { kind: 'match', key: `match:${m.id}`, m, s, r, winner: r.w === 'h' ? 'h' : (r.w as Side), holes, endedOn: r.played };
}

/** Finished matches whose card is in (tee group submitted), for the auto-fire. */
export function submittedFinals(d: CardData): MatchCard[] {
  const out: MatchCard[] = [];
  d.scoringMatches.forEach(m => {
    const db = d.matches.find(x => x.id === m.id);
    const tg = db && d.teeGroups.find(t => t.id === db.tee_group_id);
    if (!tg?.submitted_at) return;
    const c = matchCard(d, m.id);
    if (c) out.push(c);
  });
  return out;
}

/* ------------------------------------------------------------------ day */

export interface DayGroup { s: Session; rows: { m: Match; r: CalcResult }[] }

export interface DayCard {
  kind: 'day';
  key: string;
  day: string;
  dow: string;
  courses: string;
  pts: { a: number; b: number };
  cum: { a: number; b: number };
  groups: DayGroup[];
  next: Session | null;
  /** day index, 0 = opening day */
  index: number;
  clinch: number;
}

export function dayCard(d: CardData, day: string): DayCard | null {
  const order = [...new Set(d.scoringSessions.map(s => s.day))];
  const di = order.indexOf(day);
  if (di < 0) return null;
  let cumA = 0, cumB = 0, da = 0, db = 0;
  const groups: DayGroup[] = [];
  order.slice(0, di + 1).forEach((dd, k) => {
    d.scoringSessions.filter(s => s.day === dd).forEach(s => {
      const rows = d.scoringMatches.filter(m => m.s === s.id).map(m => ({ m, r: calc(m) }));
      rows.forEach(({ r }) => {
        cumA += r.pts.a; cumB += r.pts.b;
        if (k === di) { da += r.pts.a; db += r.pts.b; }
      });
      if (k === di) groups.push({ s, rows });
    });
  });
  if (!groups.some(g => g.rows.some(x => x.r.done))) return null;
  const nextDay = order[di + 1];
  return {
    kind: 'day', key: `day:${day}`, day, dow: dowOf(day),
    courses: [...new Set(groups.map(g => g.s.course))].join(' & '),
    pts: { a: da, b: db }, cum: { a: cumA, b: cumB }, groups,
    next: nextDay ? d.scoringSessions.find(s => s.day === nextDay) || null : null,
    index: di,
    clinch: Number(d.event.clinch_points) || 5.5,
  };
}

/* --------------------------------------------------------------- finale */

export interface FinaleCard {
  kind: 'won';
  key: 'won';
  winner: Side;
  pts: { a: number; b: number };
  /** the match that clinched it, when the Cup was won on the course */
  clinch: { m: Match; s: Session; r: CalcResult } | null;
  viaShootout: boolean;
}

export function finaleCard(
  d: CardData,
  when: Record<string, number>,
  shootout?: { a: number[]; b: number[] } | null,
): FinaleCard | null {
  const clinchPts = Number(d.event.clinch_points) || 5.5;
  let a = 0, b = 0;
  d.scoringMatches.forEach(m => { const r = calc(m); a += r.pts.a; b += r.pts.b; });
  // the whole Cup decided, not merely every match posted so far
  const allDone = d.scoringMatches.length > 0 && d.scoringMatches.every(m => calc(m).done)
    && a + b >= plannedPoints(d.scoringSessions);
  if (allDone && a === b) {
    const sh = shootoutCard(d, shootout);
    return sh ? { kind: 'won', key: 'won', winner: sh.winner, pts: { a, b }, clinch: null, viaShootout: true } : null;
  }
  interface F { at: number; m: Match; s: Session; r: CalcResult }
  const finals: F[] = [];
  d.scoringMatches.forEach(m => {
    const r = calc(m); const s = sessionOf(d, m);
    if (!r.done || !s) return;
    let at = 0;
    m.hs.forEach((h, i) => { if (h.r) at = Math.max(at, when[`${m.id}:${i + 1}`] || 0); });
    finals.push({ at, m, s, r });
  });
  finals.sort((x, y) => x.at - y.at);
  let wa = 0, wb = 0;
  for (const f of finals) {
    wa += f.r.pts.a; wb += f.r.pts.b;
    if (wa >= clinchPts || wb >= clinchPts) {
      return { kind: 'won', key: 'won', winner: wa >= clinchPts ? 'a' : 'b', pts: { a, b }, clinch: f, viaShootout: false };
    }
  }
  return null;
}

/* ------------------------------------------------------------- shootout */

export interface ShootoutCard {
  kind: 'shootout';
  key: 'shootout';
  a: number[]; b: number[]; ta: number; tb: number;
  winner: Side;
  captains: { a: string; b: string };
  s: Session | null;   // the last day's course
}

export function shootoutCard(d: CardData, sh: { a: number[]; b: number[] } | null | undefined): ShootoutCard | null {
  if (!sh || sh.a.length !== 3 || sh.b.length !== 3) return null;
  const sum = (xs: number[]) => xs.reduce((t, x) => t + (Number(x) || 0), 0);
  const ta = sum(sh.a), tb = sum(sh.b);
  if (ta === tb) return null;
  const cap = (side: Side) => {
    const ks = Object.keys(P).filter(k => P[k].t === side);
    const k = ks.find(x => P[x].cap) || ks[0];
    return k ? first(k) : CFG.teams[side].name;
  };
  return {
    kind: 'shootout', key: 'shootout', a: sh.a, b: sh.b, ta, tb, winner: ta < tb ? 'a' : 'b',
    captains: { a: cap('a'), b: cap('b') },
    s: d.scoringSessions[d.scoringSessions.length - 1] || null,
  };
}

/* --------------------------------------------------------------- player */

export interface Record3 { w: number; l: number; h: number }

export function recordOf(d: CardData, k: string): Record3 {
  const rec = { w: 0, l: 0, h: 0 };
  const side = sideOf(k);
  d.scoringMatches.forEach(m => {
    if (!m[side].includes(k)) return;
    const r = calc(m);
    if (!r.done) return;
    if (r.w === 'h') rec.h++; else if (r.w === side) rec.w++; else rec.l++;
  });
  return rec;
}

export const recordLabel = (r: Record3): string => `${r.w}-${r.l}-${r.h}`;

export interface PlayerCard {
  kind: 'player';
  key: string;
  pkey: string;
  name: string;
  side: Side;
  hcp: number;
  captain: boolean;
  /** first tee of the week: the first session, and this player's tee if pairings are out */
  first: { s: Session; tee: string } | null;
  record: Record3;
  played: number;
}

export function playerCard(d: CardData, pkey: string): PlayerCard | null {
  const p = P[pkey];
  if (!p) return null;
  const s0 = d.scoringSessions[0] || null;
  let first: PlayerCard['first'] = null;
  if (s0) {
    const m = d.scoringMatches.find(x => x.s === s0.id && (x.a.includes(pkey) || x.b.includes(pkey)));
    first = { s: s0, tee: m ? teeOf(s0, m.g) : teeOf(s0, 0) };
  }
  const record = recordOf(d, pkey);
  return {
    kind: 'player', key: `player:${pkey}`, pkey, name: p.n, side: p.t, hcp: p.h, captain: !!p.cap,
    first, record, played: record.w + record.l + record.h,
  };
}

/* ----------------------------------------------------------------- week */

export interface WeekCard {
  kind: 'week';
  key: string;
  pkey: string;
  name: string;
  side: Side;
  record: Record3;
  holesWon: number;
  birdies: number;
  eagles: number;
  /** matches this player closed out, most recent first */
  closeouts: { opp: string; hole: number; s: Session; label: string }[];
  /** longest run of holes won by the player's side in one match */
  streak: { n: number; s: Session } | null;
  /** best own-ball hole of the week */
  best: { what: 'Eagle' | 'Birdie'; hole: number; s: Session } | null;
  partners: string[];
  complete: boolean;
}

export function weekCard(d: CardData, pkey: string): WeekCard | null {
  const p = P[pkey];
  if (!p) return null;
  const side = p.t;
  let holesWon = 0, birdies = 0, eagles = 0;
  const closeouts: WeekCard['closeouts'] = [];
  let bestRun = 0, runS: Session | null = null;
  let best: WeekCard['best'] = null;
  const partners = new Set<string>();
  let played = 0, done = 0;

  d.scoringMatches.forEach(m => {
    if (!m[side].includes(pkey)) return;
    const s = sessionOf(d, m);
    if (!s) return;
    const r = calc(m);
    if (r.played) played++;
    if (r.done) done++;
    m[side].filter(k => k !== pkey).forEach(k => partners.add(first(k)));
    let run = 0;
    for (let i = 0; i < r.played; i++) {
      const h = m.hs[i];
      const mine = h.r === (side === 'a' ? 'A' : 'B');
      if (mine) { holesWon++; run++; if (run > bestRun) { bestRun = run; runS = s; } }
      else run = 0;
      const g = h.sc[pkey];
      if (typeof g === 'number' && s.fmt !== 'Foursomes') {
        const rel = g - s.par[i];
        if (rel <= -2) { eagles++; if (!best || best.what !== 'Eagle') best = { what: 'Eagle', hole: i + 1, s }; }
        else if (rel === -1) { birdies++; if (!best) best = { what: 'Birdie', hole: i + 1, s }; }
      }
    }
    if (r.done && r.w === side) {
      closeouts.push({ opp: names(m[other(side)]), hole: r.played, s, label: r.label });
    }
  });
  const streak: WeekCard['streak'] = bestRun >= 3 && runS ? { n: bestRun, s: runS } : null;
  const total = d.scoringMatches.filter(m => m[side].includes(pkey)).length;
  return {
    kind: 'week', key: `week:${pkey}`, pkey, name: p.n, side,
    record: recordOf(d, pkey), holesWon, birdies, eagles, closeouts, streak, best,
    partners: [...partners], complete: total > 0 && done === total && played > 0,
  };
}

/* ----------------------------------------------------------------- live */

export interface LiveRow { m: Match; r: CalcResult; lead: Side | null; thru: number }

export interface LiveCard {
  kind: 'live';
  key: 'live';
  s: Session;
  rows: LiveRow[];
  /** points in the bank across the Cup */
  pts: { a: number; b: number };
  /** the bank plus every live match as it stands */
  proj: { a: number; b: number };
}

export function liveCard(d: CardData): LiveCard | null {
  let a = 0, b = 0, pa = 0, pb = 0;
  d.scoringMatches.forEach(m => {
    const r = calc(m);
    a += r.pts.a; b += r.pts.b;
    if (r.done) { pa += r.pts.a; pb += r.pts.b; }
    else if (r.played) { if (r.w === 'a') pa++; else if (r.w === 'b') pb++; else { pa += .5; pb += .5; } }
  });
  const live = d.scoringSessions.find(s => {
    const ms = d.scoringMatches.filter(m => m.s === s.id);
    return ms.some(m => calc(m).played > 0) && !ms.every(m => calc(m).done);
  });
  if (!live) return null;
  const rows: LiveRow[] = d.scoringMatches.filter(m => m.s === live.id).map(m => {
    const r = calc(m);
    return { m, r, lead: r.w === 'a' || r.w === 'b' ? r.w : null, thru: r.played };
  });
  return { kind: 'live', key: 'live', s: live, rows, pts: { a, b }, proj: { a: pa, b: pb } };
}

/* ---------------------------------------------------------------- spikes */

export type SpikeType = 'eagle' | 'streak' | 'walkoff';

export interface SpikeCard {
  kind: 'spike';
  key: string;
  type: SpikeType;
  m: Match;
  s: Session;
  side: Side;
  /** the player, or the pair at team formats */
  who: string;
  /** 1-based hole the spike landed on */
  hole: number;
  /** the big number: gross score for an eagle, holes for a streak, the last hole for a walk-off */
  num: string;
  headline: string;
  line: string;
}

/** Every spike in the data, oldest first within a match. */
export function spikes(d: CardData): SpikeCard[] {
  const out: SpikeCard[] = [];
  d.scoringMatches.forEach(m => {
    const s = sessionOf(d, m);
    if (!s) return;
    const r = calc(m);
    let run = 0, runSide: Side | null = null;
    for (let i = 0; i < r.played; i++) {
      const h = m.hs[i];
      const w: Side | null = h.r === 'A' ? 'a' : h.r === 'B' ? 'b' : null;

      // eagles: any player's gross, own-ball or aggregate
      if (s.fmt !== 'Foursomes') {
        [...m.a, ...m.b].forEach(k => {
          const g = h.sc[k];
          if (typeof g === 'number' && g - s.par[i] <= -2) {
            const side = sideOf(k);
            out.push({
              kind: 'spike', key: `spike:eagle:${m.id}:${i + 1}`, type: 'eagle', m, s, side,
              who: first(k), hole: i + 1, num: String(g),
              headline: g - s.par[i] <= -3 ? 'Albatross.' : 'Eagle.',
              line: `${ordinal(i + 1)} at ${s.course}, par ${s.par[i]}. ${w === side ? `${CFG.teams[side].name} take the hole.` : ''}`.trim(),
            });
          }
        });
      }

      // streaks: four holes in a row for one side
      if (w && w === runSide) run++; else { run = w ? 1 : 0; runSide = w; }
      if (w && run === 4) {
        const who = s.fmt === 'Singles' ? first(m[w][0]) : names(m[w]);
        out.push({
          kind: 'spike', key: `spike:streak:${m.id}:${i + 1}`, type: 'streak', m, s, side: w,
          who, hole: i + 1, num: '4',
          headline: 'Four in a row.',
          line: `${ordinal(i - 2)} through ${ordinal(i + 1)} at ${s.course}.`,
        });
      }
    }

    // walk-off: the match went the distance and the last hole decided it
    if (r.done && r.w && r.w !== 'h' && r.played === s.holes) {
      const last = m.hs[s.holes - 1]?.r;
      const w = r.w as Side;
      if (last === (w === 'a' ? 'A' : 'B')) {
        const bk = bestOf(m, s, s.holes - 1, w);
        const g = bk ? m.hs[s.holes - 1].sc[bk] : null;
        const rel = typeof g === 'number' ? g - s.par[s.holes - 1] : null;
        const shot = rel === null ? '' : rel <= -2 ? 'an eagle' : rel === -1 ? 'a birdie' : rel === 0 ? 'a par' : '';
        out.push({
          kind: 'spike', key: `spike:walkoff:${m.id}:${s.holes}`, type: 'walkoff', m, s, side: w,
          who: bk ? first(bk) : names(m[w]), hole: s.holes, num: String(s.holes),
          headline: 'Won on the last.',
          line: `${shot ? `${shot[0].toUpperCase()}${shot.slice(1)} on ${s.holes}` : `Took the ${ordinal(s.holes)}`} to beat ${names(m[other(w)])}, ${r.label}.`,
        });
      }
    }
  });
  return out;
}

export function spikeCard(d: CardData, key: string): SpikeCard | null {
  return spikes(d).find(x => x.key === key) || null;
}

/* ------------------------------------------------- player of the round */

export interface PotrCard {
  kind: 'potr';
  key: string;
  s: Session;
  winner: RaceRow;
  second: RaceRow | null;
}

/** The round's best full card, once the round is final. */
export function potrCard(d: CardData, sid: string): PotrCard | null {
  const r = roundRaces(d.scoringSessions, d.scoringMatches).find(x => x.roundId === sid);
  if (!r || !r.winner) return null;
  const s = d.scoringSessions.find(x => x.id === sid)!;
  return { kind: 'potr', key: `potr:${sid}`, s, winner: r.winner, second: r.second };
}

/* ------------------------------------------------------ the match story */

/** Running lead after each played hole: +n is side a up, -n side b up. */
export function leadSeries(m: Match): number[] {
  const out: number[] = [];
  let d = 0;
  for (const h of m.hs) {
    if (!h.r) break;
    d += h.r === 'A' ? 1 : h.r === 'B' ? -1 : 0;
    out.push(d);
  }
  return out;
}

/**
 * One sentence on how the match went, from the shape of the lead line:
 * wire to wire, a comeback, a seesaw, or a halve that nearly wasn't.
 */
export function matchStory(m: Match, s: Session, r: CalcResult): string {
  // the story stops where the match did; bye holes are the King's Race's business
  const ser = leadSeries(m).slice(0, r.played || undefined);
  const n = ser.length;
  if (n === 0) return '';
  const A = names(m.a), B = names(m.b);
  const side = (v: number): Side | null => (v > 0 ? 'a' : v < 0 ? 'b' : null);
  const w = r.w === 'a' || r.w === 'b' ? r.w : null;
  const front = Math.ceil(s.holes / 2);
  const nm = (x: Side) => (x === 'a' ? A : B);
  const sgn = (x: Side) => (x === 'a' ? 1 : -1);
  const wins = (x: Side, from: number) => m.hs.slice(from, n).filter(h => h.r === (x === 'a' ? 'A' : 'B')).length;
  const tail = Math.min(5, n);
  const holeWord = (k: number) => `${k} hole${k === 1 ? '' : 's'}`;
  // largest lead each side held, and where
  const peak = (x: Side) => {
    let best = 0, at = 0;
    ser.forEach((v, i) => { if (v * sgn(x) > best) { best = v * sgn(x); at = i + 1; } });
    return { best, at };
  };
  // lead changes: transitions between the two signs, ignoring level holes
  let changes = 0, last: Side | null = null;
  ser.forEach(v => { const x = side(v); if (x && last && x !== last) changes++; if (x) last = x; });

  // a stable pick from a few phrasings, so the same match always tells the same story
  const pick = <T,>(xs: T[]) => xs[[...m.id].reduce((h, ch) => (h * 31 + ch.charCodeAt(0)) >>> 0, 7) % xs.length];
  const th = (k: number) => ordinal(k);

  if (!w) {
    // halved
    const pa = peak('a'), pb = peak('b');
    const big = pa.best >= pb.best ? { x: 'a' as Side, ...pa } : { x: 'b' as Side, ...pb };
    if (big.best >= 2) {
      const left = s.holes - big.at;
      return pick([
        `${nm(big.x)} had this one by the throat, ${big.best} up with ${left} to play. ${nm(other(big.x))} pried it loose hole by hole and walked off with a half that felt like a win.`,
        `${big.best} up with ${left} left, ${nm(big.x)} were already spending the point. ${nm(other(big.x))} took it back one hole at a time and the match ended where it began: all square.`,
      ]);
    }
    return changes >= 2
      ? pick([
        `The lead changed hands ${changes} times and neither side could land the knockout. Half a point each and an argument that runs all night.`,
        `Back and forth ${changes} times over, punch for punch, and nobody could put the other away. All square, and rightly so.`,
      ])
      : pick([
        `Never more than a hole in it, start to finish. ${n} holes of trench warfare and a half each to show for it.`,
        `Nose to nose for ${n} holes and not a sliver of daylight. They split the point and walked off the 18th still glaring.`,
      ]);
  }

  const L = other(w);
  const lp = peak(L);
  const firstLead = ser.findIndex(v => side(v) === w) + 1;
  const endHole = r.done && r.w !== 'h' && r.played < s.holes ? r.played : 0;
  const closer = endHole ? pick([
    ` The handshake came on the ${th(endHole)}.`,
    ` It was over on the ${th(endHole)}, and everyone knew it three holes earlier.`,
    ` ${nm(w)} shut the door on the ${th(endHole)}.`,
  ]) : '';

  if (lp.best === 0) {
    // never trailed
    const wp = peak(w);
    if (firstLead <= 2 && wp.best >= 3) {
      return pick([
        `${nm(w)} took the ${th(firstLead)} and never let go. ${wp.best} up through ${wp.at}, this was a procession, not a match.${closer}`,
        `Front-running from the ${th(firstLead)}, ${nm(w)} stretched it to ${wp.best} up by the ${th(wp.at)} and ${nm(L)} never got within shouting distance.${closer}`,
        `${nm(L)} never led a hole. ${nm(w)} went ahead on the ${th(firstLead)}, were ${wp.best} up through ${wp.at}, and turned the closing stretch into a victory lap.${closer}`,
      ]);
    }
    if (firstLead <= 2) {
      return pick([
        `${nm(w)} went ahead on the ${th(firstLead)} and spent the rest of the day guarding a slim lead like it was the Lassie itself.${closer}`,
        `Ahead from the ${th(firstLead)}, never by much, never in doubt. ${nm(w)} played keep-away for ${n} holes.${closer}`,
      ]);
    }
    return pick([
      `Level through ${firstLead - 1}, and then ${nm(w)} found another gear on the ${th(firstLead)}. ${nm(L)} never got it back.${closer}`,
      `Nothing in it for ${firstLead - 1} holes. Then ${nm(w)} struck on the ${th(firstLead)} and ${nm(L)} spent the rest of the round chasing.${closer}`,
    ]);
  }
  if (lp.best >= 2) {
    // a comeback: count the holes after the other side's high-water mark
    const from = lp.at, k = n - from;
    const late = wins(w, from), lost = wins(L, from);
    const clean = lost === 0 ? ' without dropping one' : '';
    if (lp.at <= front) {
      return pick([
        `${nm(L)} came out swinging, ${lp.best} up through ${lp.at}, and the match looked over. It wasn't. ${nm(w)} won ${late} of the last ${holeWord(k)}${clean} and stole it.${closer}`,
        `Despite a blistering start from ${nm(L)}, ${lp.best} up through ${lp.at}, ${nm(w)} came roaring back, winning ${late} of the last ${holeWord(k)}${clean}.${closer}`,
        `${lp.best} down through ${lp.at}, ${nm(w)} were being written off. Then the comeback: ${late} holes won of the last ${k}${clean}, and ${nm(L)} could only watch it slip.${closer}`,
      ]);
    }
    return pick([
      `${nm(w)} were ${lp.best} down with ${s.holes - lp.at} to play and had no business winning this. ${late} of the last ${holeWord(k)}${clean} later, they did.${closer}`,
      `Down ${lp.best} through ${lp.at}, ${nm(w)} pulled off the great escape, winning ${late} of the last ${holeWord(k)}${clean} while ${nm(L)} watched a sure point evaporate.${closer}`,
    ]);
  }
  if (changes >= 3) {
    return pick([
      `A brawl. The lead changed hands ${changes} times before ${nm(w)} landed the last punch, taking ${wins(w, n - tail)} of the final ${holeWord(tail)}.${closer}`,
      `Nobody could hold this one. ${changes} lead changes, and it was ${nm(w)} who had it when the music stopped, winning ${wins(w, n - tail)} of the last ${holeWord(tail)}.${closer}`,
    ]);
  }
  const took = (() => { for (let i = n - 1; i >= 0; i--) if (side(ser[i]) !== w) return i + 2; return firstLead; })();
  return pick([
    `${nm(L)} drew first blood, but it didn't last. ${nm(w)} took the lead for good on the ${th(took)} and never looked over their shoulder.${closer}`,
    `${nm(L)} nosed ahead early and ${nm(w)} let them enjoy it for a while. The ${th(took)} settled who was really in charge.${closer}`,
    `An early scare from ${nm(L)}, then ${nm(w)} took over on the ${th(took)} and the match went one direction from there.${closer}`,
  ]);
}

/* ---------------------------------------------------------- once per phone */

const SEEN = 'fc-cards-seen';
const seen = (): string[] => {
  try { return JSON.parse(localStorage.getItem(SEEN) || '[]') as string[]; } catch { return []; }
};
export function cardSeen(key: string): boolean { return seen().includes(key); }
export function markCardSeen(key: string): void {
  try {
    const s = seen();
    if (!s.includes(key)) localStorage.setItem(SEEN, JSON.stringify([...s, key]));
  } catch { /* private mode: it simply shows again */ }
}

/**
 * The match result to auto-open now: the newest submitted final this
 * player was part of that this phone hasn't seen. Nothing fires for
 * matches you weren't in; those wait on Schedule.
 */
export function nextMatchCard(d: CardData): MatchCard | null {
  if (!d.meKey) return null;
  const mine = submittedFinals(d).filter(c => c.m.a.includes(d.meKey) || c.m.b.includes(d.meKey));
  return mine.reverse().find(c => !cardSeen(c.key)) || null;
}
