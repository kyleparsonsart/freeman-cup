import { useState } from 'react';
import { calc, roundState, half, P, CFG, type Match, type Session } from '../lib/scoring';
import Scorecard from './Scorecard';
import { mvpBoard, roundRaces, relLabel } from '../lib/standings';
import type { MomentsState } from '../lib/moments';
import { IconMedal } from './icons';
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

  return (
    <>
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

      <TheRaces sessions={sessions} matches={matches} />
    </>
  );
}

/**
 * The races: the MVP board and Player of the Round, in place of the old
 * rosters. Net against par, own-ball rounds, full cards only — a short
 * card stays on the board, struck through, so the missing byes have a
 * face.
 */
function TheRaces({ sessions, matches }: { sessions: Session[]; matches: Match[] }) {
  const board = mvpBoard(sessions, matches);
  const races = roundRaces(sessions, matches);
  return (
    <>
      <div className="sh"><h2>The races</h2><span className="meta">Net against par</span></div>
      {board.length === 0 ? (
        <div className="empty">
          <IconMedal />
          <b>The board opens Thursday</b>
          First full cards start the race — lowest net against par takes
          the marker, and the MVP.
        </div>
      ) : (<>
      <div className="racehint">
        MVP of the Freeman Cup: lowest net across the own-ball rounds.
        Full cards only — finish your byes or fall off the board.
      </div>
      {(
        <div className="mvpboard">
          {board.map((r, i) => (
            <div key={r.key} className={`mvprow${r.eligible ? '' : ' off'}`}>
              <span className="rk">{r.eligible ? i + 1 : '–'}</span>
              <span className={`nm4 ${r.side}`}>{r.name}</span>
              <span className="rd2">{r.eligible ? `${r.rounds} round${r.rounds === 1 ? '' : 's'}` : 'card short'}</span>
              <span className="net">{relLabel(r.rel)}</span>
            </div>
          ))}
        </div>
      )}</>)}

      <div className="sh"><h2>Player of the round</h2><span className="meta">The ball marker</span></div>
      {races.map(r => (
        <div key={r.roundId} className={`potr${r.state === 'final' ? '' : ' up'}`}>
          <span className="r3">{r.rd} · {r.course}</span>
          <span className="w3">
            {r.winner
              ? <><b className={r.winner.side}>{r.winner.name}</b> · {relLabel(r.winner.rel)} net</>
              : r.state === 'live' ? 'In play'
              : r.state === 'upcoming' ? 'To come'
              : 'No full cards'}
          </span>
        </div>
      ))}
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
