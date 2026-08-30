import { useEffect, useRef } from 'react';
import { useEventData } from './hooks/useEventData';
import ScoringScreen from './components/ScoringScreen';

function tap() {
  if (navigator.vibrate) navigator.vibrate(10);
}

export default function App() {
  const { data, loading, error } = useEventData();
  const root = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = root.current;
    if (!el) return;
    const handler = (e: Event) => {
      if ((e.target as HTMLElement).closest('button')) tap();
    };
    el.addEventListener('pointerdown', handler, { passive: true });
    return () => el.removeEventListener('pointerdown', handler);
  }, []);

  return (
    <div className="phone" ref={root}>
      <div className="body">
        <header className="hd">
          <div>
            <h1>The Freeman Cup</h1>
            <div className="sub">5th Annual · Sand Valley · Oct 2026</div>
          </div>
        </header>

        <section id="v-scoring" className="view on">
          {loading && (
            <div className="empty">Loading…</div>
          )}
          {error && (
            <div className="empty">
              <b>Error</b>
              {error}
            </div>
          )}
          {data && <ScoringScreen data={data} />}
        </section>
      </div>

      <nav className="tabs" role="tablist">
        <button className="tab" role="tab" aria-selected={true}>Scoring</button>
        <button className="tab" role="tab" aria-selected={false}>Live</button>
        <button className="tab" role="tab" aria-selected={false}>Schedule</button>
      </nav>
    </div>
  );
}
