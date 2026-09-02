import { CFG, half } from '../lib/scoring';
import { TrophySvg } from './CupStrip';
import { TIEBREAK, type MomentsState, type DayMoment, type WonMoment } from '../lib/moments';

interface Props {
  ms: MomentsState;
  openKey: string;              // 'won' | 'duel' | 'day:...'
  commissioner: boolean;
  onClose: () => void;
  onSeeLive: () => void;
  onEnterScores: () => void;
}

/**
 * The full-screen recap moments. Which one shows is decided by the key;
 * dismissing goes back to the app, where each moment keeps a home — the
 * strip and feed for the finale, the pinned banner for a pending
 * shootout, the feed and Schedule chips for day recaps.
 */
export default function MomentOverlay({ ms, openKey, commissioner, onClose, onSeeLive, onEnterScores }: Props) {
  if (openKey === 'won' && ms.won) return <Won w={ms.won} onClose={onClose} onSeeLive={onSeeLive} />;
  if (openKey === 'duel' && ms.tie) {
    return (
      <Duel
        ms={ms}
        commissioner={commissioner}
        onClose={onClose}
        onEnterScores={onEnterScores}
      />
    );
  }
  const d = ms.days.find(x => x.key === openKey);
  if (d) return <Day d={d} onClose={onClose} onSeeLive={onSeeLive} />;
  return null;
}

function Day({ d, onClose, onSeeLive }: { d: DayMoment; onClose: () => void; onSeeLive: () => void }) {
  return (
    <div className="moment" role="dialog" aria-modal="true" aria-label={`${d.dow} recap`}>
      <div className="mo">
        <div className="kick">{d.dow} · {d.courses} · in the book</div>
        <h1>{d.headline}</h1>
        <div className="score">
          <span className="pt a">{half(d.pts.a)}</span>
          <span className="d">–</span>
          <span className="pt b">{half(d.pts.b)}</span>
          <span className="nm">today</span>
        </div>
        <div className="rule" />
        {d.rows.map((r, i) => (
          <div key={i} className="mrow3">
            <span className="p">{r.a}<span className="vv">V</span>{r.b}</span>
            <span className={`s ${r.w}`}>{r.label}</span>
          </div>
        ))}
        <div className="cupline">
          <span>{CFG.trophy}: {CFG.teams.a.name} {half(d.cum.a)} · {CFG.teams.b.name} {half(d.cum.b)}</span>
          <span>{d.toClinch <= 0 ? 'Clinched' : `${half(d.toClinch)} to clinch`}</span>
        </div>
        <div className="next">
          {d.next && (
            <div className="nextcard">
              <div className="t1">Tomorrow: {d.next.course}</div>
              <div className="t2">{d.next.rd} · {d.next.fmt} · {d.next.holes} holes · tees {d.next.tees}</div>
            </div>
          )}
          <button className="abtn" onClick={onSeeLive}>See the full day</button>
          <button className="aghost" onClick={onClose}>Good night</button>
        </div>
      </div>
    </div>
  );
}

function Won({ w, onClose, onSeeLive }: { w: WonMoment; onClose: () => void; onSeeLive: () => void }) {
  const t = CFG.teams[w.winner];
  return (
    <div className="moment" role="dialog" aria-modal="true" aria-label="The finale">
      <div className="mo won">
        <div className="kick">{w.kick}</div>
        <span className="jugbig"><TrophySvg /></span>
        <h1>The {t.name} win {CFG.trophy}</h1>
        <div className="final">
          <span className="pt a">{half(w.pts.a)}</span>
          <span className="d">–</span>
          <span className="pt b">{half(w.pts.b)}</span>
        </div>
        {w.viaShootout && w.shootout && (
          <div className="shline">
            {TIEBREAK.name}: {w.shootout.a.join('–')} against {w.shootout.b.join('–')} · {w.shootout.ta}–{w.shootout.tb}
          </div>
        )}
        <div className="sub">{w.how}</div>
        <div className="rule" />
        <div className="mvp">
          <b>{w.roster}</b> take the jug.
          {w.mvp && <><br />MVP of the Freeman Cup: <b>{w.mvp.name}</b> · {w.mvp.line}.</>}
        </div>
        <div className="next">
          <button className="abtn" onClick={onSeeLive}>See how it happened</button>
          <button className="aghost" onClick={onClose}>Back to the app</button>
        </div>
      </div>
    </div>
  );
}

function Duel({ ms, commissioner, onClose, onEnterScores }: {
  ms: MomentsState; commissioner: boolean; onClose: () => void; onEnterScores: () => void;
}) {
  const tie = ms.tie!;
  return (
    <div className="moment" role="dialog" aria-modal="true" aria-label={TIEBREAK.name}>
      <div className="mo duel">
        <div className="kick">All {tie.a + tie.b} points played</div>
        <h1>{half(tie.a)}–{half(tie.b)}. {TIEBREAK.name}.</h1>
        <div className="sub">
          {CFG.trophy} goes to the {TIEBREAK.where}. Three holes, stroke play,
          putt until it drops. Lowest total takes the jug.
        </div>
        <div className="caps">
          <div className="cap2"><div className="nm2">{ms.captains.a}</div><div className="tm a">{CFG.teams.a.name}</div></div>
          <span className="vs">V</span>
          <div className="cap2"><div className="nm2">{ms.captains.b}</div><div className="tm b">{CFG.teams.b.name}</div></div>
        </div>
        <div className="rule" style={{ margin: '14px 0 2px' }} />
        {TIEBREAK.stations.map((x, n) => (
          <div key={n} className="stn2">
            <span className="n3">Hole {n + 1}</span>
            <span className="ft">{x.d}<i>ft</i></span>
            <span className="nm3">{x.n}</span>
            <span className="hint2">{x.hint}</span>
          </div>
        ))}
        <div className="fineprint">
          Captains only. One plays a hole out completely before the other starts.
          Honour alternates. Max {TIEBREAK.maxStrokes} strokes a hole, so a blow-up
          can't end it early. Nothing is conceded.
        </div>
        <div className="next">
          {commissioner
            ? <button className="abtn" onClick={onEnterScores}>Enter the putts</button>
            : <button className="abtn" onClick={onClose}>To the practice green</button>}
          <button className="aghost" onClick={onClose}>Not yet, still arguing</button>
        </div>
      </div>
    </div>
  );
}
