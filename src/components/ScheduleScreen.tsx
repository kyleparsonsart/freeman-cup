import { useState } from 'react';
import { calc, roundState, half, P, CFG, type Match, type Session } from '../lib/scoring';
import Scorecard from './Scorecard';
import { TIEBREAK, type MomentsState } from '../lib/moments';
import type { EventData } from '../hooks/useEventData';

const fn = (n?: string | null) => (n || '').split(' ')[0];
const names = (keys: string[]) => keys.map(k => fn(P[k]?.n) || k).join(' / ');

export default function ScheduleScreen({ data, moments = null, onMoment }: {
  data: EventData;
  moments?: MomentsState | null;
  onMoment?: (key: string) => void;
}) {
  const { scoringSessions: sessions, scoringMatches: matches, players, teams } = data;
  // which scorecards are open; cards in the live round open by default
  const [cards, setCards] = useState<Record<string, boolean>>({});
  const isOpen = (m: Match, st: string) => cards[m.id] ?? st === 'live';

  const days = [...new Set(sessions.map(x => x.day))];
  const T = matches.length;

  return (
    <>
      {days.map(d => {
        const rs = sessions.filter(x => x.day === d);
        const holes = rs.reduce((a, x) => a + x.holes, 0);
        const [dow, ...rest] = d.split(' ');
        const dm = moments?.days.find(x => x.day === d);
        return (
          <div key={d}>
            <div className="dayrow">
              <span className="n">{dow}</span>
              <span className="d">{rest.join(' ')}</span>
              <span className="h">{rs.length} round{rs.length > 1 ? 's' : ''} · {holes} holes</span>
              {dm && onMoment && (
                <button className="rchip" onClick={() => onMoment(dm.key)}>Recap ›</button>
              )}
            </div>
            {rs.map(x => (
              <RoundCard
                key={x.id}
                s={x}
                ms={matches.filter(m => m.s === x.id)}
                isOpen={isOpen}
                toggle={(m, st) => setCards(c => ({ ...c, [m.id]: !isOpen(m, st) }))}
              />
            ))}
          </div>
        );
      })}

      <div className="sh"><h2>Rosters</h2><span className="meta">Index</span></div>
      <div className="roster">
        {(['a', 'b'] as const).map(side => {
          const team = teams.find(t => t.side === side);
          const ps = players.filter(p => p.team_id === team?.id).sort((x, y) => x.handicap_index - y.handicap_index);
          return (
            <div key={side} className={`rcol ${side}`}>
              <h4>{team?.name}</h4>
              {ps.map(p => (
                <div key={p.id} className="pl">
                  <span>{fn(p.name)}{p.is_captain && <span className="cap">C</span>}</span>
                  <span className="hc">{p.handicap_index}</span>
                </div>
              ))}
            </div>
          );
        })}
      </div>

      <div className="sh"><h2>If we finish level</h2></div>
      <div style={{ padding: '0 18px 2px', fontSize: 15, color: 'var(--moss)', lineHeight: 1.55 }}>
        {Math.floor(T / 2)}-{Math.floor(T / 2)} goes to the{' '}
        <b style={{ color: 'var(--bone)' }}>{TIEBREAK.name}</b> on the {TIEBREAK.where}.
        Captains only. Three holes, stroke play, putt until it drops. Lowest total takes the jug.
        Hole two is played from the fringe, putter only.
      </div>
      <div className="stations">
        {TIEBREAK.stations.map((x, n) => (
          <div key={n} className="stn">
            <span className="sh3">Hole {n + 1}</span>
            <span className="sd">{x.d}<i>ft</i></span>
            <span className="sn">{x.n}</span>
          </div>
        ))}
      </div>
    </>
  );
}

interface RoundCardProps {
  s: Session;
  ms: Match[];
  isOpen: (m: Match, st: string) => boolean;
  toggle: (m: Match, st: string) => void;
}

function RoundCard({ s, ms, isOpen, toggle }: RoundCardProps) {
  const st = roundState(s);
  let a = 0, b = 0;
  ms.forEach(m => { const r = calc(m); a += r.pts.a; b += r.pts.b; });
  const done = ms.filter(m => calc(m).done).length;

  const pill = st === 'live' ? <span className="spill live"><i className="pulse" />Live</span>
    : st === 'final' ? <span className="spill final">Final</span>
    : <span className="spill up">To play</span>;

  const scoreline = st === 'final'
    ? <div className="rscore"><span className="a">{half(a)}</span><span className="d">–</span><span className="b">{half(b)}</span></div>
    : st === 'live'
    ? <div className="rscore live">{done} of {ms.length} in</div>
    : <div className="rscore up">{ms.length} point{ms.length === 1 ? '' : 's'}</div>;

  return (
    <div className="rcard">
      <div className="rtop">
        <div className="rleft">
          <div className="t1">{s.course}</div>
          <div className="t2">{s.rd} · {s.fmt} · {s.holes} holes</div>
          <div className="t3">
            Tees {s.tees.join(' and ')} · {s.scorer.map(k => fn(P[k]?.n) || 'nobody').join(' and ')} scoring
          </div>
        </div>
        <div className="rright">{pill}{scoreline}</div>
      </div>

      {ms.map(m => {
        const r = calc(m);
        const stat = !r.played ? s.tees[m.g]
          : r.done ? (r.w === 'h' ? 'Halved' : `${CFG.teams[r.w!].short} ${r.label}`)
          : (r.diff === 0 ? 'All square' : `${CFG.teams[r.w!].short} ${Math.abs(r.diff)} up`);
        const cls = !r.played ? 'n' : r.done ? (r.w === 'h' ? 'h' : r.w!) : (r.w || 'n');
        const open = !!r.played && isOpen(m, st);
        return (
          <div key={m.id}>
            <button
              className={`mrow2${r.played ? ' ax' : ''}`}
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
            {open && <div className="inlinecard"><Scorecard match={m} /></div>}
          </div>
        );
      })}

      {st === 'upcoming' && (
        <div className="rfoot"><span>Pairings set. Cards handed in the night before.</span></div>
      )}
    </div>
  );
}
