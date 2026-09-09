import type { ReactNode } from 'react';
import { half, CFG } from '../lib/scoring';
import {
  type CardData, type MatchCard, type DayCard, type FinaleCard, type ShootoutCard,
  type PlayerCard, type WeekCard, type LiveCard, type SpikeCard, type Side,
  matchCard, dayCard, finaleCard, shootoutCard, playerCard, weekCard, liveCard, spikeCard,
  names, first, dowOf, teeOf, ordinal, recordLabel, other,
} from '../lib/cards';
import { TIEBREAK } from '../lib/moments';
import { mvpBoard, holePoints } from '../lib/standings';

export type Card = MatchCard | DayCard | FinaleCard | ShootoutCard | PlayerCard | WeekCard | LiveCard | SpikeCard;

/** Resolve a card key against the data. Unknown or not-yet-true keys give null. */
export function resolveCard(
  d: CardData,
  key: string,
  when: Record<string, number>,
  shootout: { a: number[]; b: number[] } | null | undefined,
): Card | null {
  if (key === 'won') return finaleCard(d, when, shootout);
  if (key === 'shootout') return shootoutCard(d, shootout);
  if (key === 'live') return liveCard(d);
  const i = key.indexOf(':');
  const kind = key.slice(0, i), rest = key.slice(i + 1);
  if (kind === 'match') return matchCard(d, rest);
  if (kind === 'day') return dayCard(d, rest);
  if (kind === 'player') return playerCard(d, rest);
  if (kind === 'spike') return spikeCard(d, key);
  return null;
}

interface Props {
  card: Card;
  year: number;
  venue: string;
  data: CardData;
  onClose: () => void;
  onOpen: (key: string) => void;
}

/**
 * The full-screen moment. The 9:16 poster fills the screen above a single
 * Close, so a plain screenshot is the share.
 */
