/**
 * Scoring engine — ported verbatim from freeman-cup-v66.html.
 *
 * All data structures mirror the prototype's in-memory model.
 * The React layer maps Supabase rows into this shape before calling these functions.
 */

/* ---- shared types ---- */

export interface Player {
  n: string;   // display name
  t: 'a' | 'b'; // side
  h: number;   // handicap index
  cap?: boolean;
}

export interface TeamCfg {
  name: string;
  short: string;
}

export interface HcpCfg {
  on: boolean;
  fourball: number;
  foursomes: number;
  aggregate: number;
  singles: number;
  prorate: boolean;
}

export interface Session {
  id: string;
  rd: string;
  day: string;
  fmt: 'Four-ball' | 'Foursomes' | 'Aggregate' | 'Singles';
  course: string;
  holes: number;
  tees: string[];
  scorer: string[];
  state: string;
  par: number[];
  si: number[] | null;
}

export interface HoleData {
  r: 'A' | 'B' | 'H' | null;
  sc: Record<string, number | 'X' | undefined>;
  d: boolean;
  by: string | null;
  at: string | null;
  pend?: boolean;
}

export interface Match {
  id: string;
  s: string;   // session id
  g: number;   // group index
  a: string[]; // side a player keys
  b: string[]; // side b player keys
  hs: HoleData[];
  odds?: { a: string; b: string };
  edit?: string;
  at?: string;
}

export interface CalcResult {
  done: boolean;
  w: 'a' | 'b' | 'h' | null;
  played: number;
  diff: number;
  N: number;
  byeStart: number;
  dormie: boolean;
  label: string;
  pts: { a: number; b: number };
}

export interface DeriveResult {
  r: 'A' | 'B' | 'H' | null;
  why: string | null;
}

export interface HeadlineResult {
  txt: string;
  chip: [string, string] | null;
  col: string;
}

/* ---- context: these must be set before calling scoring functions ---- */

export let P: Record<string, Player> = {};
export let SESSIONS: Session[] = [];
export let CFG = {
  teams: { a: { name: 'Vikes', short: 'VIK' }, b: { name: 'Celts', short: 'CEL' } } as Record<string, TeamCfg>,
  hcp: { on: true, fourball: 100, foursomes: 50, aggregate: 100, singles: 100, prorate: true } as HcpCfg,
  trophy: 'The Lassie',
};
export let MATCHES: Match[] = [];

export function setContext(
  players: Record<string, Player>,
  sessions: Session[],
  matches: Match[],
  cfg?: Partial<typeof CFG>,
) {
  P = players;
  SESSIONS = sessions;
  MATCHES = matches;
  if (cfg) Object.assign(CFG, cfg);
}

const ses = (id: string): Session => SESSIONS.find(s => s.id === id)!;

/* ---- helpers ---- */

function holeKeys(m: Match): string[] {
  const s = ses(m.s);
  return s.fmt === 'Foursomes' ? ['a', 'b'] : [...m.a, ...m.b];
}

function missingIn(m: Match, i: number): string[] {
  const h = m.hs[i];
  return holeKeys(m).filter(k => h.sc[k] === undefined || h.sc[k] === null);
}

/* ---- ported functions ---- */

export function strokeMap(m: Match): Record<string, number> {
  const s = ses(m.s), all = [...m.a, ...m.b], out: Record<string, number> = {};
  if (!CFG.hcp.on || !s.si) { (s.fmt === 'Foursomes' ? ['a', 'b'] : all).forEach(k => out[k] = 0); return out; }
  const key = s.fmt === 'Four-ball' ? 'fourball' : s.fmt === 'Foursomes' ? 'foursomes'
    : s.fmt === 'Aggregate' ? 'aggregate' : 'singles';
  const pct = CFG.hcp[key] / 100;
  const pr = (v: number) => Math.max(0, Math.round(v * pct * (CFG.hcp.prorate ? s.holes / 18 : 1)));
  if (s.fmt === 'Foursomes') {
    const ta = P[m.a[0]].h + P[m.a[1]].h, tb = P[m.b[0]].h + P[m.b[1]].h;
    out.a = ta > tb ? pr(ta - tb) : 0; out.b = tb > ta ? pr(tb - ta) : 0; return out;
  }
  const low = Math.min(...all.map(p => P[p].h));
  all.forEach(p => out[p] = pr(P[p].h - low)); return out;
}

