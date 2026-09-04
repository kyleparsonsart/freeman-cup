/**
 * Per-match moment lines for the public scoreboard, derived from the
 * hole results the same way the app's feed is. One line per hole won,
 * newest first, in the house voice:
 *   "Kyle and Matt win the 1st hole with Matt's par, 1 up."
 * plus a closing line once the match is decided.
 */
import { calc, getsStroke, runningAt, CFG, P, type Match, type Session } from '../lib/scoring';

export interface Moment {
  key: string;
  at: number;                 // epoch ms, 0 if unknown
  side: 'a' | 'b' | '';       // which side the line belongs to
  gold: boolean;              // a highlight (net eagle or better)
  win: boolean;               // a match-closing line
  html: string;               // safe: only our own markup around escaped names
}

const esc = (s: string) => s.replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c] as string));
const fn = (k: string) => esc((P[k]?.n || k).split(' ')[0]);
const list = (xs: string[]) => xs.length <= 1 ? xs.join('') : `${xs.slice(0, -1).join(', ')} and ${xs[xs.length - 1]}`;
const who = (side: 'a' | 'b', keys: string[]) => `<span class="who ${side === 'a' ? 'vik' : 'cel'}">${list(keys.map(fn))}</span>`;
const ord = (n: number) => `${n}${n % 100 >= 11 && n % 100 <= 13 ? 'th' : ['th', 'st', 'nd', 'rd'][n % 10] || 'th'}`;
const poss = (n: string) => `${n}'${n.endsWith('s') ? '' : 's'}`;

/** what a net score against par is called */
function scoreWord(rel: number, stroked: boolean): string {
  const base = rel <= -3 ? 'albatross' : rel === -2 ? 'eagle' : rel === -1 ? 'birdie'
    : rel === 0 ? 'par' : rel === 1 ? 'bogey' : rel === 2 ? 'double' : `${rel} over`;
  return stroked && rel <= 0 ? `net ${base}` : base;
}

/** the standout score on the winning side of a hole */
function standout(m: Match, s: Session, i: number, side: 'a' | 'b'): { text: string; rel: number } | null {
  const par = s.par[i];
  if (par === undefined) return null;
  const keys = s.fmt === 'Foursomes' ? [] : m[side];
  const scored = keys
    .map(k => {
      const g = m.hs[i].sc[k];
      if (typeof g !== 'number') return null;
      const st = getsStroke(m, k, i);
      return { k, net: g - st, rel: g - st - par, stroked: st > 0 };
    })
    .filter((x): x is NonNullable<typeof x> => !!x)
    .sort((x, y) => x.net - y.net);
  if (!scored.length) return null;
  const best = scored[0];
  const same = scored.filter(x => x.rel === best.rel && x.stroked === best.stroked);
  const word = scoreWord(best.rel, best.stroked);
  if (keys.length === 1) return { text: `${/^[aeiou]/.test(word) ? 'an' : 'a'} ${word}`, rel: best.rel };
  if (same.length > 1) {
    const plural = word.endsWith('s') ? word : `${word}s`;
    return { text: `${plural} from ${list(same.map(x => fn(x.k)))}`, rel: best.rel };
  }
  return { text: `${poss(fn(best.k))} ${word}`, rel: best.rel };
}

/** the match state after hole i, from the hole winner's point of view */
const stateAfter = (m: Match, i: number, w: 'a' | 'b'): string => {
  const t = runningAt(m, i);                       // 'All square' | '2 up VIK'
  if (t === 'All square') return 'all square';
  const [n, , short] = t.split(' ');
  const leader = short === CFG.teams.a.short ? 'a' : 'b';
  return leader === w ? `${n} up` : `${n} down`;
};

export function matchMoments(m: Match, s: Session): Moment[] {
  const out: Moment[] = [];
  const r = calc(m);
  for (let i = 0; i < r.played; i++) {
    const h = m.hs[i];
    if (!h?.r || h.r === 'H') continue;
    const w = h.r === 'A' ? 'a' : 'b';
    const so = standout(m, s, i, w);
    const withPart = so ? ` with ${so.text}` : '';
    const at = h.at ? new Date(h.at).getTime() : 0;
    out.push({
      key: `h:${m.id}:${i}`, at, side: w, win: false,
      gold: !!so && so.rel <= -2,
      html: `${who(w, m[w])} ${m[w].length === 1 ? 'wins' : 'win'} the ${ord(i + 1)} hole${withPart}, <b>${stateAfter(m, i, w)}</b>.`,
    });
  }
  if (r.done) {
    const last = m.hs[Math.max(0, r.played - 1)];
    const at = last?.at ? new Date(last.at).getTime() + 1 : 0;
    if (r.w === 'h') {
      out.push({ key: `f:${m.id}`, at, side: '', gold: false, win: true,
        html: `<b>Halved.</b> ${who('b', m.b)} and ${who('a', m.a)} split the point.` });
    } else if (r.w) {
      const l = r.w === 'a' ? 'b' : 'a';
      out.push({ key: `f:${m.id}`, at, side: r.w, gold: false, win: true,
        html: `<b>${CFG.teams[r.w].name} take the point.</b> ${who(r.w, m[r.w])} ${m[r.w].length === 1 ? 'beats' : 'beat'} ${who(l, m[l])}, ${esc(r.label)}.` });
    }
  }
  return out.reverse();
}

/** "10:12" in the course's time zone */
export const clockCT = (ms: number): string =>
  ms ? new Intl.DateTimeFormat('en-US', { hour: 'numeric', minute: '2-digit', hour12: true, timeZone: 'America/Chicago' })
    .format(new Date(ms)).replace(/\s?[AP]M$/i, '') : '';
