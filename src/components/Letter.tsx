/**
 * The letter: a sealed envelope with the player's name on it, opened at
 * the table after the commissioner sends the pairings. Inside: partner,
 * opponents, tee time, strokes. One per round, once per device.
 * The envelope is drawn as SVG so the flap and body share their corners.
 */
import { useState } from 'react';
import { CFG, P } from '../lib/scoring';
import type { EventData } from '../hooks/useEventData';
import { strokeHoles, type Letter as LetterData } from '../lib/letters';

const fn = (k: string) => (P[k]?.n || k).split(' ')[0];

export default function LetterMoment({ data, letter, onClose, onSeeMatch }: {
  data: EventData; letter: LetterData; onClose: () => void; onSeeMatch: () => void;
}) {
  const [torn, setTorn] = useState(false);
  const me = data.meKey;
  const myName = fn(me);
  const side = letter.match.a.includes(me) ? 'a' : 'b';
  const team = CFG.teams[side];
  const them = CFG.teams[side === 'a' ? 'b' : 'a'];
  const { session: s, match: m } = letter;
  const singles = !letter.partner;
  // strokes off the low man, my side first; the low man shows a dash
  const order = side === 'a' ? [...m.a, ...m.b] : [...m.b, ...m.a];
  const shotsOf = (k: string) => letter.strokes.find(x => x.key === k)?.n ?? 0;
  const anyShots = letter.strokes.some(x => x.n > 0);
  const myHoles = strokeHoles(m, me, s.holes);
  // player keys are lowercased first names (see useEventData.playerKey)
  const hi = (k: string) => Math.round(Number(data.players.find(p => p.name.split(' ')[0].toLowerCase() === k)?.handicap_index ?? NaN));
  const named = (k: string) => <>{fn(k)}{Number.isFinite(hi(k)) && <small className="hi">{hi(k)}</small>}</>;

  return (
    <div className="moment envmo" role="dialog" aria-modal="true" aria-label="Your pairings letter">
      <div className="mo">
        <div className="kick">{s.rd} · {s.day} · {s.course}</div>
        <h1>{singles ? 'Your matchup awaits' : 'Your pairing is locked in'}</h1>

        <button
          className={`env ${side}${torn ? ' open' : ''}`}
          onClick={() => { if (!torn) setTorn(true); }}
          aria-label={torn ? 'Your letter' : 'Tap to open your letter'}
          disabled={torn}
        >
          {/* back of the envelope */}
          <svg className="envback" viewBox="0 0 280 190" aria-hidden="true">
            <rect x="0" y="0" width="280" height="190" rx="6" fill="#e9e1cc" />
            <path d="M0 6 L140 118 L280 6 L280 184 Q280 190 274 190 H6 Q0 190 0 184 Z" fill="#dfd6bf" />
            <path d="M0 184 Q0 190 6 190 H274 Q280 190 280 184 L140 90 Z" fill="#e6ddc7" />
          </svg>
          {/* the flap, hinged along the top edge */}
          <svg className="envflap" viewBox="0 0 280 118" aria-hidden="true">
            <path d="M0 6 Q0 0 6 0 H274 Q280 0 280 6 L140 118 Z" fill={torn ? '#d8ceb6' : '#f1eadb'} />
          </svg>
          {!torn && <span className="wax"><i /></span>}
          {torn && (
            <div className="card">
              <i className="badge" />
              <div className="k1">THE FREEMAN CUP · 2026</div>
              <div className="k2">{s.fmt} · off at {letter.tee}</div>
              <div className={`line ${side}`}>{named(me)}{letter.partner && <><i>&amp;</i>{named(letter.partner)}</>}</div>
              <div className="k2 vs">against</div>
              <div className={`line ${side === 'a' ? 'b' : 'a'}`}>{letter.opponents.map((k, i) => <span key={k}>{i > 0 && <i>&amp;</i>}{named(k)}</span>)}</div>
            </div>
          )}
          <span className="to">{torn ? team.name : myName}</span>
        </button>

        {!torn
          ? <div className="tap">Tap to open</div>
          : <div className="next">
              <div className="shots">
                <div className="k">{anyShots ? 'Strokes off the low man' : 'Straight up, no strokes'}</div>
                <div className="tiles">
                  {order.map(k => {
                    const n = shotsOf(k);
                    const kside = m.a.includes(k) ? 'a' : 'b';
                    return (
                      <div key={k} className={`tile${k === me ? ' me' : ''}`}>
                        <span className={`nm ${kside}`}>{k === me ? 'You' : fn(k)}</span>
                        <span className="n">{n > 0 ? n : '–'}</span>
                      </div>
                    );
                  })}
                </div>
                {myHoles.length > 0 && (
                  <div className="row"><span className="k">Your dots</span><span className="v">{myHoles.join(' · ')}</span></div>
                )}
                <div className="row"><span className="k">First tee</span><span className="v">{letter.tee} · {them.name} in {them.name === 'Vikes' ? 'red' : 'blue'}</span></div>
              </div>
              <button className="abtn" onClick={onSeeMatch}>See the match</button>
              <button className="aghost" onClick={onClose}>Close</button>
            </div>}
      </div>
    </div>
  );
}
