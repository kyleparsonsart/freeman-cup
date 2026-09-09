import { useState } from 'react';
import { calc, roundState, half, P, CFG, type Match, type Session } from '../lib/scoring';
import Scorecard from './Scorecard';
import { mvpBoard, roundRaces, relLabel, type RoundRace } from '../lib/standings';
import type { MomentsState } from '../lib/moments';
import { IconMedal, IconCrown } from './icons';
import type { EventData } from '../hooks/useEventData';

const fn = (n?: string | null) => (n || '').split(' ')[0];
const names = (keys: string[]) => keys.map(k => fn(P[k]?.n) || k).join(' / ');

export default function ScheduleScreen({ data, moments = null, onMoment, onRule }: {
  data: EventData;
  moments?: MomentsState | null;
  onMoment?: (key: string) => void;
  onRule?: (article: number) => void;
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
                <button className="rchip" onClick={() => onMoment(dm.key)}>Recap ›</button>
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

      <TheField onOpen={onMoment} />
      <Squiggle />
      <TheRaces sessions={sessions} matches={matches} onOpen={onMoment} onRule={onRule} />
    </>
  );
}

/**
 * The race: the MVP board, in place of the old rosters. Player of the
 * Round lives on each round's card. Net against par, own-ball rounds, full cards only — a short
 * card stays on the board, struck through, so the missing byes have a
 * face.
 */
function TheRaces({ sessions, matches, onOpen, onRule }: { sessions: Session[]; matches: Match[]; onOpen?: (key: string) => void; onRule?: (article: number) => void }) {
  const board = mvpBoard(sessions, matches);
  return (
    <>
      <div className="sh"><h2>The King’s Race</h2>{onRule && <button className="rchip" onClick={() => onRule(11)}>How points work</button>}</div>
      {board.length === 0 ? (
        <div className="empty">
          <IconMedal />
          <b>The board opens Thursday</b>
          First cards start the race. Hole points: 3 for a hole your ball
          won alone, 2 for one your side won together. A halve earns nothing.
        </div>
      ) : (<>
      <div className="racehint">
        MVP of the Freeman Cup: most hole points. 3 for a hole your ball won
        alone, 2 for one your side won together, nothing for a halve. Byes
        count. Net against par breaks ties and is the Medalist line.
        Full cards only — finish your byes or fall off the board.
      </div>
      <div className="mvpboard">
          {board.map((r, i) => (
            <button key={r.key} className={`mvprow${r.eligible ? '' : ' off'}`} onClick={() => onOpen?.(`player:${r.key}`)} disabled={!onOpen}>
              <span className="rk">{r.eligible ? i + 1 : '–'}</span>
              <span className={`nm4 ${r.side}`}>{r.name}{r.eligible && i === 0 && <IconCrown />}</span>
              <span className="rd2">{r.eligible ? `${relLabel(r.rel)} net · ${r.solo} solo` : 'card short'}</span>
              <span className="net">{r.pts}</span>
            </button>
          ))}
      </div>
      </>)}

    </>
  );
}


/**
 * The section divider: a still sine wave, edge to edge. The path is
 * drawn in 15-unit wavelengths and stretched to the width it gets, so
 * the wave stays gentle on any phone.
 */
function Squiggle() {
  const d = 'M0 6 ' + Array.from({ length: 24 }, (_, k) => `Q${k * 15 + 7.5} ${k % 2 ? 12 : 0} ${(k + 1) * 15} 6`).join(' ');
  return (
    <div className="squig" aria-hidden="true">
      <svg viewBox="0 0 360 12" preserveAspectRatio="none"><path d={d} /></svg>
    </div>
  );
}

/**
 * The field: everyone playing, by team, with handicaps. Each name opens
 * the player card, which is the pre-trip share (and the only place to
 * find it before a ball is struck).
 */
function TheField({ onOpen }: { onOpen?: (key: string) => void }) {
  const keys = Object.keys(P);
  if (!keys.length) return null;
  const col = (side: 'a' | 'b') => (
    <div className="fcol">
      <div className={`fteam ${side}`}>{CFG.teams[side].name}</div>
      {keys.filter(k => P[k].t === side).sort((x, y) => Number(!!P[y].cap) - Number(!!P[x].cap) || P[x].n.localeCompare(P[y].n)).map(k => (
        <button key={k} className="fplayer" onClick={() => onOpen?.(`player:${k}`)} disabled={!onOpen}>
          <span className="nm">{fn(P[k].n)}{P[k].cap && <span className="capt">Captain</span>}</span>
          <span className="hc">{P[k].h}</span>
        </button>
      ))}
    </div>
  );
  return (
    <>
      <div className="sh field"><h2>The field</h2><span className="meta">Tap a name for the card</span></div>
      <div className="field">{col('a')}{col('b')}</div>
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
          <button className="rchip sum" onClick={() => onCard(`potr:${s.id}`)}>View ›</button>
        </div>
      )}
      {st === 'upcoming' && (
        <div className="rfoot"><span>{ms.length ? 'Pairings set. Cards handed in the night before.' : 'Pairings post the night before, from the captains’ sheets.'}</span></div>
      )}
    </div>
  );
}
