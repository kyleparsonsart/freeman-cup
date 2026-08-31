import { useEffect, useRef, useState } from 'react';
import { useAuth } from './hooks/useAuth';
import { useEventData } from './hooks/useEventData';
import ScoringScreen from './components/ScoringScreen';
import SignInScreen from './components/SignInScreen';
import SettingsSheet from './components/SettingsSheet';

function tap() {
  if (navigator.vibrate) navigator.vibrate(10);
}

export default function App() {
  const auth = useAuth();
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
      {!auth.ready ? null : !auth.session ? (
        <div className="body">
          <Header />
          <section className="view on">
            <SignInScreen
              sendCode={auth.sendCode}
              verifyCode={auth.verifyCode}
              devSignIn={auth.devSignIn}
            />
          </section>
        </div>
      ) : (
        <CupApp signOut={auth.signOut} />
      )}
    </div>
  );
}

function Header({ right }: { right?: React.ReactNode }) {
  return (
    <header className="hd">
      <div>
        <h1>The Freeman Cup</h1>
        <div className="sub">5th Annual · Sand Valley · Oct 2026</div>
      </div>
      {right}
    </header>
  );
}

/** Everything behind sign-in; mounting this starts the data load. */
function CupApp({ signOut }: { signOut: () => Promise<void> }) {
  const { data, loading, error, reload } = useEventData();
  const [settingsOpen, setSettingsOpen] = useState(false);

  if (data?.unclaimed) {
    return (
      <div className="body">
        <Header />
        <section className="view on">
          <div className="auth">
            <h2>No seat for this email</h2>
            <p className="asub">
              You're signed in, but this email isn't on the roster.
              Ask Kyle to add it, then sign in again.
            </p>
            <button className="aghost" onClick={signOut}>Sign out</button>
          </div>
        </section>
      </div>
    );
  }

  const cog = data && (
    <button
      className={`cog${data.meIsCommissioner ? ' on' : ''}`}
      aria-label={data.meIsCommissioner ? 'Commissioner settings' : 'Settings'}
      onClick={() => setSettingsOpen(true)}
    >
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="3"/>
        <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.6a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>
      </svg>
    </button>
  );

  return (
    <>
      <div className="body">
        <Header right={cog} />
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
          {data && <ScoringScreen data={data} reload={reload} />}
        </section>
      </div>

      <nav className="tabs" role="tablist">
        <button className="tab" role="tab" aria-selected={true}>Scoring</button>
        <button className="tab" role="tab" aria-selected={false}>Live</button>
        <button className="tab" role="tab" aria-selected={false}>Schedule</button>
      </nav>

      {data && (
        <SettingsSheet
          data={data}
          open={settingsOpen}
          onClose={() => setSettingsOpen(false)}
          reload={reload}
          signOut={signOut}
        />
      )}
    </>
  );
}