export function getsStroke(m: Match, k: string, i: number): number {
  const s = ses(m.s); if (!s.si) return 0; return s.si[i] <= (strokeMap(m)[k] || 0) ? 1 : 0;
}

export function holeComplete(m: Match, i: number): boolean { return missingIn(m, i).length === 0; }

export function settle(m: Match, i: number): void {
  const h = m.hs[i]; h.d = true; h.r = holeComplete(m, i) ? derive(m, i).r : null;
}

export function derive(m: Match, i: number): DeriveResult {
  const s = ses(m.s), h = m.hs[i];

  // Aggregate match play: both partners' nets are summed; the lower
  // total takes the hole. A side without both scores has no total.
  if (s.fmt === 'Aggregate') {
    const agg: Record<'a' | 'b', { net: number; ok: boolean; txt: string }> = {
      a: { net: 0, ok: true, txt: '' }, b: { net: 0, ok: true, txt: '' },
    };
    (['a', 'b'] as const).forEach(t => {
      const ks = t === 'a' ? m.a : m.b;
      let net = 0, strokes = 0;
      const gross: number[] = [];
      ks.forEach(k => {
        const g = h.sc[k];
        if (g === undefined || g === null || g === 'X') { agg[t].ok = false; return; }
        const st = getsStroke(m, k, i);
        net += (g as number) - st;
        strokes += st;
        gross.push(g as number);
      });
      agg[t].net = net;
      agg[t].txt = `${CFG.teams[t].name} ${gross.join(' + ')}${strokes ? ` less ${strokes}` : ''} = ${net}`;
    });
    if (!agg.a.ok && !agg.b.ok) return { r: null, why: null };
    if (!agg.a.ok) return { r: 'B', why: `${CFG.teams.a.name} have no total. ${CFG.teams.b.name} take it.` };
    if (!agg.b.ok) return { r: 'A', why: `${CFG.teams.b.name} have no total. ${CFG.teams.a.name} take it.` };
    if (agg.a.net < agg.b.net) return { r: 'A', why: `${agg.a.txt} beats ${agg.b.txt}.` };
    if (agg.b.net < agg.a.net) return { r: 'B', why: `${agg.b.txt} beats ${agg.a.txt}.` };
    return { r: 'H', why: `${agg.a.txt} ties ${agg.b.txt}. Halved.` };
  }

  const sides: Record<string, string[]> = s.fmt === 'Foursomes' ? { a: ['a'], b: ['b'] } : { a: m.a, b: m.b };
  const best: Record<string, { net: number; who: string | null; gross: number | null }> = {};
  (['a', 'b'] as const).forEach(t => {
    let bn = Infinity, who: string | null = null, bg: number | null = null;
    sides[t].forEach(k => {
      const g = h.sc[k]; if (g === undefined || g === null || g === 'X') return;
      const net = (g as number) - getsStroke(m, k, i); if (net < bn) { bn = net; who = k; bg = g as number; }
    });
    best[t] = { net: bn, who, gross: bg };
  });
  const label = (k: string) => s.fmt === 'Foursomes' ? CFG.teams[k].name : (P[k] ? P[k].n : '');
  if (best.a.net === Infinity && best.b.net === Infinity) return { r: null, why: null };
  if (best.a.net === Infinity) return { r: 'B', why: `${CFG.teams.a.name} picked up. ${CFG.teams.b.name} take it.` };
  if (best.b.net === Infinity) return { r: 'A', why: `${CFG.teams.b.name} picked up. ${CFG.teams.a.name} take it.` };
  const f = (t: string) => {
    const b = best[t], st = getsStroke(m, b.who!, i);
    return `${label(b.who!)} ${b.gross}${st ? ` less 1 = ${b.net}` : ''}`;
  };
  if (best.a.net < best.b.net) return { r: 'A', why: `${f('a')} beats ${f('b')}.` };
  if (best.b.net < best.a.net) return { r: 'B', why: `${f('b')} beats ${f('a')}.` };
  return { r: 'H', why: `${f('a')} ties ${f('b')}. Halved.` };
}