export default function ShareCard({ card, year, venue, data, onClose, onOpen }: Props) {
  return (
    <div className="moment poster" role="dialog" aria-modal="true" aria-label="Moment">
      <div className="pc">
        <Body card={card} onOpen={onOpen} year={year} data={data} />
        <div className="pfoot"><span className="k">The Freeman Cup · {venue}</span><span className="yr">{year}</span></div>
      </div>
      <div className="pacts">
        <button className="abtn" onClick={onClose}>Close</button>
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------- pieces */

const Badge = ({ size = 34 }: { size?: number }) => <span className="pbadge" style={{ width: size, height: size }} />;

function Top({ l1, l2, live }: { l1: ReactNode; l2?: ReactNode; live?: boolean }) {
  return (
    <div className="ptop">
      <Badge />
      <div className="k">{live && <i className="pdot" />}{l1}{l2 && <><br />{l2}</>}</div>
    </div>
  );
}

const tc = (s: Side | 'h' | null) => (s === 'a' ? 'ta' : s === 'b' ? 'tb' : 'th');

function Name({ k, side, onOpen }: { k: string; side: Side; onOpen: (key: string) => void }) {
  return <button className={`pname ${tc(side)}`} onClick={() => onOpen(`player:${k}`)}>{first(k)}</button>;
}

function Body({ card, onOpen, year, data }: { card: Card; onOpen: (key: string) => void; year: number; data: CardData }) {
  switch (card.kind) {
    case 'match': return <MatchBody c={card} onOpen={onOpen} />;
    case 'day': return <DayBody c={card} />;
    case 'won': return <FinaleBody c={card} year={year} />;
    case 'shootout': return <ShootoutBody c={card} />;
    case 'player': {
      const row = mvpBoard(data.scoringSessions, data.scoringMatches).find(r => r.key === card.pkey) || null;
      return <PlayerBody c={card} year={year} week={weekCard(data, card.pkey)} pts={row ? { pts: row.pts, solo: row.solo, team: row.team, halves: row.halves } : null} />;
    }
    case 'live': return <LiveBody c={card} />;
    case 'spike': return <SpikeBody c={card} />;
  }
}

/* 1 · match result */
function MatchBody({ c, onOpen }: { c: MatchCard; onOpen: (k: string) => void }) {
  const { m, s, r } = c;
  const w = c.winner;
  const win = w === 'h' ? null : w;
  const head = win ? `${CFG.teams[win].name} take it` : 'Halved';
  const [big, small] = r.label === 'Halved' ? ['½', ''] : r.label.includes('&') ? r.label.split(' & ') : [r.label.replace(/ up$/, ''), 'up'];
  const side = (k: Side) => (
    <div className={`pside ${win && win !== k ? 'lost' : ''}`}>
      <i className={`psw ${tc(k)}`} />
      {m[k].map((p, i) => <span key={p}>{i > 0 && <span className="amp"> &amp; </span>}<Name k={p} side={k} onOpen={onOpen} /></span>)}
    </div>
  );
  const top = win || 'a', bottom = other(top);
  return (
    <>
      <Top l1={`${dowOf(s.day)} · ${s.fmt}`} l2={s.course} />
      <div className="pblock">
        <div className={`k ${win ? tc(win) : ''}`}>{head}</div>
        <div className="pnum huge">
          {big}{small && <span className="dim">{r.label.includes('&') ? ' & ' : ' '}{small}</span>}
        </div>
      </div>
      <div className="phr" />
      {side(top)}
      <div className="k dim ind">{win ? 'beat' : 'with'}</div>
      {side(bottom)}
      <div className="phr" />
      <div className="k">Hole by hole</div>
      <div className={`pholes n${s.holes}`}>
        {c.holes.map((h, i) => (
          <span key={i} className={h === null ? 'x' : tc(h)}>{i + 1}</span>
        ))}
      </div>
      <MatchPoints m={m} s={s} order={[...m[top], ...m[bottom]]} />
    </>
  );
}

/** A footnote to the strip: what each player banked toward the MVP in this match. */
function MatchPoints({ m, s, order }: { m: MatchCard['m']; s: MatchCard['s']; order: string[] }) {
  if (s.fmt === 'Foursomes') return null;
  const tot: Record<string, number> = {};
  m.hs.forEach((_h, i) => {
    Object.entries(holePoints(m, s, i)).forEach(([k, p]) => { tot[k] = (tot[k] || 0) + p; });
  });
  if (!Object.keys(tot).length) return null;
  return (
    <div className="k dim pmvp">
      MVP points{order.map(k => <span key={k}> · {first(k)} {tot[k] || 0}</span>)}
    </div>
  );
}

/* 2 · day recap */
function DayBody({ c }: { c: DayCard }) {
  const lead: Side | null = c.cum.a > c.cum.b ? 'a' : c.cum.b > c.cum.a ? 'b' : null;
  const total = Math.max(10, c.cum.a + c.cum.b);
  const days = ['After day one', 'After two days', 'After three days'][c.index] || `After ${c.dow}`;
  return (
    <>
      <Top l1={c.dow} l2={c.courses} />
      <div className="pblock tight">
        <div className="k">{days}</div>
        <h2>
          {lead ? <>{CFG.teams[lead].name} lead,<br /></> : <>All square,<br /></>}
          <span className="ta">{half(c.cum.a)}</span> to <span className="tb">{half(c.cum.b)}</span>
        </h2>
      </div>
      <div className="pstrip">
        <div className="pbar"><i className="ta" style={{ width: `${(c.cum.a / total) * 100}%` }} /><i className="tb" style={{ width: `${(c.cum.b / total) * 100}%` }} /></div>
        <div className="ptick"><span className="ta">{CFG.teams.a.name.toUpperCase()} {half(c.cum.a)}</span><span>{half(c.clinch)} TO WIN</span><span className="tb">{CFG.teams.b.name.toUpperCase()} {half(c.cum.b)}</span></div>
      </div>
      <div className="phr" />
      {c.groups.map(g => (
        <div key={g.s.id}>
          {c.groups.length > 1 && <div className="k dim gk">{g.s.course} · {g.s.fmt}</div>}
          {g.rows.map(({ m, r }) => {
            const w = r.w === 'h' ? null : (r.w as Side | null);
            const l = w ? other(w) : 'b';
            const t = w || 'a';
            return (
              <div key={m.id} className="pres">
                <div className="who">
                  <span><i className={`psw ${tc(t)}`} />{names(m[t])}</span>
                  <span className="dim"><i className={`psw ${tc(l)} faint`} />{names(m[l])}</span>
                </div>
                <div className={`sc ${w ? tc(w) : 'th'}`}>{r.done ? r.label : r.played ? 'Live' : 'To play'}</div>
              </div>
            );
          })}
        </div>
      ))}
      {c.next && <div className="pnext k dim">Tomorrow · {c.next.course}</div>}
    </>
  );
}

/* 3 · finale */
function FinaleBody({ c, year }: { c: FinaleCard; year: number }) {
  const t = CFG.teams[c.winner];
  const cl = c.clinch;
  const w = cl && cl.r.w !== 'h' ? (cl.r.w as Side) : null;
  return (
    <div className="pcenter fin">
      <Badge size={54} />
      <div className="k" style={{ marginTop: 22 }}>The {year} Freeman Cup</div>
      <h2 className={`${tc(c.winner)} big`}>{t.name}</h2>
      <div className="k" style={{ marginTop: 6 }}>take {CFG.trophy}</div>
      <div className="pnum score">
        <span className={tc(c.winner)}>{half(c.winner === 'a' ? c.pts.a : c.pts.b)}</span>
        <span className="dim to">to</span>
        <span className={tc(other(c.winner))}>{half(c.winner === 'a' ? c.pts.b : c.pts.a)}</span>
      </div>
      <div className="phr full" />
      {cl && (
        <div className="pline">
          Clinched on the {ordinal(cl.r.played)} at {cl.s.course}<br />
          <b>{w ? `${names(cl.m[w])} beat ${names(cl.m[other(w)])}, ${cl.r.label}` : `${names(cl.m.a)} and ${names(cl.m.b)} halved`}</b>
        </div>
      )}
      {c.viaShootout && <div className="pline">Won on the practice green<br /><b>{TIEBREAK.name}</b></div>}
    </div>
  );
}

/* 4 · shootout */
function ShootoutBody({ c }: { c: ShootoutCard }) {
  const w = c.winner;
  return (
    <>
      <Top l1={c.s ? `${dowOf(c.s.day)} · ${c.s.course}` : 'Saturday'} l2={`Practice green`} />
      <div className="pblock tight">
        <div className="k tbrass">Level. Putt for it.</div>
        <h2>{c.captains[w]} wins<br />the Shootout</h2>
      </div>
      <div className="phr" />
      <div className="pres g head"><span className="k dim">Station</span><span className={`k ${tc('a')}`}>{c.captains.a}</span><span className={`k ${tc('b')}`}>{c.captains.b}</span></div>
      {TIEBREAK.stations.map((st, i) => (
        <div key={st.n} className="pres g"><span>{st.n} · {st.d} ft</span><span className="sc">{c.a[i]}</span><span className="sc">{c.b[i]}</span></div>
      ))}
      <div className="pres g total"><b>Total</b><span className={`pnum ${tc('a')}`}>{c.ta}</span><span className={`pnum ${tc('b')}`}>{c.tb}</span></div>
    </>
  );
}

/* 5 · player card: who they are before the trip, what they did once it starts */
type Pts = { pts: number; solo: number; team: number; halves: number };

function PlayerBody({ c, year, week, pts }: { c: PlayerCard; year: number; week: WeekCard | null; pts: Pts | null }) {
  // the week view opens as soon as a hole is scored, not only once a match is final
  const played = (c.played > 0 || pts !== null) && week;
  return (
    <>
      <Top l1="The field" l2={String(year)} />
      <div className="pblock tight">
        <div className={`k ${tc(c.side)}`}>{CFG.teams[c.side].name}{c.captain ? ' · Captain' : ''}{played ? ` · ${c.hcp}` : ''}</div>
        <h2 className="name">{c.name}</h2>
      </div>
      {played ? (
        <>
          <div className="pblock tight">
            <div className="k">Record</div>
            <div className="pnum huge">{week.record.w}<span className="dim">-</span>{week.record.l}<span className="dim">-</span>{week.record.h}</div>
          </div>
          <WeekTiles c={week} pts={pts} />
        </>
      ) : (
        <div className="ptiles left">
          <div className="tile"><div className="pnum">{c.hcp}</div><div className="k dim">Handicap</div></div>
          <div className="tile"><div className="pnum">{c.record.w + c.record.l + c.record.h ? recordLabel(c.record) : '0-0-0'}</div><div className="k dim">Record</div></div>
          {c.first && <div className="tile wide"><div className="pnum sm">{dowOf(c.first.s.day).slice(0, 3)} · {c.first.tee}</div><div className="k dim">First tee · {c.first.s.course}</div></div>}
        </div>
      )}
    </>
  );
}

/* 6 · the week's numbers, shared by the player card */
function WeekTiles({ c, pts }: { c: WeekCard; pts: Pts | null }) {
  const close = c.closeouts[c.closeouts.length - 1];
  return (
    <>
      <div className="ptiles left">
        {pts !== null
          ? <div className="tile"><div className="pnum tbrass">{pts.pts}</div><div className="k dim">MVP points</div><div className="k dim split">{pts.solo} solo · {pts.team} team · {pts.halves} halved</div></div>
          : <div className="tile"><div className="pnum">{c.holesWon}</div><div className="k dim">Holes won</div></div>}
        <div className="tile"><div className="pnum">{c.birdies + c.eagles}</div><div className="k dim">{c.eagles ? 'Birdies & eagles' : 'Birdies'}</div></div>
        {close
          ? <div className="tile"><div className="pnum">{ordinal(close.hole)}</div><div className="k dim">Closed out {close.opp}</div></div>
          : <div className="tile"><div className="pnum">{c.partners.length}</div><div className="k dim">Partners</div></div>}
        <div className="tile"><div className="pnum">{c.streak ? c.streak.n : '–'}</div><div className="k dim">{c.streak ? `Straight holes, ${dowOf(c.streak.s.day).slice(0, 3)}` : 'Straight holes'}</div></div>
      </div>
      {(c.best || c.partners.length > 0) && (
        <>
          <div className="phr" />
          <div className="pline left">
            {c.best && <>Best hole: <b>{c.best.what.toLowerCase()} on {c.best.hole}, {c.best.s.course}</b><br /></>}
            {c.partners.length > 0 && <>Partners: <b>{c.partners.join(', ')}</b></>}
          </div>
        </>
      )}
    </>
  );
}

/* 7 · state of the Cup */
function LiveBody({ c }: { c: LiveCard }) {
  return (
    <>
      <Top live l1={`Live · ${dowOf(c.s.day)}`} l2={c.s.course} />
      <div className="pblock tight">
        <div className="k">On the course</div>
        <div className="pnum score sm">
          <span className="ta">{half(c.pts.a)}</span><span className="dim to">to</span><span className="tb">{half(c.pts.b)}</span>
        </div>
        <div className="k dim" style={{ marginTop: 4 }}>
          Projected <span className="ta">{half(c.proj.a)}</span> to <span className="tb">{half(c.proj.b)}</span>
        </div>
      </div>
      <div className="phr" />
      {c.rows.map(({ m, r, lead, thru }) => (
        <div key={m.id} className="plive">
          <div className="m">
            <span className="ta">{names(m.a)}</span> <span className="dim">v</span> <span className="tb">{names(m.b)}</span>
            <small>{r.done ? 'Final' : thru ? `Thru ${thru}` : `Tee ${teeOf(c.s, m.g)}`}</small>
          </div>
          <div className={`st ${lead ? tc(lead) : ''}`}>
            {r.done ? r.label : !thru ? '' : lead ? `${Math.abs(r.diff)} UP` : 'AS'}
            {lead && !r.done && <small>{(m[lead].length > 1 ? CFG.teams[lead].name : first(m[lead][0])).toUpperCase()}</small>}
          </div>
        </div>
      ))}
    </>
  );
}

/* 8 · feed spike */
function SpikeBody({ c }: { c: SpikeCard }) {
  return (
    <div className="pcenter spk">
      <div className="ptop full"><Badge /><div className="k">{dowOf(c.s.day)} · {c.s.course}<br />{ordinal(c.hole)}{c.type === 'eagle' ? `, par ${c.s.par[c.hole - 1]}` : ''}</div></div>
      <div className="pnum giant tbrass">{c.num}</div>
      <h2 className="mid">{c.headline}</h2>
      <div className={`k ${tc(c.side)}`} style={{ marginTop: 14 }}>{c.who} · {CFG.teams[c.side].name}</div>
      <div className="pline" style={{ marginTop: 22 }}>{c.line}</div>
    </div>
  );
}
