/**
 * The letter: a sealed envelope with the player's name on it, opened at
 * the table after the commissioner sends the pairings. Inside: partner,
 * opponents, tee time, strokes. One per round, once per device.
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
  const shots = letter.strokes.map(x => `${x.key === me ? 'You get' : `${fn(x.key)} gets`} ${x.n}`).join(', ');
  const myHoles = strokeHoles(m, me, s.holes);
  // player keys are lowercased first names (see useEventData.playerKey)
  const hi = (k: string) => Math.round(Number(data.players.find(p => p.name.split(' ')[0].toLowerCase() === k)?.handicap_index ?? NaN));
  const named = (k: string) => <>{fn(k)}{Number.isFinite(hi(k)) && <small className="hi">{hi(k)}</small>}</>;

  return (
    <div className="moment envmo" role="dialog" aria-modal="true" aria-label="Your pairings letter">
      <div className="mo">
        <div className="kick">{s.rd} · {s.day} · {s.course}</div>
        <h1>{torn ? (letter.partner ? 'Your partner' : 'Your match') : `A letter for ${myName}`}</h1>
        <div className={`env ${side}${torn ? ' open' : ''}`}>
          <div className="flap" />
          {!torn && <div className="wax"><span /></div>}
          {torn && (
            <div className="card">
              <div className="badge"><span>FC</span></div>
              <div className="k2">{s.fmt} · off at {letter.tee}</div>
              <div className={`line ${side}`}>{named(me)}{letter.partner && <><i>&amp;</i>{named(letter.partner)}</>}</div>
              <div className="k2 vs">against</div>
              <div className={`line ${side === 'a' ? 'b' : 'a'}`}>{letter.opponents.map((k, i) => <span key={k}>{i > 0 && <i>&amp;</i>}{named(k)}</span>)}</div>
            </div>
          )}
          <div className="to"><small>THE FREEMAN CUP · 2026</small>{torn ? team.name : myName}</div>
        </div>
        {!torn
          ? <button className="abtn" onClick={() => setTorn(true)}>Open it</button>
          : <div className="next">
              <div className="sub">
                {shots ? `Off the low man: ${shots}.` : 'Straight up, no shots either way.'}
                {myHoles.length > 0 && ` Your dots: ${myHoles.join(', ')}.`}
                {` ${them.name} in ${them.name === 'Vikes' ? 'red' : 'blue'}, first tee ${letter.tee}.`}
              </div>
              <button className="abtn" onClick={onSeeMatch}>See the match</button>
              <button className="aghost" onClick={onClose}>Close</button>
            </div>}
      </div>
    </div>
  );
}
