/**
 * The activity feed, derived from the data rather than stored.
 *
 * Every hole result already lives in match_hole with a real updated_at, so
 * the feed is a pure function of the match data: re-derive and a correction
 * simply moves or removes its line, which is the "edit in place, never
 * append a retraction" rule for free. Scorer switches are the one thing the
 * holes can't know; they come from feed_event.
 *
 * Ported from buildFeed() in the prototype, with real timestamps in place
 * of the invented ones.
 */
import {
  calc, getsStroke, runningAt, half, P, CFG,
  type Match, type Session,
} from './scoring';
import type { DbFeedEvent, DbMatchHole, DbPlayer } from './types';

export interface FeedItem {
  key: string;
  day: string;
  at: number;                 // epoch ms
  side: '' | 'a' | 'b' | 'a win' | 'b win' | 'cup' | 'gold';
  big?: boolean;
  tag?: string;
  tagGold?: boolean;
  hl?: string;                // headline (big items)
  who?: { side: 'a' | 'b'; name: string };
  text: string;
  sub?: string;
  score?: { a: number; b: number };
}

export interface FeedDay {
  day: string;
  items: FeedItem[];          // newest first
}

export interface FeedInput {
  sessions: Session[];
  matches: Match[];
  matchHoles: DbMatchHole[];
  switches: DbFeedEvent[];
  playerById: Record<string, DbPlayer>;
  clinchPoints: number;
}

const fn = (n?: string | null) => (n || '').split(' ')[0];
const names = (keys: string[]) => keys.map(k => fn(P[k]?.n) || k).join(' / ');
const firstOf = (keys: string[]) => fn(P[keys[0]]?.n) || keys[0] || '';

/** Lowest net score on the winning side: whose hole it was. At
 *  foursomes and aggregate the hole belongs to the pair, not a player. */
export function bestName(m: Match, s: Session, i: number, side: 'a' | 'b'): { k: string; n: string } | null {
  if (s.fmt === 'Foursomes' || s.fmt === 'Aggregate') return { k: side, n: CFG.teams[side].name };
  let bn = Infinity, k: string | null = null;
  m[side].forEach(x => {
    const g = m.hs[i].sc[x];
    if (g === undefined || g === null || g === 'X') return;
    const n = g - getsStroke(m, x, i);
    if (n < bn) { bn = n; k = x; }
  });
  return k ? { k, n: fn(P[k]?.n) || k } : null;
}

