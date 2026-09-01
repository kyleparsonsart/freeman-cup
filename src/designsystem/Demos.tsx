import type { ReactNode } from 'react';
import CupStrip from '../components/CupStrip';
import Scorecard from '../components/Scorecard';
import { MATCHES } from './sample';

/* ---------- helpers ---------- */

export function Demo({ title, classes, note, stage = 'plain', children }: {
  title: string; classes: string[]; note?: ReactNode; stage?: 'plain' | 'board' | 'pad' | 'none'; children: ReactNode;
}) {
  return (
    <div className="ds-demo" id={`c-${title.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`}>
      <h3 className="ds-h3">{title}</h3>
      {note && <p className="ds-note">{note}</p>}
      {stage === 'none' ? children : (
        <div className={`ds-stage${stage === 'pad' ? ' pad' : ''}`} style={{ marginTop: 12 }}>
          {children}
        </div>
      )}
      <div className="cap">{classes.map(c => <span key={c} className="ds-code">{c}</span>)}</div>
    </div>
  );
}

const Pencil = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4z"/>
  </svg>
);

const NOTE = [
  { o: -2, sh: 'u2', cap: 'Eagle' }, { o: -1, sh: 'u1', cap: 'Birdie' }, { o: 0, sh: '', cap: 'Par' },
  { o: 1, sh: 'o1', cap: 'Bogey' }, { o: 2, sh: 'o2', cap: 'Double' }, { o: 3, sh: 'o3', cap: 'Triple' },
];

/* ---------- the demos ---------- */

export function Tabs() {
  return (
    <nav className="tabs" role="tablist">
      <button className="tab" role="tab" aria-selected={false}>Live<span className="pulse" /></button>
      <button className="tab" role="tab" aria-selected={true}>Scoring</button>
      <button className="tab" role="tab" aria-selected={false}>Schedule</button>
    </nav>
  );
}

export function Header() {
  return (
    <header className="hd">
      <div>
        <h1>The Freeman Cup</h1>
        <div className="sub">5th Annual · Sand Valley · Oct 2026</div>
      </div>
      <button className="cog on" aria-label="Commissioner settings">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.6a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>
        </svg>
      </button>
    </header>
  );
}

export function Strip() {
  return <CupStrip />;
}

export function GroupTabs() {
  return (
    <div className="board">
      <div className="ftabs" role="tablist">
        <button className="ftab" role="tab" aria-selected={true}>
          <span className="ft1">Group A<span className="yo"> (you)</span></span>
          <span className="ftrow">
            <span className="avs"><i className="av a">GS</i><i className="av a">MJ</i></span>
            <span className="ft2 a">3 up</span>
            <span className="avs"><i className="av b">KP</i><i className="av b">JW</i></span>
          </span>
        </button>
        <button className="ftab" role="tab" aria-selected={false}>
          <span className="ft1">Group B</span>
          <span className="ftrow">
            <span className="avs"><i className="av a">DE</i><i className="av a">BK</i></span>
            <span className="ft2">Even</span>
            <span className="avs"><i className="av b">PJ</i><i className="av b">JD</i></span>
          </span>
        </button>
      </div>
    </div>
  );
}

export function HoleNav() {
  return (
    <div className="hnav">
      <button aria-label="Previous hole">‹</button>
      <div className="hnc"><span className="hh1">Hole 7</span><span className="hh2">Par 5 · SI 1</span></div>
      <button aria-label="Next hole">›</button>
    </div>
  );
}

export function Override({ sel }: { sel?: 'A' | 'H' | 'B' }) {
  return (
    <div className="bovr">
      {(['A', 'H', 'B'] as const).map(w => (
        <button key={w} data-w={w} className={sel === w ? 'sel' : ''}>{w === 'A' ? 'VIK' : w === 'H' ? 'Halved' : 'CEL'}</button>
      ))}
    </div>
  );
}

export function Legend() {
  return (
    <div className="legend">
      <i className="ldot" /><b>Griffin S. and Matt J.</b> get a shot on this hole. The gold underline marks the score it plays as.
    </div>
  );
}

export function PlayerRow({ name, side, hcp, par, picked, stroke, scorer }: {
  name: string; side: 'a' | 'b'; hcp: number; par: number; picked?: number; stroke?: boolean; scorer?: boolean;
}) {
  const x = false;
  return (
    <div className="brow">
      <div className="btop">
        <span className={`bn ${side}`}>{name}<span className="hcp"> ({hcp})</span>{stroke && <i className="sdot2" />}</span>
        {scorer && (
          <span className="skin"><Pencil />Scorekeeper<button className="swap">Switch</button></span>
        )}
      </div>
      <div className="tgs-wrap"><div className="tgs">
        {NOTE.map(t => {
          const val = par + t.o;
          const on = picked === val && !x;
          const adj = !!stroke && !x && picked !== undefined && val === picked - 1;
          return (
            <button key={t.o} className={`tg${on ? ' sel' : ''}${adj ? ' adj' : ''}`}>
              <span className={`mk ${t.sh}`}>{val}</span>
              <span className="cap">{t.cap}</span>
            </button>
          );
        })}
      </div></div>
    </div>
  );
}

