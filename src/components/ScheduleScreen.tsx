import { useState } from 'react';
import { calc, roundState, half, P, CFG, type Match, type Session } from '../lib/scoring';
import Scorecard from './Scorecard';
import { roundRaces, type RoundRace } from '../lib/standings';
import type { MomentsState } from '../lib/moments';
import type { EventData } from '../hooks/useEventData';

const fn = (n?: string | null) => (n || '').split(' ')[0];
const names = (keys: string[]) => keys.map(k => fn(P[k]?.n) || k).join(' / ');

export default function ScheduleScreen({ data, moments = null, onMoment }: {
  data: EventData;
  moments?: MomentsState | null;
  onMoment?: (key: string) => void;
}) {
  const { scoringSessions: sessions, scoringMatches: matches } = data;
  // which scorecards are open; cards in the live round open by default
  const [cards, setCards] = useState<Record<string, boolean>>({});
  const isOpen = (m: Match, st: string) => cards[m.id] ?? st === 'live';

  const days = [...new Set(sessions.map(x => x.day))];
  const races = roundRaces(sessions, matches);

  const won = moments?.won ?? null;

  return (
    <>
      {won && onMoment && (
        <div className="dayfade">
          <button className="wonbar" onClick={() => onMoment('won')}>
            <span className="t"><b className={won.winner}>{CFG.teams[won.winner].name} take {CFG.trophy}</b>
              <small>{half(won.pts[won.winner])} to {half(won.pts[won.winner === 'a' ? 'b' : 'a'])}{won.viaShootout ? ' · won on the practice green' : ''}</small></span>
            <span className="go">Open ›</span>
          </button>
          {won.viaShootout && won.shootout && (
            <button className="shrow" onClick={() => onMoment('shootout')}>
              <span>Captains Shootout · {moments!.captains.a} {won.shootout.ta}, {moments!.captains.b} {won.shootout.tb}</span>
              <span className="go">Open ›</span>
            </button>
          )}
        </div>
      )}
      {days.map((d, di) => {
        const rs = sessions.filter(x => x.day === d);
        const holes = rs.reduce((a, x) => a + x.holes, 0);
        const [dow, ...rest] = d.split(' ');
        const dm = moments?.days.find(x => x.day === d);
        return (
          <div key={d} className="dayfade" style={{ animationDelay: `${di * 110}ms` }}>
            <div className="dayrow">
              <span className="n">{dow}</span>
              <span className="d">{rest.join(' ')}</span>
              <span className="h">{rs.length} round{rs.length > 1 ? 's' : ''} · {holes} holes</span>
              {dm && onMoment && (
                <button className="rchip" onClick={() => onMoment(dm.key)}>Recap</button>
              )}
            </div>
            {rs.map((x, xi) => (<div key={x.id}>
              {xi > 0 && <div className="perf" aria-hidden="true" />}
              <RoundCard
                key={x.id}
                s={x}
                ms={matches.filter(m => m.s === x.id)}
                isOpen={isOpen}
                toggle={(m, st) => setCards(c => ({ ...c, [m.id]: !isOpen(m, st) }))}
                onCard={onMoment}
                race={races.find(r => r.roundId === x.id)}
              />
            </div>))}
          </div>
        );
      })}

    </>
  );
}

interface RoundCardProps {
  s: Session;
  ms: Match[];
  isOpen: (m: Match, st: string) => boolean;
  toggle: (m: Match, st: string) => void;
  onCard?: (key: string) => void;
  race?: RoundRace;
}

function RoundCard({ s, ms, isOpen, toggle, onCard, race }: RoundCardProps) {
  const st = roundState(s);
  let a = 0, b = 0;
  ms.forEach(m => { const r = calc(m); a += r.pts.a; b += r.pts.b; });
  const done = ms.filter(m => calc(m).done).length;

  // only Live earns a pill; the score line says final or to play on its own
  const pill = st === 'live' ? <span className="spill live"><i className="pulse" />Live</span> : null;

  const scoreline = st === 'final'
    ? <div className="rscore"><span className="a">{half(a)}</span><span className="d">–</span><span className="b">{half(b)}</span></div>
    : st === 'live'
    ? <div className="rscore live">{done} of {ms.length} in</div>
    : <div className="rscore up">{ms.length || (s.fmt === 'Singles' ? 4 : 2)} points</div>;

  return (
    <div className="rcard">
      <div className="rtop">
        <div className="rleft">
          <div className="t1">{s.course}</div>
          <div className="t2">{s.rd} · {s.fmt} · {s.holes} holes</div>
          <div className="t3">
            Tees {s.tees.join(' and ')} · {s.scorer.map(k => fn(P[k]?.n) || 'nobody').join(' and ')} scoring
          </div>
          {onCard && ms.some(m => calc(m).done) && (
            <div className="sumchips">
              {ms.filter(m => calc(m).done).map(m => {
                const inGroup = ms.filter(x => x.g === m.g).length;
                const label = inGroup > 1 ? `${names(m.a)} v ${names(m.b)}` : `Group ${String.fromCharCode(65 + m.g)} Summary`;
                return <button key={m.id} className="rchip sum" onClick={() => onCard(`match:${m.id}`)}>{label}</button>;
              })}
            </div>
          )}
        </div>
        <div className="rright">{pill}{scoreline}</div>
      </div>

      {ms.length === 0 && st !== 'final' && (
        // pairings not posted: keep the card's shape, names TBD
        (s.fmt === 'Singles' ? s.tees.flatMap(t => [t, t]) : s.tees).map((t, i) => (
          <div key={i} className="mrow2 tbd">
            <span className="p"><span className="a">TBD</span><span className="v">V</span><span className="b">TBD</span></span>
            <span className="s n">{t}</span>
          </div>
        ))
      )}
      {ms.map(m => {
        const r = calc(m);
        const stat = !r.played ? s.tees[m.g]
          : r.done ? (r.w === 'h' ? 'Halved' : `${CFG.teams[r.w!].short} ${r.label}`)
          : (r.diff === 0 ? 'All square' : `${CFG.teams[r.w!].short} ${Math.abs(r.diff)} up`);
        const cls = !r.played ? 'n' : r.done ? (r.w === 'h' ? 'h' : r.w!) : (r.w || 'n');
        const open = !!r.played && isOpen(m, st);
        return (
          <div key={m.id}>
            <div className={`mrow2${r.played ? ' ax' : ''}${open ? ' open' : ''}`}>
              <button
                className="mmain"
                aria-expanded={open}
                onClick={() => { if (r.played) toggle(m, st); }}
              >
                <span className="p">
                  <span className="a">{names(m.a)}</span>
                  <span className="v">V</span>
                  <span className="b">{names(m.b)}</span>
                </span>
                <span className={`s ${cls}`}>{stat}</span>
                {r.played > 0 && <span className="cchev">▾</span>}
              </button>
            </div>
            {open && <div className="inlinecard"><Scorecard match={m} /></div>}
          </div>
        );
      })}

      {st === 'final' && race?.winner && onCard && (
        // the name stays sealed until the card opens
        <div className="potrrow">
          <span className="lbl">Player of the round</span>
          <button className="rchip sum" onClick={() => onCard(`potr:${s.id}`)}>View</button>
        </div>
      )}
      {st === 'upcoming' && (
        <div className="rfoot"><span>{ms.length ? 'Pairings set. Cards handed in the night before.' : 'Pairings post the night before, from the captains’ sheets.'}</span></div>
      )}
    </div>
  );
}
