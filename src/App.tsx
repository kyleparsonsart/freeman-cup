import { useEffect, useMemo, useRef, useState } from 'react';
import { useAuth } from './hooks/useAuth';
import { useEventData } from './hooks/useEventData';
import ScoringScreen, { currentRound } from './components/ScoringScreen';
import PullSync from './components/PullSync';
import { half, roundState } from './lib/scoring';
import { deriveMoments, nextUnseen, markSeen } from './lib/moments';
import { getActing, setActing, type Acting } from './lib/view';
import LiveScreen from './components/LiveScreen';
import MomentOverlay from './components/Moments';
import ScheduleScreen from './components/ScheduleScreen';
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

/** '1:10 PM','1:20 PM' -> '1:10/1:20pm'; mixed meridiems keep both. */
function teeLine(tees: string[]): string {
  if (!tees.length) return '';
  const ap = tees.map(t => (/pm/i.test(t) ? 'pm' : 'am'));
  const bare = tees.map(t => t.replace(/\s*(AM|PM)/i, ''));
  const same = ap.every(x => x === ap[0]);
  return same ? `${bare.join('/')}${ap[0]}` : tees.map((_, ix) => `${bare[ix]}${ap[ix]}`).join('/');
}

function lastSync(data: import('./hooks/useEventData').EventData): string {
  let latest: { at: number; by: string | null } | null = null;
  data.matchHoles.forEach(h => {
    const at = new Date(h.updated_at).getTime();
    if (!latest || at > latest.at) latest = { at, by: h.entered_by };
  });
  if (!latest) return 'No scores yet';
  const l: { at: number; by: string | null } = latest;
  const d = new Date(l.at);
  let hr = d.getHours();
  const ap = hr >= 12 ? 'pm' : 'am';
  hr = ((hr + 11) % 12) + 1;
  const t = `${hr}:${String(d.getMinutes()).padStart(2, '0')}${ap}`;
  const who = l.by ? (data.playerById[l.by]?.name.split(' ')[0] || 'someone') : 'someone';
  return `Last sync: ${t} by ${who}`;
}

function Header({ title, sub, right }: { title?: string; sub?: string | null; right?: React.ReactNode }) {
  return (
    <header className="hd">
      <div>
        <h1>{title ?? 'The Freeman Cup'}</h1>
        {sub !== null && <div className="sub">{sub ?? '5th Annual · Sand Valley · Oct 2026'}</div>}
      </div>
      {right}
    </header>
  );
}