export function buildFeed(input: FeedInput): FeedDay[] {
  const { sessions, matches, matchHoles, switches, playerById, clinchPoints } = input;

  // real timestamp for every (match, hole)
  const when: Record<string, number> = {};
  matchHoles.forEach(h => { when[`${h.match_id}:${h.hole}`] = new Date(h.updated_at).getTime(); });
  const tOf = (m: Match, i: number, fallback: number) => when[`${m.id}:${i + 1}`] ?? fallback;

  const out: FeedItem[] = [];
  const finals: { at: number; day: string; key: string }[] = [];
  let firstEver = Infinity;

  sessions.forEach(s => {
    const ms = matches.filter(m => m.s === s.id);
    if (!ms.some(m => calc(m).played > 0)) return;

    let t0 = Infinity, tEnd = 0;
    const events: FeedItem[] = [];

    ms.forEach(m => {
      const r = calc(m);
      const par = s.par;
      for (let i = 0; i < r.played; i++) {
        const h = m.hs[i];
        if (!h || !h.r) continue;
        const at = tOf(m, i, Date.now());
        t0 = Math.min(t0, at); tEnd = Math.max(tEnd, at);

        if (h.r !== 'H') {
          const w = h.r === 'A' ? 'a' : 'b';
          const win = bestName(m, s, i, w);
          const g = win ? h.sc[win.k] : null;
          const rel = typeof g === 'number' ? g - par[i] : null;
          const kind = rel === null ? '' : rel <= -2 ? 'Eagle' : rel === -1 ? 'Birdie' : '';
          events.push({
            key: `h:${m.id}:${i}`, day: s.day, at, side: w,
            tag: kind || undefined, tagGold: !!kind,
            who: { side: w, name: win ? win.n : CFG.teams[w].name },
            text: ` won ${i + 1}${kind ? ` with ${kind === 'Eagle' ? 'an eagle' : 'a birdie'}` : ''}.`,
            sub: `${firstOf(m.a)} v ${firstOf(m.b)} · ${runningAt(m, i)}`,
          });
        }

        // dormie: up by exactly what remains
        let a2 = 0, b2 = 0;
        for (let k = 0; k <= i; k++) {
          const c = m.hs[k].r;
          if (c === 'A') a2++; else if (c === 'B') b2++;
        }
        const d = a2 - b2, left = s.holes - (i + 1);
        if (left > 0 && Math.abs(d) === left && d !== 0) {
          const w = d > 0 ? 'a' : 'b';
          events.push({
            key: `d:${m.id}:${i}`, day: s.day, at: at + 1, side: w,
            tag: 'Dormie',
            who: { side: w, name: CFG.teams[w].name },
            text: ` cannot lose this one. ${Math.abs(d)} up with ${left} to play.`,
          });
        }
      }

      if (r.done) {
        const at = tOf(m, Math.max(0, r.played - 1), tEnd) + 2;
        tEnd = Math.max(tEnd, at);
        const key = `f:${m.id}`;
        if (r.w === 'h') {
          events.push({
            key, day: s.day, at, side: '', big: true,
            tag: 'Match final', hl: 'Halved',
            text: `${names(m.a)} and ${names(m.b)} split the point.`,
          });
        } else if (r.w) {
          const loser = r.w === 'a' ? 'b' : 'a';
          events.push({
            key, day: s.day, at, side: `${r.w} win`, big: true,
            tag: 'Match final', hl: `${names(m[r.w])} win ${r.label}`,
            text: `Over ${names(m[loser])}.`,
          });
        }
        finals.push({ at, day: s.day, key: m.id });
      }
    });

    if (t0 === Infinity) return;
    firstEver = Math.min(firstEver, t0);

    out.push({
      key: `u:${s.id}`, day: s.day, at: t0 - 1, side: '',
      text: `**${s.rd} under way** at ${s.course}.`,
      sub: `${s.fmt} · ${s.holes} holes · tees ${s.tees.join(' and ')}`,
    });

    out.push(...events);

    if (ms.every(m => calc(m).done)) {
      let a = 0, b = 0;
      ms.forEach(m => { const r = calc(m); a += r.pts.a; b += r.pts.b; });
      out.push({
        key: `l:${s.id}`, day: s.day, at: tEnd + 3, side: '',
        text: `**Last group is in** at ${s.course}.`,
        sub: `${s.rd} finishes ${half(a)} – ${half(b)}`,
      });
    }
  });

  // Lead changes and the clinch: walk every match final in the order it
  // happened, accumulating points as they landed.
  const ptsOf: Record<string, { a: number; b: number }> = {};
  matches.forEach(m => { ptsOf[m.id] = calc(m).pts; });
  let a = 0, b = 0, lead: 'a' | 'b' | null = null, clinched = false;
  finals.sort((x, y) => x.at - y.at).forEach(f => {
    a += ptsOf[f.key].a; b += ptsOf[f.key].b;
    const nl = a > b ? 'a' : b > a ? 'b' : null;
    if (!clinched && (a >= clinchPoints || b >= clinchPoints)) {
      clinched = true;
      const w = a >= clinchPoints ? 'a' : 'b';
      out.push({
        key: `c:${f.key}`, day: f.day, at: f.at + 1, side: 'cup', big: true,
        tag: 'Clinched', hl: `${CFG.teams[w].name} win ${CFG.trophy}`,
        text: '', score: { a, b },
      });
      lead = w;
      return;
    }
    if (nl && nl !== lead) {
      lead = nl;
      out.push({
        key: `lc:${f.key}`, day: f.day, at: f.at + 1, side: 'cup', big: true,
        tag: 'Lead change', hl: `${CFG.teams[nl].name} lead`,
        text: '', score: { a, b },
      });
    }
  });

  // Scorer switches and cards coming home, from the feed table
  const byId = (id: unknown) => (typeof id === 'string' && fn(playerById[id]?.name)) || 'someone';
  switches.forEach(ev => {
    const s = sessions.find(x => x.id === ev.round_id);
    if (!s) return;
    const seq = typeof ev.body.seq === 'number' ? ev.body.seq : 1;
    const letter = String.fromCharCode(64 + seq);
    if (ev.kind === 'card_in') {
      out.push({
        key: `ci:${ev.id}`, day: s.day, at: new Date(ev.occurred_at).getTime(), side: '',
        text: `**${byId(ev.body.by)}** handed in Group ${letter}'s card for ${s.rd}.`,
      });
      return;
    }
    out.push({
      key: `s:${ev.id}`, day: s.day, at: new Date(ev.occurred_at).getTime(), side: '',
      text: `**${byId(ev.body.to)}** took over scoring for ${s.rd} Group ${letter} from ${byId(ev.body.from)}.`,
    });
  });

  if (firstEver !== Infinity) {
    const s0 = sessions[0];
    out.push({
      key: 'open', day: s0.day, at: firstEver - 2, side: 'gold',
      text: `**The Freeman Cup is under way.**`,
      sub: `Playing for ${CFG.trophy}`,
    });
  }

  const order = [...new Set(sessions.map(x => x.day))];
  out.sort((x, y) => order.indexOf(y.day) - order.indexOf(x.day) || y.at - x.at);
  const byDay: Record<string, FeedItem[]> = {};
  out.forEach(e => { (byDay[e.day] = byDay[e.day] || []).push(e); });
  return order.filter(d => byDay[d]).reverse().map(d => ({ day: d, items: byDay[d] }));
}

export const clock = (ms: number): string => {
  const d = new Date(ms);
  const h = d.getHours(), m = d.getMinutes();
  return `${((h + 11) % 12) + 1}:${String(m).padStart(2, '0')}`;
};
