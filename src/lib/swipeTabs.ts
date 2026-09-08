// Swipe between the nav pages. Tug the page left or right; past a threshold
// (a quarter of the width, or a quick flick) it lets go and slides you over
// to the neighbouring tab. Vertical scrolling wins whenever the finger moves
// more up-down than side-to-side, and gestures that start inside a horizontal
// scroller (the hole strip, the group tabs) are left alone.

export type SwipeOpts<T extends string> = {
  order: readonly T[];
  current: () => T;
  go: (tab: T, dir: 1 | -1) => void;
  // the element that follows the finger (the active .view)
  page: () => HTMLElement | null;
  // gesture is ignored when this returns true (an overlay is open, etc)
  blocked?: () => boolean;
};

const IGNORE = '.tgs, .ftabs, input, textarea, select, [data-noswipe]';
const OVERLAY = '.settings.on, .moment, .drawer.on, .auth';

export function attachSwipeTabs<T extends string>(root: HTMLElement, o: SwipeOpts<T>): () => void {
  let x0 = 0, y0 = 0, t0 = 0, dx = 0;
  let mode: 'idle' | 'undecided' | 'h' | 'v' = 'idle';
  let animating = false;

  const reduced = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const neighbour = (dir: 1 | -1): T | null => {
    const i = o.order.indexOf(o.current());
    return o.order[i + dir] ?? null;
  };

  const start = (e: TouchEvent) => {
    if (animating || e.touches.length !== 1) return;
    if (o.blocked?.() || document.querySelector(OVERLAY)) return;
    const t = e.target as HTMLElement;
    if (t.closest(IGNORE)) return;
    x0 = e.touches[0].clientX; y0 = e.touches[0].clientY; t0 = performance.now(); dx = 0;
    mode = 'undecided';
  };

  const move = (e: TouchEvent) => {
    if (mode === 'idle' || mode === 'v') return;
    const x = e.touches[0].clientX, y = e.touches[0].clientY;
    const mx = x - x0, my = y - y0;
    if (mode === 'undecided') {
      if (Math.abs(mx) < 8 && Math.abs(my) < 8) return;
      if (Math.abs(mx) > Math.abs(my) * 1.4) { mode = 'h'; root.classList.add('swiping'); }
      else { mode = 'v'; return; }
    }
    e.preventDefault(); // we own this gesture now; no scroll underneath
    const p = o.page(); if (!p) return;
    const has = neighbour(mx < 0 ? 1 : -1) !== null;
    dx = has ? mx : mx * 0.28; // rubber-band at the ends
    p.style.transform = `translateX(${dx}px)`;
    p.style.opacity = has ? String(1 - Math.min(1, Math.abs(dx) / root.clientWidth) * 0.35) : '1';
  };

  const settle = (p: HTMLElement, to: string, opacity: string, ms: number) =>
    new Promise<void>(res => {
      if (ms === 0) { p.style.transform = to; p.style.opacity = opacity; res(); return; }
      p.style.transition = `transform ${ms}ms cubic-bezier(.25,.8,.35,1), opacity ${ms}ms linear`;
      p.style.transform = to; p.style.opacity = opacity;
      let done = false;
      const fin = () => { if (done) return; done = true; p.removeEventListener('transitionend', fin); res(); };
      p.addEventListener('transitionend', fin);
      setTimeout(fin, ms + 60);
    });

  const end = async () => {
    const wasH = mode === 'h'; mode = 'idle';
    if (!wasH) return;
    root.classList.remove('swiping');
    const p = o.page(); if (!p) return;
    const w = root.clientWidth;
    const dt = Math.max(1, performance.now() - t0);
    const v = dx / dt; // px per ms
    const dir: 1 | -1 = dx < 0 ? 1 : -1;
    const next = neighbour(dir);
    const commit = next !== null && (Math.abs(dx) > w * 0.25 || (Math.abs(v) > 0.45 && Math.abs(dx) > 40));
    animating = true;
    const ms = reduced() ? 0 : 1;
    if (commit && next) {
      const rest = w - Math.abs(dx);
      await settle(p, `translateX(${-dir * w}px)`, '0.4', ms && Math.max(120, Math.min(260, rest / Math.max(0.6, Math.abs(v)))));
      p.style.transition = ''; p.style.transform = ''; p.style.opacity = '';
      o.go(next, dir);
      // the new page slides in from the side we pulled toward
      requestAnimationFrame(() => {
        const q = o.page();
        if (!q) { animating = false; return; }
        if (ms === 0) { animating = false; return; }
        q.style.transition = 'none';
        q.style.transform = `translateX(${dir * w}px)`; q.style.opacity = '0.6';
        void q.offsetWidth;
        settle(q, 'translateX(0)', '1', 240).then(() => {
          q.style.transition = ''; q.style.transform = ''; q.style.opacity = '';
          animating = false;
        });
      });
    } else {
      await settle(p, 'translateX(0)', '1', ms && 220);
      p.style.transition = ''; p.style.transform = ''; p.style.opacity = '';
      animating = false;
    }
  };

  root.addEventListener('touchstart', start, { passive: true });
  root.addEventListener('touchmove', move, { passive: false });
  root.addEventListener('touchend', end);
  root.addEventListener('touchcancel', end);
  return () => {
    root.removeEventListener('touchstart', start);
    root.removeEventListener('touchmove', move);
    root.removeEventListener('touchend', end);
    root.removeEventListener('touchcancel', end);
  };
}