export function Derived({ kind }: { kind: 'waiting' | 'derived' | 'manual' | 'bye' }) {
  if (kind === 'waiting') return <div className="bder"><span className="tag">Hole not complete</span>Waiting on Kyle, JT.</div>;
  if (kind === 'manual') return <div className="bder"><span className="tag">Tapped, not computed</span>Set by hand by Griffin S.</div>;
  if (kind === 'bye') return <div className="byebar">Bye hole · match closed on 15 · recorded but does not count</div>;
  return (
    <div className="bder">
      <span className="tag">Decided by the app</span>
      <b>Griffin S.</b> net 4 against <b>Kyle P.</b> net 5. Vikes win the hole.
    </div>
  );
}

export function HoleFoot() {
  return (
    <div className="hfoot">
      <span>3 up after 7 · Griffin S.</span>
      <button className="lnk">Next hole ›</button>
    </div>
  );
}

/** The bottom bar is now the fallback, for when the scorer isn't one of the rows
    (foursomes, or the other match in a singles group). */
export function ScorerBar({ picking }: { picking?: boolean }) {
  return (
    <>
      <div className="holine">Taken over from Matt J. by Griffin S., 12 min ago</div>
      {picking && (
        <div className="picker">
          <button className="sel">Griffin S. (you)</button>
          <button>Matt J.</button>
          <button>Kyle P.</button>
          <button>JT W.</button>
        </div>
      )}
      <div className="scbar bottom">
        <span className="scin"><Pencil /><b>Griffin S.</b> is scoring this group</span>
        <button className="swap">{picking ? 'Cancel' : 'Switch'}</button>
      </div>
    </>
  );
}

export function FeedRows() {
  return (
    <>
      <button className="dayhd" aria-expanded={true}>
        <span className="l"><span className="n">Thu</span><span className="d">Oct 8</span></span>
        <span className="r"><span className="chev">▾</span></span>
      </button>
      <div className="ev cup big">
        <div className="t">3:42</div>
        <div className="bd">
          <div className="hl"><span className="tag">Lead change</span>Vikes lead</div>
          <div className="score"><span className="a">1</span><span className="d">–</span><span className="b">0</span>
            <span className="d" style={{ fontFamily: 'var(--body)', fontSize: 13, fontWeight: 400 }}>The Lassie</span></div>
        </div>
      </div>
      <div className="ev a win big">
        <div className="t">3:41</div>
        <div className="bd">
          <div className="hl"><span className="tag">Match final</span>Griffin S. / Matt J. win 4 &amp; 3</div>
          Over Kyle P. / JT W.
        </div>
      </div>
      <div className="ev a">
        <div className="t">2:58</div>
        <div className="bd">
          <span className="tag">Dormie</span><span className="who a">Vikes</span> cannot lose this one. 4 up with 4 to play.
        </div>
      </div>
      <div className="ev b">
        <div className="t">2:31</div>
        <div className="bd">
          <span className="tag gold">Birdie</span><span className="who b">Kyle P.</span> won 11 with a birdie.
          <span className="sub2">Griffin S. v Kyle P. · 3 up</span>
        </div>
      </div>
      <div className="ev">
        <div className="t">12:04</div>
        <div className="bd"><b>Round 1 under way</b> at Mammoth Dunes.<span className="sub2">Four-ball · 18 holes · tees 12:00 PM and 12:10 PM</span></div>
      </div>
      <div className="ev gold">
        <div className="t">11:40</div>
        <div className="bd"><b>The Freeman Cup is under way.</b><span className="sub2">Playing for The Lassie</span></div>
      </div>
      <button className="dayhd" aria-expanded={false}>
        <span className="l"><span className="n">Fri</span><span className="d">Oct 9</span></span>
        <span className="r">14 updates<span className="chev">▾</span></span>
      </button>
    </>
  );
}

