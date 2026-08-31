/**
 * Sample data for the design system page: enough of a cup to make the
 * live components (strip, scorecard, cards) render as they do in the app.
 * Nothing here touches Supabase.
 */
import { setContext, type Player, type Session, type Match, type HoleData } from '../lib/scoring';

export const PLAYERS: Record<string, Player> = {
  griffin: { n: 'Griffin S.', t: 'a', h: 15, cap: true },
  devin:   { n: 'Devin E.',   t: 'a', h: 7 },
  brian:   { n: 'Brian K.',   t: 'a', h: 6 },
  matt:    { n: 'Matt J.',    t: 'a', h: 15 },
  kyle:    { n: 'Kyle P.',    t: 'b', h: 15, cap: true },
  phil:    { n: 'Phil J.',    t: 'b', h: 11 },
  justin:  { n: 'Justin D.',  t: 'b', h: 7 },
  jt:      { n: 'JT W.',      t: 'b', h: 15 },
};

export const SESSIONS: Session[] = [
  {
    id: 'r1', rd: 'Round 1', day: 'Thu Oct 8', fmt: 'Four-ball', course: 'Mammoth Dunes', holes: 18,
    tees: ['12:00 PM', '12:10 PM'], scorer: ['griffin', 'justin'], state: 'live',
    par: [4, 4, 5, 3, 4, 4, 5, 3, 4, 4, 5, 4, 3, 4, 5, 3, 4, 5],
    si:  [11, 9, 3, 15, 5, 13, 1, 17, 7, 12, 4, 8, 18, 14, 6, 16, 10, 2],
  },
  {
    id: 'r4', rd: 'Round 4', day: 'Sat Oct 10', fmt: 'Singles', course: 'Sedge Valley', holes: 18,
    tees: ['10:10 AM', '10:30 AM'], scorer: ['devin', 'phil'], state: 'upcoming',
    par: [4, 4, 4, 4, 3, 4, 3, 3, 4, 4, 5, 4, 3, 4, 3, 4, 4, 4],
    si:  [13, 9, 1, 3, 7, 15, 17, 11, 5, 8, 2, 14, 18, 6, 16, 4, 10, 12],
  },
];

/** 'A','B','H' per hole, '-' for not played; gross scores invented to fit. */
function holes(str: string, s: Session, a: string[], b: string[]): HoleData[] {
  return Array.from({ length: s.holes }, (_, i) => {
    const c = str[i] || '-';
    if (c === '-') return { r: null, sc: {}, d: false, by: null, at: null, pend: false };
    const par = s.par[i];
    const sc: Record<string, number | 'X' | undefined> = {};
    const win = c === 'A' ? a : c === 'B' ? b : null;
    const lose = c === 'A' ? b : c === 'B' ? a : null;
    if (win && lose) {
      win.forEach((k, j) => { sc[k] = j === 0 ? par - (i % 5 === 0 ? 1 : 0) : par + 1; });
      lose.forEach((k, j) => { sc[k] = par + (j === 0 ? 1 : 2); });
    } else {
      [...a, ...b].forEach((k, j) => { sc[k] = par + (j % 2); });
    }
    return { r: c as 'A' | 'B' | 'H', sc, d: true, by: null, at: null, pend: false };
  });
}

const [r1, r4] = SESSIONS;

export const MATCHES: Match[] = [
  { id: 's1', s: 'r1', g: 0, a: ['griffin', 'matt'], b: ['kyle', 'jt'],
    hs: holes('AABHABAAHABABHA', r1, ['griffin', 'matt'], ['kyle', 'jt']) },      // Vikes 4&3
  { id: 's2', s: 'r1', g: 1, a: ['devin', 'brian'], b: ['phil', 'justin'],
    hs: holes('BHABBHAHBAA', r1, ['devin', 'brian'], ['phil', 'justin']) },     // all square thru 11
  { id: 's3', s: 'r4', g: 0, a: ['griffin'], b: ['kyle'], hs: holes('', r4, ['griffin'], ['kyle']) },
  { id: 's4', s: 'r4', g: 0, a: ['devin'], b: ['justin'], hs: holes('', r4, ['devin'], ['justin']) },
  { id: 's5', s: 'r4', g: 1, a: ['brian'], b: ['phil'], hs: holes('', r4, ['brian'], ['phil']) },
  { id: 's6', s: 'r4', g: 1, a: ['matt'], b: ['jt'], hs: holes('', r4, ['matt'], ['jt']) },
];

export function useSampleContext() {
  setContext(PLAYERS, SESSIONS, MATCHES);
}
