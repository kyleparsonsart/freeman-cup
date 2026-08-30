import { useEffect, useRef } from 'react';
import { useAuth } from './hooks/useAuth';
import { useEventData } from './hooks/useEventData';
import ScoringScreen from './components/ScoringScreen';
import SignInScreen from './components/SignInScreen';

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
      <div className="body">
        <header className="hd">
          <div>
            <h1>The Freeman Cup</h1>
            <div className="sub">5th Annual · Sand Valley · Oct 2026</div>
          </div>
        </header>

        {!auth.ready ? null : !auth.session ? (
          <section className="view on">
            <SignInScreen
              sendCode={auth.sendCode}
              verifyCode={auth.verifyCode}
              devSignIn={auth.devSignIn}
            />
          </section>
        ) : (
          <CupApp signOut={auth.signOut} />
        )}
      </div>

      {auth.session && (
        <nav className="tabs" role="tablist">
          <button className="tab" role="tab" aria-selected={true}>Scoring</button>
          <button className="tab" role="tab" aria-selected={false}>Live</button>
          <button className="tab" role="tab" aria-selected={false}>Schedule</button>
        </nav>
      )}
    </div>
  );
}

/** Everything behind sign-in; mounting this starts the data load. */
function CupApp({ signOut }: { signOut: () => Promise<void> }) {
  const { data, loading, error } = useEventData();

  if (data?.unclaimed) {
    return (
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
    );
  }

  return (
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
  );
}
