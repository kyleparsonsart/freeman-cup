/**
 * Card state for a tee group: which holes still need something, whether
 * the card is whole enough to hand in, and bye-hole progress. Pure
 * functions over the scoring engine's shapes, like the feed and the
 * moments.
 */
import { calc, type Match } from './scoring';

export interface OpenHole {
  matchId: string;
  hole: number; // 0-based index
}

/** The matches one scorer carries: same round, same tee group. */
export const groupMatches = (all: Match[], sessionId: string, g: number): Match[] =>
  all.filter(m => m.s === sessionId && m.g === g);

/**
 * Holes left behind: no result yet, at or before the match's frontier —
 * the furthest hole with a result or any score. Future holes are not
 * "open"; a skipped one is.
 */
export function openHoles(ms: Match[], holes: number): OpenHole[] {
  const out: OpenHole[] = [];
  ms.forEach(m => {
    let frontier = -1;
    m.hs.forEach((h, idx) => {
      if (idx >= holes) return;
      if (h.r || Object.values(h.sc).some(v => v !== undefined && v !== null)) frontier = idx;
    });
    for (let idx = 0; idx <= frontier; idx++) {
      if (!m.hs[idx].r) out.push({ matchId: m.id, hole: idx });
    }
  });
  return out.sort((a, b) => a.hole - b.hole);
}

/** Holes with no result anywhere on the card — what Submit still needs. */
export function holesShort(ms: Match[], holes: number): number {
  return ms.reduce((t, m) => {
    let n = 0;
    for (let idx = 0; idx < holes; idx++) if (!m.hs[idx]?.r) n++;
    return t + n;
  }, 0);
}

/** Every hole of every match has a result: the card is whole. */
export const cardComplete = (ms: Match[], holes: number): boolean =>
  ms.length > 0 && holesShort(ms, holes) === 0;

/** Bye progress for a closed match: how many of the byes are in. */
export function byeProgress(m: Match, holes: number): { got: number; total: number } | null {
  const r = calc(m);
  if (!r.done || r.byeStart >= holes) return null;
  let got = 0;
  const total = holes - r.byeStart;
  for (let idx = r.byeStart; idx < holes; idx++) if (m.hs[idx]?.r) got++;
  return { got, total };
}
