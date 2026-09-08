import { CFG, half } from '../lib/scoring';
import { TIEBREAK, type MomentsState } from '../lib/moments';

interface Props {
  ms: MomentsState;
  openKey: string;              // 'won' | 'duel' | 'day:...'
  commissioner: boolean;
  onClose: () => void;
  onSeeLive?: () => void;
  onEnterScores: () => void;
}

/**
 * The Captains Shootout call-to-action, the one recap moment that is not
 * a share card: the day recap and the finale live in ShareCard now, so a
 * player can share them as they are.
 */
export default function MomentOverlay({ ms, openKey, commissioner, onClose, onEnterScores }: Props) {
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
  return null;
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