export function calc(m: Match): CalcResult {
  const N = ses(m.s).holes; let a = 0, b = 0, played = 0, closed: { hole: number; margin: number; left: number; w: 'a' | 'b' } | null = null;
  for (let i = 0; i < N; i++) {
    const c = m.hs[i] && m.hs[i].r; if (!c) break;
    played++; if (c === 'A') a++; else if (c === 'B') b++;
    const d = a - b, left = N - played;
    if (left > 0 && Math.abs(d) > left) { closed = { hole: played, margin: Math.abs(d), left, w: d > 0 ? 'a' : 'b' }; break; }
  }
  const diff = a - b;
  if (closed) return { done: true, w: closed.w, played: closed.hole, diff, N, byeStart: closed.hole, dormie: false,
    label: `${closed.margin} & ${closed.left}`, pts: { a: closed.w === 'a' ? 1 : 0, b: closed.w === 'b' ? 1 : 0 } };
  if (played === N && N > 0) return diff === 0
    ? { done: true, w: 'h', played: N, diff: 0, N, byeStart: N, dormie: false, label: 'Halved', pts: { a: .5, b: .5 } }
    : { done: true, w: diff > 0 ? 'a' : 'b', played: N, diff, N, byeStart: N, dormie: false, label: `${Math.abs(diff)} up`, pts: { a: diff > 0 ? 1 : 0, b: diff < 0 ? 1 : 0 } };
  if (played === 0) return { done: false, w: null, played: 0, diff: 0, N, byeStart: N, dormie: false, label: 'Not started', pts: { a: 0, b: 0 } };
  const left = N - played, dormie = Math.abs(diff) > 0 && Math.abs(diff) === left;
  return { done: false, w: diff === 0 ? 'h' : (diff > 0 ? 'a' : 'b'), played, diff, N, byeStart: N, dormie,
    label: diff === 0 ? `All square thru ${played}` : `${Math.abs(diff)} up thru ${played}`, pts: { a: 0, b: 0 } };
}

export function runningAt(m: Match, i: number): string {
  let a = 0, b = 0;
  for (let k = 0; k <= i; k++) { const c = m.hs[k] && m.hs[k].r; if (!c) continue; if (c === 'A') a++; else if (c === 'B') b++; }
  const d = a - b; return d === 0 ? 'All square' : `${Math.abs(d)} up ${d > 0 ? CFG.teams.a.short : CFG.teams.b.short}`;
}

export function headline(m: Match): HeadlineResult {
  const r = calc(m);
  if (!r.done) return { txt: !r.played ? 'Not started'
    : (r.diff === 0 ? r.label : `${CFG.teams[r.w!].name} ${r.label}`),
    chip: r.dormie ? ['dormie', 'Dormie'] : (r.played ? ['live2', 'In progress'] : null),
    col: r.w === 'a' ? 'var(--red)' : r.w === 'b' ? 'var(--blue)' : 'var(--moss)' };
  if (r.w === 'h') return { txt: 'Match halved', chip: ['final', 'Final \u00BD point each'], col: 'var(--moss)' };
  return { txt: `${CFG.teams[r.w!].name} win ${r.label}`, chip: ['final', 'Final \u00B7 1 point'],
    col: r.w === 'a' ? 'var(--red)' : 'var(--blue)' };
}

export function roundState(x: Session): string {
  const ms = MATCHES.filter(m => m.s === x.id);
  if (ms.length && ms.every(m => calc(m).done)) return 'final';
  if (ms.some(m => calc(m).played > 0)) return 'live';
  return x.state === 'final' ? 'final' : x.state;
}

/* ---- utility exports used by the UI ---- */

export { ses, holeKeys, missingIn };

export const half = (n: number): string => {
  const i = Math.floor(n), f = n % 1 ? '\u00BD' : '';
  return (i || !f) ? `${i}${f}` : f;
};

export const initials = (id: string): string =>
  P[id].n.split(/\s+/).map(w => w[0]).join('').replace(/\./g, '').toUpperCase();

export const totals = (): { a: number; b: number } => {
  let a = 0, b = 0;
  MATCHES.forEach(m => { const r = calc(m); a += r.pts.a; b += r.pts.b; });
  return { a, b };
};
