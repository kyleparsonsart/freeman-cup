/**
 * thefreemancup.com: the family scoreboard. Read-only, no sign-in.
 * One public RPC, the app's own scoring engine, refetched every minute.
 *
 * Three lives, one layout: before the trip (countdown, schedule), during
 * (live match cards), after (the record). Celts always left, Vikes right.
 */
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { supabase } from '../lib/supabase';
import { calc, half, getsStroke, CFG, type Match, type Session } from '../lib/scoring';
import { mvpBoard, relLabel } from '../lib/standings';
import { shape, teeClock, teeClockAmPm, type Shaped, type Snapshot } from './shape';
import { matchMoments, clockCT } from './moments';
import { fetchHours, windowFor, spanFor, hourLabel, type WxHour } from './weather';
import { SYMBOLS } from './symbols';

const APP_URL = 'https://freeman-cup.vercel.app';
const TZ = 'America/Chicago';
const REFETCH_MS = 60_000;

const todayCT = (): string => new Intl.DateTimeFormat('en-CA', { timeZone: TZ }).format(new Date());
const nowHourCT = (): number => Number(new Intl.DateTimeFormat('en-US', { hour: 'numeric', hour12: false, timeZone: TZ }).format(new Date())) % 24;
const daysUntil = (date: string): number =>
  Math.round((new Date(date + 'T12:00:00Z').getTime() - new Date(todayCT() + 'T12:00:00Z').getTime()) / 86_400_000);
const longDate = (d: string): string =>
  new Date(d + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
const dow = (d: string): string => new Date(d + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'long' });
const ordinal = (n: number) => `${n}${['th', 'st', 'nd', 'rd'][(n % 100 > 10 && n % 100 < 14) ? 0 : n % 10] || 'th'}`;

type Side = 'a' | 'b';
const cls = (s: Side) => (s === 'a' ? 'vik' : 'cel');
const fn = (d: Shaped, k: string) => (d.players[k]?.n || k).split(' ')[0];
const names = (d: Shaped, keys: string[]) => keys.map(k => fn(d, k)).join(' & ');

/* ---------------- data ---------------- */

async function load(): Promise<Snapshot> {
  const { data, error } = await supabase.rpc('public_scoreboard');
  if (error) throw new Error(error.message);
  return data as Snapshot;
}

interface RoundView {
  s: Session;
  date: string;               // YYYY-MM-DD
  ms: Match[];
  pts: { a: number; b: number };
  state: 'final' | 'live' | 'upcoming';
  teeTime: string;            // first tee, raw
  pairingsSet: boolean;
}

function roundViews(d: Shaped): RoundView[] {
  return d.sessions.map(s => {
    const row = d.snap.rounds.find(r => r.id === s.id)!;
    const ms = d.matches.filter(m => m.s === s.id);
    const pts = { a: 0, b: 0 };
    ms.forEach(m => { const r = calc(m); pts.a += r.pts.a; pts.b += r.pts.b; });
    const state: RoundView['state'] = ms.length && ms.every(m => calc(m).done) ? 'final'
      : ms.some(m => calc(m).played > 0) ? 'live'
      : s.state === 'final' ? 'final' : 'upcoming';
    const tees = ms.map(m => d.teeTimeOf(m)).sort();
    return {
      s, date: row.play_date, ms, pts, state,
      teeTime: tees[0] || '00:00:00',
      pairingsSet: ms.length > 0 && ms.every(m => m.a.length && m.b.length),
    };
  });
}

/* ---------------- page ---------------- */

