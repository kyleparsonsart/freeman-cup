/**
 * The Cup tab's lower half: the King's Race (MVP board) and The field,
 * with the squiggle that divides the sections. Lived on Schedule until
 * Sep 9; moved here so "where things stand" is one page.
 */
import { P, CFG, type Match, type Session } from '../lib/scoring';
import { mvpBoard, relLabel } from '../lib/standings';
import { IconMedal, IconCrown } from './icons';

const fn = (n?: string | null) => (n || '').split(' ')[0];

/**
 * The race: the MVP board, in place of the old rosters. Player of the
 * Round lives on each round's card. Net against par, own-ball rounds, full cards only — a short
 * card stays on the board, struck through, so the missing byes have a
 * face.
 */
export function TheRaces({ sessions, matches, onOpen, onRule }: { sessions: Session[]; matches: Match[]; onOpen?: (key: string) => void; onRule?: (article: number) => void }) {
  const board = mvpBoard(sessions, matches);
  return (
    <>
      <div className="sh"><h2>The King’s Race</h2>{onRule && <button className="rchip" onClick={() => onRule(11)}>How points work</button>}</div>
      {board.length === 0 ? (
        <div className="empty">
          <IconMedal />
          <b>The board opens Thursday</b>
          First cards start the race. Hole points: 2 for a hole your ball
          won alone, 1 for one your side won together. A halve earns nothing.
        </div>
      ) : (<>
      <div className="mvpboard">
          {board.map((r, i) => (
            <button key={r.key} className={`mvprow${r.eligible ? '' : ' off'}${r.eligible && i === 0 ? ' lead' : ''}`} onClick={() => onOpen?.(`player:${r.key}`)} disabled={!onOpen}>
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
export function Squiggle() {
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
export function TheField({ onOpen }: { onOpen?: (key: string) => void }) {
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
      <div className="field">{col('b')}{col('a')}</div>
    </>
  );
}