export function RoundCardDemo() {
  return (
    <>
      <div className="dayrow"><span className="n">Thu</span><span className="d">Oct 8</span><span className="h">1 round · 18 holes</span></div>
      <div className="rcard">
        <div className="rtop">
          <div className="rleft">
            <div className="t1">Mammoth Dunes</div>
            <div className="t2">Round 1 · Four-ball · 18 holes</div>
            <div className="t3">Tees 12:00 PM and 12:10 PM · Griffin S. and Justin D. scoring</div>
          </div>
          <div className="rright"><span className="spill live"><i className="pulse" />Live</span><div className="rscore live">1 of 2 in</div></div>
        </div>
        <button className="mrow2 ax" aria-expanded={false}>
          <span className="p"><span className="a">Griffin S. / Matt J.</span><span className="v">V</span><span className="b">Kyle P. / JT W.</span></span>
          <span className="s a">VIK 4 &amp; 3</span><span className="cchev">▾</span>
        </button>
        <button className="mrow2 ax" aria-expanded={false}>
          <span className="p"><span className="a">Devin E. / Brian K.</span><span className="v">V</span><span className="b">Phil J. / Justin D.</span></span>
          <span className="s n">All square</span><span className="cchev">▾</span>
        </button>
      </div>
      <div className="rcard">
        <div className="rtop">
          <div className="rleft">
            <div className="t1">Sedge Valley</div>
            <div className="t2">Round 4 · Singles · 18 holes</div>
            <div className="t3">Tees 10:10 AM and 10:30 AM · Devin E. and Phil J. scoring</div>
          </div>
          <div className="rright"><span className="spill up">To play</span><div className="rscore up">4 points</div></div>
        </div>
        <button className="mrow2">
          <span className="p"><span className="a">Griffin S.</span><span className="v">V</span><span className="b">Kyle P.</span></span>
          <span className="s n">10:10 AM</span>
        </button>
        <div className="rfoot"><span>Pairings set. Cards handed in the night before.</span></div>
      </div>
    </>
  );
}

export function ScorecardDemo() {
  return <div className="inlinecard"><Scorecard match={MATCHES[0]} /></div>;
}

export function SettingsDemo() {
  return (
    <>
      <div className="sethd"><h2>Commissioner</h2><button className="done">Done</button></div>
      <div className="grp"><h3>Appearance</h3><div className="hint">Dark holds up better in direct sun on the course. Light is easier indoors.</div></div>
      <div className="fld"><label>Light mode</label><button className="sw" role="switch" aria-checked={false} /></div>
      <div className="grp"><h3>Rounds</h3></div>
      <div className="rdrow">
        <div className="r1"><span className="nm2">Round 1 · Mammoth Dunes</span><span className="cs">Thu Oct 8</span></div>
        <div className="r2"><select defaultValue="live"><option value="upcoming">Not started</option><option value="live">Live</option><option value="final">Complete</option></select></div>
      </div>
      <div className="grp"><h3>Scorers</h3></div>
      <div className="fld">
        <label>Round 1 · 12:00 PM<span className="sub2">Griffin, Matt, Kyle, JT</span></label>
        <select defaultValue="g"><option value="g">Griffin S.</option><option>Matt J.</option><option>Kyle P.</option><option>JT W.</option></select>
      </div>
      <div className="grp"><h3>Danger</h3><div className="hint">Cannot be undone. Do this once, before Thursday.</div></div>
      <div className="danger"><button className="dbtn">Clear all scores</button></div>
    </>
  );
}

export function Buttons() {
  return (
    <div className="ds-row">
      <button className="abtn" style={{ width: 'auto', padding: '12px 18px' }}>Email me a code</button>
      <button className="swap">Switch</button>
      <button className="cardlnk">All 18 holes</button>
      <button className="lnk">Next hole ›</button>
      <button className="aghost">Use a different email</button>
      <button className="done">Done</button>
    </div>
  );
}

export function Tags() {
  return (
    <div className="ds-row">
      <span className="tag">Match final</span>
      <span className="tag gold">Birdie</span>
      <span className="spill live"><i className="pulse" />Live</span>
      <span className="spill final">Final</span>
      <span className="spill up">To play</span>
      <span className="chipstate final">Final</span>
      <span className="chipstate dormie">Dormie</span>
      <span className="chipstate live2">Live</span>
      <span className="badge ok">Index on file</span>
      <span className="badge warn">No index</span>
    </div>
  );
}

export function Inputs() {
  return (
    <div className="auth" style={{ padding: 0, maxWidth: 320 }}>
      <input className="ainput" type="email" placeholder="you@example.com" readOnly />
      <input className="ainput code" inputMode="numeric" placeholder="······" defaultValue="482913" readOnly />
      <div className="aerr">That code didn't match, or it expired. Try again or request a new one.</div>
    </div>
  );
}

export function Empty() {
  return (
    <div className="empty">
      <b>Quiet out there</b>
      Every hole won, every match that turns, and every scorer switch lands here.
    </div>
  );
}