/** Everything behind sign-in; mounting this starts the data load. */
function CupApp({ signOut }: { signOut: () => Promise<void> }) {
  const { data: rawData, loading, error, reload } = useEventData();
  const bodyRef = useRef<HTMLDivElement>(null);

  // Acting as: player by default. Everything below the cog reads the
  // effective data, so the commissioner in player view is a player.
  const [acting, setActingState] = useState<Acting>(getActing());
  const flipActing = (a: Acting) => { setActing(a); setActingState(a); };
  const armed = !!rawData?.meIsCommissioner && acting === 'commish';
  const data = rawData && rawData.meIsCommissioner && !armed
    ? { ...rawData, meIsCommissioner: false }
    : rawData;
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [tab, setTab] = useState<'scoring' | 'live' | 'schedule'>('scoring');
  // pulse when a round is actually mid-play, not only when set live
  const anyLive = !!data && data.scoringSessions.some(s => roundState(s) === 'live');

  // Recap moments: derived like the feed, auto-opened once per device.
  const moments = useMemo(() => data ? deriveMoments({
    sessions: data.scoringSessions,
    matches: data.scoringMatches,
    matchHoles: data.matchHoles,
    clinchPoints: Number(data.event.clinch_points) || 5.5,
    shootout: data.event.shootout ?? null,
    players: data.players,
    teams: data.teams,
  }) : null, [data]);
  const [moKey, setMoKey] = useState<string | null>(null);
  const autoShown = useRef<Set<string>>(new Set());
  useEffect(() => {
    if (!moments || moKey) return;
    const k = nextUnseen(moments);
    if (k && !autoShown.current.has(k)) {
      autoShown.current.add(k);
      setMoKey(k);
    }
  }, [moments, moKey]);
  const closeMoment = () => {
    if (moKey) markSeen(moKey);
    setMoKey(null);
  };

  // A tab always opens at its top — scroll position never leaks across.
  // Switching lands instantly (the content changes anyway); tapping the
  // tab you're on rides visibly back up instead.
  useEffect(() => {
    bodyRef.current?.scrollTo(0, 0);
  }, [tab]);
  const goTab = (t: 'scoring' | 'live' | 'schedule') => {
    if (t === tab) {
      bodyRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }
    setTab(t);
  };

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
    <span className="hdicons">
      {armed && (
        <svg className="crown" viewBox="0 0 24 24" fill="currentColor" aria-label="Acting as commissioner">
          <path d="M3 8.5 7.6 12 12 5.5 16.4 12 21 8.5 19.2 17H4.8L3 8.5z"/>
          <rect x="4.8" y="18.2" width="14.4" height="1.9"/>
        </svg>
      )}
      <button
      className={`cog${rawData?.meIsCommissioner ? ' on' : ''}`}
      aria-label={rawData?.meIsCommissioner ? 'Commissioner settings' : 'Settings'}
      onClick={() => setSettingsOpen(true)}
    >
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="3"/>
        <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.6a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>
      </svg>
    </button>
    </span>
  );

  // Header per tab: the course on Scoring, the event on Schedule, the road
  // to the clinch on Live with the last sync underneath.
  const round = data ? currentRound(data) : undefined;
  const scoringSub = round
    ? `${round.rd} · ${round.fmt} · ${teeLine(round.tees)}`
    : null;
  const header = !data ? <Header right={cog} />
    : tab === 'scoring' ? <Header title={round ? round.course : 'The Freeman Cup 2026'} sub={scoringSub} right={cog} />
    : tab === 'schedule' ? <Header title="The Freeman Cup 2026" sub="5th Annual Invitational" right={cog} />
    : <Header title={`The Road to ${half(Number(data.event.clinch_points) || 5.5)}`} sub={lastSync(data)} right={cog} />;

  return (
    <>
      {data && <PullSync bodyRef={bodyRef} onSync={reload} />}
      <div className="body" ref={bodyRef}>
        {header}
        {loading && (
          <div className="boot" aria-label="Loading">
            <span className="bootlogo" />
            <span className="bootsub">The Freeman Cup</span>
          </div>
        )}
        {error && (
          <div className="empty">
            <b>Error</b>
            {error}
          </div>
        )}
        {data && tab === 'scoring' && (
          <section id="v-scoring" className="view on">
            <ScoringScreen data={data} reload={reload} />
          </section>
        )}
        {data && tab === 'live' && (
          <section id="v-live" className="view on">
            <LiveScreen data={data} moments={moments} onMoment={setMoKey} />
          </section>
        )}
        {data && tab === 'schedule' && (
          <section id="v-schedule" className="view on">
            <ScheduleScreen data={data} moments={moments} onMoment={setMoKey} />
          </section>
        )}
      </div>

      <nav className="tabs" role="tablist">
        <button className="tab" role="tab" aria-selected={tab === 'live'} onClick={() => goTab('live')}>
          Live{anyLive && <span className="pulse" />}
        </button>
        <button className="tab" role="tab" aria-selected={tab === 'scoring'} onClick={() => goTab('scoring')}>Scoring</button>
        <button className="tab" role="tab" aria-selected={tab === 'schedule'} onClick={() => goTab('schedule')}>Schedule</button>
      </nav>

      {data && moments && moKey && (
        <MomentOverlay
          ms={moments}
          openKey={moKey}
          commissioner={data.meIsCommissioner}
          onClose={closeMoment}
          onSeeLive={() => { setTab('live'); closeMoment(); }}
          onEnterScores={() => { closeMoment(); setSettingsOpen(true); }}
        />
      )}

      {rawData && (
        <SettingsSheet
          data={rawData}
          acting={acting}
          onActing={flipActing}
          moments={moments}
          open={settingsOpen}
          onClose={() => setSettingsOpen(false)}
          reload={reload}
          signOut={signOut}
        />
      )}
    </>
  );
}
