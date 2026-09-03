import { useEffect, useRef } from 'react';
import { flushQueue } from '../lib/writeQueue';
import { TrophySvg } from './CupStrip';

const CATCH_BASE = 60;  // pull past the status bar that arms the sync
const MAX_BASE = 116;   // resistance ceiling, likewise past the bar

/** The status bar's height: the first chunk of any pull is spent under
 *  it, so every distance offsets by the safe-area inset. */
function statusInset(): number {
  const v = getComputedStyle(document.documentElement).getPropertyValue('--sat');
  return parseFloat(v) || 0;
}

/**
 * Pull-to-sync: drag the page down from the top and "Trying [jug] to
 * sync" fades in with the pull. A full pull catches; releasing flushes
 * the write queue and reloads while the jug and the words pulse in a
 * slow ripple, then the page settles back.
 *
 * Touch-driven by hand (installed PWAs own their scroll container), so
 * it behaves identically on every tab. Direct style writes, no state
 * churn on touchmove.
 */
export default function PullSync({ bodyRef, onSync }: {
  bodyRef: React.RefObject<HTMLDivElement | null>;
  onSync: () => Promise<unknown> | void;
}) {
  const indRef = useRef<HTMLDivElement>(null);
  const pinRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const body = bodyRef.current;
    const ind = indRef.current, pin = pinRef.current;
    if (!body || !ind || !pin) return;

    let startY = 0, startX = 0, armed = false, active = false;
    let pull = 0, syncing = false, caught = false;
    const sat = statusInset();
    const CATCH = CATCH_BASE + sat;
    const MAX = MAX_BASE + sat;

    const setPull = (px: number) => {
      pull = px;
      body.style.transform = px ? `translateY(${px}px)` : '';
      const p = Math.min(1, Math.max(0, (px - sat * 0.6) / (CATCH - sat * 0.6)));
      if (!syncing) pin.style.opacity = String(p);
    };

    const settle = () => {
      body.classList.add('settling');
      setPull(0);
      setTimeout(() => body.classList.remove('settling'), 480);
    };

    const clearInd = () => {
      setTimeout(() => { pin.style.opacity = '0'; }, 480);
    };

    const onStart = (e: TouchEvent) => {
      if (syncing || body.scrollTop > 0) return;
      const t = e.target as HTMLElement | null;
      if (t?.closest('.drawer, .settings, .moment')) return;
      startY = e.touches[0].clientY;
      startX = e.touches[0].clientX;
      armed = true;
      active = false;
    };

    const onMove = (e: TouchEvent) => {
      if (!armed || syncing) return;
      const dy = e.touches[0].clientY - startY;
      const dx = e.touches[0].clientX - startX;
      if (!active) {
        // only a clearly vertical, downward drag from the very top arms it
        if (dy < -4 || body.scrollTop > 0) { armed = false; return; }
        if (dy < 8 || Math.abs(dy) < Math.abs(dx) * 1.4) return;
        active = true;
      }
      e.preventDefault();
      const eased = Math.max(0, Math.min(MAX, (dy - 8) * 0.55));
      const was = caught;
      caught = eased >= CATCH;
      if (caught && !was && navigator.vibrate) navigator.vibrate(10);
      setPull(eased);
    };

    const onEnd = () => {
      if (!armed) return;
      armed = false;
      if (!active) return;
      active = false;
      if (pull >= CATCH) {
        syncing = true;
        ind.classList.add('syncing');
        pin.style.opacity = '1';
        body.classList.add('settling');
        setPull(CATCH + 4);
        setTimeout(() => body.classList.remove('settling'), 480);
        const hold = new Promise(r => setTimeout(r, 1400));
        // watchdog: a hung reload must never strand the page open
        const patience = new Promise(r => setTimeout(r, 8000));
        Promise.race([
          Promise.allSettled([flushQueue(), Promise.resolve(onSync()), hold]),
          patience,
        ]).then(() => {
          syncing = false;
          caught = false;
          ind.classList.remove('syncing');
          settle();
          clearInd();
        });
      } else {
        caught = false;
        settle();
        clearInd();
      }
    };

    body.addEventListener('touchstart', onStart, { passive: true });
    body.addEventListener('touchmove', onMove, { passive: false });
    body.addEventListener('touchend', onEnd);
    body.addEventListener('touchcancel', onEnd);
    return () => {
      body.removeEventListener('touchstart', onStart);
      body.removeEventListener('touchmove', onMove);
      body.removeEventListener('touchend', onEnd);
      body.removeEventListener('touchcancel', onEnd);
    };
  }, [bodyRef, onSync]);

  return (
    <div className="pullsync" ref={indRef} aria-hidden="true">
      <div className="pin" ref={pinRef}>
        <span className="pw w1">Trying</span>
        <span className="pjug"><TrophySvg /></span>
        <span className="pw w2">to sync</span>
      </div>
    </div>
  );
}
