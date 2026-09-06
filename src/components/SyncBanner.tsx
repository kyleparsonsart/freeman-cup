import { useEffect, useState } from 'react';
import { getQueuedWrites, onQueueChange } from '../lib/writeQueue';

/**
 * The health strip: exists only when something is wrong, on every tab.
 * Offline is stated calmly (the write queue working as designed is
 * reassurance, not alarm), queued scores are counted as SAVED, and
 * blocked scores go amber with a door to Scoring. When everything is
 * healthy this renders nothing at all.
 */
const clock = (iso: string): string => {
  const d = new Date(iso);
  const h = d.getHours(), m = d.getMinutes();
  return `${((h + 11) % 12) + 1}:${String(m).padStart(2, '0')}`;
};

export default function SyncBanner({ offline, syncedAt, onOpenScoring }: {
  /** the last fetch failed and the app is running on its snapshot */
  offline: boolean;
  /** when the snapshot on screen last came from the server (ISO) */
  syncedAt?: string | null;
  onOpenScoring: () => void;
}) {
  const [navOffline, setNavOffline] = useState(
    typeof navigator !== 'undefined' && !navigator.onLine,
  );
  const [pending, setPending] = useState(0);
  const [blocked, setBlocked] = useState(0);
  const [draining, setDraining] = useState(0);

  // the radio, live: flips the moment the signal drops, before any fetch
  useEffect(() => {
    const on = () => setNavOffline(false);
    const off = () => setNavOffline(true);
    window.addEventListener('online', on);
    window.addEventListener('offline', off);
    return () => {
      window.removeEventListener('online', on);
      window.removeEventListener('offline', off);
    };
  }, []);

  // the queue: fresh rows show as "syncing" only if they linger (a row
  // normally flushes in milliseconds; announcing that reads as flicker)
  useEffect(() => {
    let live = true;
    let timer: ReturnType<typeof setTimeout> | null = null;
    const update = () => {
      getQueuedWrites().then(q => {
        if (!live) return;
        setBlocked(q.filter(w => w.blocked).length);
        const fresh = q.filter(w => !w.blocked).length;
        setPending(fresh);
        if (timer) { clearTimeout(timer); timer = null; }
        if (fresh === 0) setDraining(0);
        else timer = setTimeout(() => { if (live) setDraining(fresh); }, 2500);
      });
    };
    update();
    const offQueue = onQueueChange(update);
    return () => { live = false; offQueue(); if (timer) clearTimeout(timer); };
  }, []);

  const isOffline = navOffline || offline;

  if (blocked > 0) {
    return (
      <button className="syncbar warn" onClick={onOpenScoring}>
        {blocked} score{blocked === 1 ? '' : 's'} need attention — open Scoring ›
      </button>
    );
  }
  if (isOffline) {
    // say what the screen is (the phone's last look at the server, and
    // when) rather than just "offline"; entering scores is still fine
    const seen = syncedAt ? ` as of ${clock(syncedAt)}` : '';
    return (
      <div className="syncbar">
        {pending > 0
          ? `Offline · showing this phone's scores${seen} · ${pending} saved here`
          : `Offline · showing what this phone last saw${seen} · scores you enter are saved`}
      </div>
    );
  }
  if (draining > 0) {
    return <div className="syncbar">Syncing {draining}…</div>;
  }
  return null;
}