export default function Scoreboard() {
  const [snap, setSnap] = useState<Snapshot | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [wx, setWx] = useState<WxHour[] | null>(null);
  const [, tick] = useState(0);

  useEffect(() => {
    let alive = true;
    const run = () => load().then(s => { if (alive) { setSnap(s); setErr(null); } })
      .catch(e => { if (alive && !snap) setErr(e instanceof Error ? e.message : String(e)); });
    run();
    const id = setInterval(run, REFETCH_MS);
    const vis = () => { if (document.visibilityState === 'visible') run(); };
    document.addEventListener('visibilitychange', vis);
    return () => { alive = false; clearInterval(id); document.removeEventListener('visibilitychange', vis); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    fetchHours().then(setWx).catch(() => setWx([]));
    const id = setInterval(() => fetchHours().then(setWx).catch(() => {}), 30 * 60_000);
    const t = setInterval(() => tick(x => x + 1), 5 * 60_000);   // countdown / "now" hour
    return () => { clearInterval(id); clearInterval(t); };
  }, []);

  const d = useMemo(() => (snap ? shape(snap) : null), [snap]);

  if (err && !d) return <Boot title="The scoreboard is taking a breather">{err}</Boot>;
  if (!d) return <Boot title="Loading the cup">Fetching scores from the course.</Boot>;

  const rounds = roundViews(d);
  const today = todayCT();
  const first = rounds[0];
  const anyScored = d.matches.some(m => calc(m).played > 0);
  const allDone = d.matches.length > 0 && d.matches.every(m => calc(m).done);
  const phase: 'pre' | 'live' | 'final' = allDone ? 'final' : anyScored || today >= first.date ? 'live' : 'pre';

  const totals = { a: 0, b: 0 };
  d.matches.forEach(m => { const r = calc(m); totals.a += r.pts.a; totals.b += r.pts.b; });
  const clinch = Number(d.snap.event.clinch_points);
  const total = d.matches.length;

  // what "Out on the course" shows, and which round the forecast is for
  const liveRounds = rounds.filter(r => r.state === 'live');
  const todays = rounds.filter(r => r.date === today && r.state !== 'final');
  const onCourse: RoundView[] = liveRounds.length ? [...liveRounds, ...todays.filter(t => !liveRounds.includes(t))] : todays;
  const next = rounds.find(r => r.state === 'upcoming' && r.date >= today && !onCourse.includes(r)) || null;
  const wxRound = onCourse[0] || next;

  return (
    <>
      <svg width="0" height="0" style={{ position: 'absolute' }} aria-hidden="true" dangerouslySetInnerHTML={{ __html: SYMBOLS }} />
      <header className="shd">
        <div className="wrap">
          <div className="brandrow">
            <svg width="38" height="38"><use href="#logo-glyph" /></svg>
            <div>
              <div className="t1">{d.snap.event.name}</div>
              <div className="t2">{d.snap.event.venue} · {spanLabel(rounds)}</div>
            </div>
          </div>
          <div className="hdright">
            {phase === 'live' && liveRounds.length > 0 && <div className="livepill"><span className="d" />Live</div>}
            <a className="sibtn" href={APP_URL}>Player sign-in</a>
          </div>
        </div>
      </header>

      <Strip d={d} phase={phase} totals={totals} clinch={clinch} total={total} rounds={rounds} onCourse={onCourse} />
      <HowBar open={phase === 'pre'} clinch={clinch} total={total} trophy={d.snap.event.trophy} />

      <section className="sect">
        <div className="wrap">
          <h2>{phase === 'final' ? 'The final day' : onCourse.length ? 'Out on the course now' : 'Out on the course'}</h2>
          <p className="sub">
            {phase === 'final' ? 'Every card is signed. Tap any match for the scorecard.'
              : onCourse.length ? 'Scores come in from the players hole by hole.'
              : 'Nothing yet. Scores land here hole by hole once the first group tees off.'}
          </p>
          {phase !== 'final' && wxRound && <Weather round={wxRound} hours={wx} today={today} />}
          {phase === 'final'
            ? rounds[rounds.length - 1].ms.map(m => <MatchCard key={m.id} d={d} m={m} s={rounds[rounds.length - 1].s} />)
            : onCourse.length
              ? onCourse.flatMap(r => r.ms.map(m => <MatchCard key={m.id} d={d} m={m} s={r.s} teeTime={d.teeTimeOf(m)} />))
              : next && <NextCard d={d} r={next} first={next === first} />}
        </div>
      </section>

      <section className="sect">
        <div className="wrap">
          <h2>Round by round</h2>
          <p className="sub">{phase === 'pre' ? 'Tee times. Pairings post the night before each round.' : 'Tee times and results.'}</p>
          {rounds.map(r => <DayBlock key={r.s.id} d={d} r={r} open={r.state === 'live' || (r.state === 'upcoming' && r === next && !liveRounds.length)} />)}
        </div>
      </section>

      <Players d={d} phase={phase} totals={totals} />

      <footer className="sfoot">
        <svg width="14" height="28"><use href="#claretjug" /></svg>
        <p>Scores are entered on the course by the players and land here within a minute.<br />
          {d.snap.event.name} · an annual tradition · {d.snap.event.venue}, Wisconsin</p>
      </footer>
    </>
  );
}

function Boot({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="boot">
      <svg width="0" height="0" style={{ position: 'absolute' }} aria-hidden="true" dangerouslySetInnerHTML={{ __html: SYMBOLS }} />
      <svg width="22" height="44" style={{ color: 'var(--brass)', marginBottom: 12 }}><use href="#claretjug" /></svg>
      <div className="eh">{title}</div>
      <p style={{ marginTop: 6, fontSize: 14 }}>{children}</p>
    </div>
  );
}

function spanLabel(rounds: RoundView[]): string {
  const a = new Date(rounds[0].date + 'T12:00:00'), b = new Date(rounds[rounds.length - 1].date + 'T12:00:00');
  const mon = a.toLocaleDateString('en-US', { month: 'short' });
  return `${mon} ${a.getDate()} to ${b.getDate()}`;
}

/* ---------------- cup strip ---------------- */

function Strip({ d, phase, totals, clinch, total, rounds, onCourse }: {
  d: Shaped; phase: 'pre' | 'live' | 'final'; totals: { a: number; b: number };
  clinch: number; total: number; rounds: RoundView[]; onCourse: RoundView[];
}) {
  const T = total || 1;
  const pa = totals.a / T * 100, pb = totals.b / T * 100, cp = clinch / T * 100;
  const first = rounds[0];
  const days = daysUntil(first.date);
  const ev = d.snap.event;
  const winner: Side | null = totals.a >= clinch ? 'a' : totals.b >= clinch ? 'b' : null;
  const decided = phase === 'final' || !!winner;
  const lead = totals.a === totals.b ? 'All square' : `${CFG.teams[totals.a > totals.b ? 'a' : 'b'].name} lead`;
  const toClinch = Math.max(0, clinch - Math.max(totals.a, totals.b));
  const dayIdx = onCourse.length ? rounds.indexOf(onCourse[0]) + 1 : rounds.findIndex(r => r.state !== 'final') + 1;
  const dayLabel = phase === 'final' ? 'Final' : phase === 'live'
    ? `Day ${dayIdx || rounds.length} of ${rounds.length}${onCourse[0] ? ` · ${onCourse[0].s.course}` : ''}` : '';

  return (
    <div className="strip">
      {phase === 'pre' ? (
        <div className="cd">
          <div className="big">{days}</div>
          <div className="bl">{days === 1 ? 'day' : 'days'} to {ev.venue}</div>
          <div className="when">First tee {longDate(first.date)} · {teeClockAmPm(first.teeTime)}</div>
        </div>
      ) : <div className="day">{dayLabel}</div>}
      <div className="striptop">
        <div className={`sside cel${phase === 'pre' ? ' dim' : ''}`}><span className="pt">{half(totals.b)}</span><span className="nm">{CFG.teams.b.name}</span></div>
        <div className="jugwrap">
          <svg width="29" height="48" style={{ width: 29, height: 48 }}><use href="#claretjug" /></svg>
          <span className="juglbl">{decided && winner ? `${CFG.teams[winner].name} take ${ev.trophy}` : ev.trophy}</span>
        </div>
        <div className={`sside r vik${phase === 'pre' ? ' dim' : ''}`}><span className="nm">{CFG.teams.a.name}</span><span className="pt">{half(totals.a)}</span></div>
      </div>
      <div className="tug">
        <div className="f fc" style={{ width: `${pb}%` }} />
        <div className="f fv" style={{ width: `${pa}%` }} />
        {!decided && <div className="livez" style={{ left: `${pb}%`, right: `${pa}%` }} />}
        <div className="tick" style={{ left: `${cp}%` }} />
        <div className="tick" style={{ right: `${cp}%` }} />
      </div>
      <div className="striplbl">
        {phase === 'pre'
          ? <><span>{half(total)} points on the table</span><span>First to {half(clinch)} takes the cup</span></>
          : decided && winner
            ? <><span>{half(totals.a + totals.b)} of {half(total)} decided</span><span>{CFG.teams[winner].name} win, {half(totals.b)} to {half(totals.a)}</span></>
            : <><span>{half(totals.a + totals.b)} of {half(total)} decided</span><span>{lead} · {half(toClinch)} to clinch</span></>}
      </div>
      <div className="holder">
        <svg width="10" height="20"><use href="#claretjug" /></svg>
        {decided && winner
          ? <span>The <b>{CFG.teams[winner].name}</b> hold {ev.trophy} until next October.</span>
          : ev.previous_winner
            ? <span>The <b>{CFG.teams[ev.previous_winner].name}</b> hold {ev.trophy} from {ev.previous_year ?? ev.year - 1}.</span>
            : <span>Nobody has held {ev.trophy} yet. The <b>first name</b> goes on it {shortDate(rounds[rounds.length - 1].date)}.</span>}
      </div>
    </div>
  );
}

const shortDate = (d: string) => new Date(d + 'T12:00:00').toLocaleDateString('en-US', { month: 'long', day: 'numeric' });

function HowBar({ open, clinch, total, trophy }: { open: boolean; clinch: number; total: number; trophy: string }) {
  return (
    <div className="howbar">
      <input type="checkbox" className="hx" id="how" defaultChecked={open} />
      <label className="hl" htmlFor="how"><span>New here? How the cup works</span><span className="ar">▾</span></label>
      <div className="hb"><div className="wrap">
        <p><b>It's match play.</b> Nobody counts total strokes. Each hole is its own contest. Win the hole and you're 1 up. A match ends when one side leads by more holes than remain, which is what 4 &amp; 3 means.</p>
        <p><b>Every match is one point.</b> Win it, your team gets 1. All square after the last hole is halved, half a point each. First team to {half(clinch)} of the {half(total)} takes the cup.</p>
        <p><b>{trophy}</b> is the trophy, a silver claret jug that lives with the winning side for a year and gets talked about for the other eleven months.</p>
      </div></div>
    </div>
  );
}

/* ---------------- weather ---------------- */

function Weather({ round, hours, today }: { round: RoundView; hours: WxHour[] | null; today: string }) {
  const span = spanFor(round.s.holes);
  const start = Number(round.teeTime.slice(0, 2));
  const win = hours ? windowFor(hours, round.date, round.teeTime, span) : [];
  const isToday = round.date === today;
  const nowH = nowHourCT();
  const daysOut = daysUntil(round.date);
  const label = `${isToday ? 'Today' : dow(round.date)} · ${round.s.course} · ${hourLabel(start).toLowerCase()} to ${hourLabel(start + span).toLowerCase()}`;
  return (
    <div className="wxcard">
      <div className="wh"><span>{label}</span><em>{win.length ? 'Nekoosa, WI' : daysOut > 6 ? `Forecast ${shortDate(addDays(round.date, -6))}` : 'Forecast'}</em></div>
      <div className="wxrow">
        {win.length ? win.map(h => (
          <div key={h.iso} className={`wxc${isToday && h.hour === nowH ? ' now' : ''}${h.icon === 'sun' ? ' sun' : ''}`}>
            <div className="h">{hourLabel(h.hour)}</div>
            <svg width="26" height="26"><use href={`#wx-${h.icon}`} /></svg>
            <div className="tp">{h.temp}°</div>
            <div className="wd">{h.dir} {h.wind}</div>
            <div className="pp">{h.pop}%</div>
          </div>
        )) : Array.from({ length: span + 1 }, (_, i) => (
          <div key={i} className="wxc ph">
            <div className="h">{hourLabel(start + i)}</div>
            <svg width="26" height="26"><use href="#wx-cloud" /></svg>
            <div className="tp">··</div>
          </div>
        ))}
      </div>
      {!win.length && <div className="wxsum">Hourly forecast for the window of play appears seven days out. October at Sand Valley usually means high 40s at the first tee and low 60s by lunch.</div>}
    </div>
  );
}

const addDays = (d: string, n: number) => {
  const t = new Date(d + 'T12:00:00Z'); t.setUTCDate(t.getUTCDate() + n);
  return t.toISOString().slice(0, 10);
};

/* ---------------- match card ---------------- */

function MatchCard({ d, m, s, teeTime }: { d: Shaped; m: Match; s: Session; teeTime?: string }) {
  const r = calc(m);
  const started = r.played > 0;
  const leader: Side | 'h' | null = r.w;
  const face = leader === 'a' ? 'vik-lead' : leader === 'b' ? 'cel-lead' : '';
  const mid = !started ? <><div className="st tee">{teeClock(teeTime || d.teeTimeOf(m))}</div><div className="sl">Tee time</div></>
    : r.done ? <><div className={`st fin ${leader === 'h' ? 'as' : cls(leader as Side)}`}>{leader === 'h' ? 'HALVED' : r.label.toUpperCase()}</div><div className="sl">{leader === 'h' ? '½ each' : `${CFG.teams[leader as Side].name} · final`}</div></>
    : <><div className={`st ${leader === 'h' ? 'as' : cls(leader as Side)}`}>{leader === 'h' ? 'AS' : `${Math.abs(r.diff)} UP`}</div><div className="sl">{leader === 'h' ? 'All square' : CFG.teams[leader as Side].name}</div></>;
  const moments = started ? matchMoments(m, s) : [];
  const latest = moments.slice(0, 5), more = moments.slice(5);
  const meta = !started ? `Group ${String.fromCharCode(65 + m.g)}` : r.done ? `Final · ${r.played} holes` : `Teed off ${teeClock(teeTime || d.teeTimeOf(m))} · Thru ${r.played}`;
  return (
    <div className={`mc${r.done ? ' done' : ''}`}>
      <div className="top"><span className="fmt">{s.fmt === 'Aggregate' ? 'Aggregate match play' : s.fmt}</span><span className="meta">{meta}</span></div>
      <div className={`face ${face}`}>
        <div className="side cel"><div className="tm">{CFG.teams.b.name}</div><div className="p">{names(d, m.b) || 'TBA'}</div></div>
        <div className="mid">{mid}</div>
        <div className="side vik"><div className="tm">{CFG.teams.a.name}</div><div className="p">{names(d, m.a) || 'TBA'}</div></div>
      </div>
      {started && (
        <div className="act">
          <div className="ah"><span>Latest</span><span>{moments.length} moment{moments.length === 1 ? '' : 's'}</span></div>
          {latest.map(x => <Ev key={x.key} x={x} />)}
          {more.length > 0 && <>
            <input type="checkbox" className="xp" id={`x-${m.id}`} />
            <div className="more">{more.map(x => <Ev key={x.key} x={x} />)}</div>
            <label className="xl" htmlFor={`x-${m.id}`}><span className="a">Show all {moments.length} ▾</span><span className="b">Show latest 5 ▴</span></label>
          </>}
        </div>
      )}
      <input type="checkbox" className="sc-x" id={`sc-${m.id}`} />
      <label className="sc-l" htmlFor={`sc-${m.id}`}><span>Full scorecard</span><span className="ar">▾</span></label>
      <Scorecard d={d} m={m} s={s} />
    </div>
  );
}

function Ev({ x }: { x: ReturnType<typeof matchMoments>[number] }) {
  const c = x.win ? `ev win ${x.side ? cls(x.side) : ''}` : `ev${x.gold ? ' gold' : x.side ? ` ${cls(x.side)}` : ''}`;
  return <div className={c}><span className="t">{clockCT(x.at)}</span><span dangerouslySetInnerHTML={{ __html: x.html }} /></div>;
}

function Scorecard({ d, m, s }: { d: Shaped; m: Match; s: Session }) {
  const N = s.holes;
  const holes = Array.from({ length: N }, (_, i) => i);
  const r = calc(m);
  const cell = (k: string, i: number) => {
    const g = m.hs[i]?.sc[k];
    if (typeof g !== 'number') return <td key={i} className="o">·</td>;
    return <td key={i} className={getsStroke(m, k, i) ? 'net' : ''}>{g}</td>;
  };
  const sum = (keys: string[], i: number) => {
    if (s.fmt !== 'Aggregate') return null;
    const vals = keys.map(k => m.hs[i]?.sc[k]).filter((v): v is number => typeof v === 'number');
    if (vals.length < keys.length) return <td key={i} className="o">·</td>;
    return <td key={i}>{keys.reduce((t, k) => t + (m.hs[i].sc[k] as number) - getsStroke(m, k, i), 0)}</td>;
  };
  const res = (i: number) => {
    const c = i < r.played ? m.hs[i]?.r : null;
    return <td key={i} className={c === 'A' ? 'v' : c === 'B' ? 'c' : 'h'}>{c === 'A' ? CFG.teams.a.short : c === 'B' ? CFG.teams.b.short : c === 'H' ? '½' : ''}</td>;
  };
  const rows = (keys: string[], side: Side) => s.fmt === 'Foursomes'
    ? [<tr key={side}><td className={`pl ${side === 'a' ? 'v' : 'c'}`}>{CFG.teams[side].name}</td>{holes.map(i => cell(side, i))}</tr>]
    : keys.map(k => <tr key={k}><td className={`pl ${side === 'a' ? 'v' : 'c'}`}>{fn(d, k)}</td>{holes.map(i => cell(k, i))}</tr>);
  return (
    <div className="holecard">
      <table>
        <tbody>
          <tr><th className="pl hd">Hole</th>{holes.map(i => <th key={i}>{i + 1}</th>)}</tr>
          <tr className="par"><td className="pl hd">Par</td>{holes.map(i => <td key={i}>{s.par[i] ?? ''}</td>)}</tr>
          {rows(m.b, 'b')}
          {s.fmt === 'Aggregate' && <>
            <tr className="sum"><td className="pl hd">{CFG.teams.b.name} net</td>{holes.map(i => sum(m.b, i))}</tr>
            <tr className="sum"><td className="pl hd">{CFG.teams.a.name} net</td>{holes.map(i => sum(m.a, i))}</tr>
          </>}
          {rows(m.a, 'a')}
          <tr className="res"><td className="pl hd">Hole to</td>{holes.map(res)}</tr>
        </tbody>
      </table>
      <div className="holenote">
        <b>Gross scores.</b> A brass number means that player got a stroke there, so it counts one less.
        {s.fmt === 'Aggregate' ? ' The two net rows decide each hole.' : ' Lowest net on each side decides the hole.'} Swipe for more holes.
      </div>
    </div>
  );
}

/* ---------------- round by round ---------------- */

function DayBlock({ d, r, open }: { d: Shaped; r: RoundView; open: boolean }) {
  const won: Side | null = r.state === 'final' ? (r.pts.a > r.pts.b ? 'a' : r.pts.b > r.pts.a ? 'b' : null) : null;
  const fmt = r.s.fmt === 'Aggregate' ? 'Aggregate' : r.s.fmt;
  const small = `${dow(r.date)} ${shortDate(r.date).split(' ')[1] ? shortDate(r.date) : ''} · ${fmt}${r.state === 'final' ? ' · Final' : r.state === 'live' ? ' · In play' : ''}`;
  return (
    <div className={`dayblk${won ? ` ${cls(won)}-won` : ''}${r.state === 'live' ? ' live' : ''}`}>
      <input type="checkbox" className="dx" id={`d-${r.s.id}`} defaultChecked={open} />
      <label className="dh" htmlFor={`d-${r.s.id}`}>
        <span className="n">{r.s.rd} · {r.s.course}<small>{small}</small></span>
        {r.state === 'upcoming' && !r.pairingsSet
          ? <span className="fs tba">Pairings<br />{dow(addDays(r.date, -1)).slice(0, 3)} night</span>
          : r.state === 'upcoming'
            ? <span className="fs tba">First tee<br />{teeClockAmPm(r.teeTime)}</span>
            : <span className="fs"><b className="c">{half(r.pts.b)}</b><i>to</i><b className="v">{half(r.pts.a)}</b></span>}
        <span className="ar">▾</span>
      </label>
      <div className="dbody">
        <div className="tee">
          {r.ms.map((m, i) => {
            const c = calc(m);
            const t = d.teeTimeOf(m);
            const st = c.done
              ? (c.w === 'h' ? <span className="sc hv">Halved</span> : <span className={`sc ${c.w === 'a' ? 'v' : 'c'}`}>{CFG.teams[c.w as Side].name} {c.label}</span>)
              : c.played > 0
                ? <span className="sc lv">{c.w === 'h' ? 'All square' : `${CFG.teams[c.w as Side].name} ${Math.abs(c.diff)} up`} · {c.played}</span>
                : <span className="sc tb">Match {i + 1}</span>;
            return (
              <div key={m.id} className={`r${m.a.length && m.b.length ? '' : ' ph'}`}>
                <span className="tt">{teeClock(t)}</span>
                <span className="who"><span className="c">{names(d, m.b) || CFG.teams.b.name}</span><i>vs</i><span className="v">{names(d, m.a) || CFG.teams.a.name}</span></span>
                {st}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

/* ---------------- players ---------------- */

function Players({ d, phase, totals }: { d: Shaped; phase: 'pre' | 'live' | 'final'; totals: { a: number; b: number } }) {
  const pre = phase === 'pre';
  const board = mvpBoard(d.sessions, d.matches);
  const leaderRel = board.find(b => b.eligible)?.rel;
  const rec: Record<string, { w: number; l: number; h: number; pts: number }> = {};
  d.matches.forEach(m => {
    const r = calc(m);
    if (!r.done) return;
    (['a', 'b'] as Side[]).forEach(side => m[side].forEach(k => {
      const e = (rec[k] = rec[k] || { w: 0, l: 0, h: 0, pts: 0 });
      if (r.w === 'h') { e.h++; e.pts += 0.5; } else if (r.w === side) { e.w++; e.pts++; } else e.l++;
    }));
  });
  const roster = (side: Side) => Object.entries(d.players).filter(([, p]) => p.t === side)
    .sort(([ka, pa], [kb, pb]) => Number(pb.cap || 0) - Number(pa.cap || 0) || (rec[kb]?.pts || 0) - (rec[ka]?.pts || 0) || pa.n.localeCompare(pb.n))
    .map(([k, p]) => {
      const e = rec[k] || { w: 0, l: 0, h: 0, pts: 0 };
      const b = board.find(x => x.key === k);
      const lead = !pre && b?.eligible && leaderRel !== undefined && b.rel === leaderRel && board.length > 0;
      return (
        <li key={k} className={lead ? 'lead' : ''}>
          <span className="nm">{fn(d, k)}{p.cap && <i>Captain</i>}</span>
          {pre ? <><span /><span /><span /></> : <>
            <span className="rec">{e.w}–{e.l}–{e.h}</span>
            <span className="pts">{half(e.pts)}</span>
            <span className="net">{b ? relLabel(b.rel) : ''}</span>
          </>}
        </li>
      );
    });
  return (
    <section className="sect">
      <div className="wrap">
        <h2>{pre ? 'The teams' : 'The players'}</h2>
        <p className="sub">{pre ? 'Four a side. Records and the MVP race appear once play starts.' : 'Record, points won, and net against par across the week. Brass marks the MVP race leader.'}</p>
        <div className="teams">
          <div className="team cel">
            <div className="th"><span>The {CFG.teams.b.name}</span><span className="tp">{pre ? '4 players' : `${half(totals.b)} pt${totals.b === 1 ? '' : 's'}`}</span></div>
            <ul>{roster('b')}</ul>
          </div>
          <div className="team vik">
            <div className="th"><span>The {CFG.teams.a.name}</span><span className="tp">{pre ? '4 players' : `${half(totals.a)} pt${totals.a === 1 ? '' : 's'}`}</span></div>
            <ul>{roster('a')}</ul>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ---------------- next round card ---------------- */

function NextCard({ d, r, first }: { d: Shaped; r: RoundView; first: boolean }) {
  const n = r.ms.length;
  const fmt = r.s.fmt === 'Aggregate' ? 'aggregate' : r.s.fmt.toLowerCase();
  return (
    <div className="emp">
      <svg width="22" height="44"><use href="#claretjug" /></svg>
      <div className="eh">{first ? 'First tee is' : 'Next up:'} {longDate(r.date)}</div>
      <p>{n} {fmt} match{n === 1 ? '' : 'es'} go off from {teeClockAmPm(r.teeTime)} at {r.s.course}{d.snap.event.venue !== r.s.course ? '' : ''}.
        {first ? ' Check back that morning and this space fills in with every match, hole by hole.' : ` Round ${ordinal(d.sessions.indexOf(r.s) + 1)} of ${d.sessions.length}.`}</p>
    </div>
  );
}
