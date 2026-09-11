/**
 * The Captains Shootout as the Scoreboard tab: once the Cup is level after
 * the last card, the two captains putt three stations on the practice
 * green and this is where the strokes go in. The commissioner taps the
 * tiles; everyone else sees the same board read-only. Nothing is saved
 * until the last putt drops: Save writes the whole thing (set_shootout),
 * which decides the Cup on every phone and fires the finale. Level after
 * three stations and the Knee Knocker replays as extra rows.
 */
import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { CFG } from '../lib/scoring';
import { TIEBREAK, stationLabel, type MomentsState } from '../lib/moments';
import type { EventData } from '../hooks/useEventData';

type Draft = { a: (number | null)[]; b: (number | null)[] };
const blank = (n: number) => Array.from({ length: n }, () => null as number | null);
const fromSaved = (sh: { a: number[]; b: number[] } | null | undefined): Draft =>
  sh && sh.a.length >= 3 ? { a: [...sh.a], b: [...sh.b] } : { a: blank(3), b: blank(3) };

export default function ShootoutBoard({ data, moments, reload }: { data: EventData; moments: MomentsState; reload: () => void }) {
  const saved = data.event.shootout ?? null;
  const [s, setS] = useState<Draft>(() => fromSaved(saved));
  useEffect(() => { setS(fromSaved(saved)); }, [saved]);
  const [ask, setAsk] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const edit = data.meIsCommissioner && !saved;
  const cap = moments.captains;
  const n = s.a.length;
  const tot = (side: 'a' | 'b') => s[side].reduce<number>((t, v) => t + (v || 0), 0);
  const complete = s.a.every(v => v !== null) && s.b.every(v => v !== null);
  const level = complete && tot('a') === tot('b');
  const decided = complete && !level;
  const winner: 'a' | 'b' | null = decided ? (tot('a') < tot('b') ? 'a' : 'b') : null;
  const set = (side: 'a' | 'b', i: number, v: number) => {
    if (!edit) return;
    setS(x => { const y = { a: [...x.a], b: [...x.b] }; y[side][i] = y[side][i] === v ? null : v; return y; });
  };
  const replay = () => setS(x => ({ a: [...x.a, null], b: [...x.b, null] }));
  const save = async () => {
    setBusy(true); setErr(null);
    const { error } = await supabase.rpc('set_shootout', { s: { a: s.a, b: s.b, done: true } });
    setBusy(false); setAsk(false);
    if (error) { setErr(error.message); return; }
    reload();
  };
  const clear = async () => {
    setBusy(true); setErr(null);
    const { error } = await supabase.rpc('set_shootout', { s: null });
    setBusy(false);
    if (error) { setErr(error.message); return; }
    reload();
  };
  const last = data.scoringSessions[data.scoringSessions.length - 1];

  return (
    <div className="shboard">
      <div className="shtop">
        <div className="shk">{saved ? 'Decided on the practice green' : `The Cup is ${moments.tie ? `${moments.tie.b} to ${moments.tie.a}` : 'level'}`}</div>
        <div className="shtitle">{saved ? `${cap[winner!]} took it` : 'Putt for it'}</div>
        <div className="shsub">Three stations, every putt holed out, no gimmes, {TIEBREAK.maxStrokes} strokes max. Fewest strokes takes {CFG.trophy}. Level after three and the Knee Knocker replays until it isn’t.{last ? ` The ${TIEBREAK.where} by the 18th at ${last.course}.` : ''}</div>
      </div>

      <div className="shtot">
        <div className="side b"><div className="nm">{cap.b}</div><div className="tm">{CFG.teams.b.name}</div><div className="n">{tot('b')}</div></div>
        <div className="mid">{decided ? <span className="win">{cap[winner!]} {saved ? 'won' : 'wins'}</span> : level ? <span className="lv">Level</span> : <span>strokes</span>}</div>
        <div className="side a"><div className="nm">{cap.a}</div><div className="tm">{CFG.teams.a.name}</div><div className="n">{tot('a')}</div></div>
      </div>

      {Array.from({ length: n }, (_, i) => {
        const st = stationLabel(i);
        return (
          <div key={i} className={`shst${s.a[i] !== null && s.b[i] !== null ? ' in' : ''}`}>
            <div className="shhd"><span className="num">{i + 1}</span><span className="nm">{st.n}</span><span className="d">{st.d} ft · {st.hint}</span></div>
            {(['b', 'a'] as const).map(side => (
              <div key={side} className="brow">
                <div className="btop"><span className={`bn ${side}`}>{cap[side]}<span className="hcp">{CFG.teams[side].name}</span></span></div>
                <div className="tgs-wrap"><div className="tgs shtiles">
                  {Array.from({ length: TIEBREAK.maxStrokes }, (_, k) => k + 1).map(v => (
                    <button key={v} className={`tg${s[side][i] === v ? ' sel' : ''}${edit ? '' : ' ro'}`} disabled={!edit} onClick={() => set(side, i, v)}>
                      <span className="mk">{v}</span>
                      <span className="cap">{v === 1 ? 'Holed' : v === TIEBREAK.maxStrokes ? 'Max' : ''}</span>
                    </button>
                  ))}
                </div></div>
              </div>
            ))}
          </div>
        );
      })}

      {err && <div className="holine err">{err}</div>}
      {edit && level && (
        <button className="abtn shbtn soft" onClick={replay}>Level at {tot('a')}. Replay the Knee Knocker ›</button>
      )}
      {edit && decided && !ask && (
        <button className="abtn shbtn" onClick={() => setAsk(true)}>Save: {cap[winner!]} takes {CFG.trophy}, {Math.min(tot('a'), tot('b'))} to {Math.max(tot('a'), tot('b'))}</button>
      )}
      {edit && decided && ask && (
        <div className="shask">
          <div className="hint">Decide the Cup? This goes to every phone and the finale follows.</div>
          <div className="row">
            <button className="abtn" disabled={busy} onClick={save}>{busy ? 'Saving…' : 'Yes, decide it'}</button>
            <button className="aghost" disabled={busy} onClick={() => setAsk(false)}>Not yet</button>
          </div>
        </div>
      )}
      {edit && !complete && <div className="shnote">Tap the strokes as each captain finishes a station. Nothing is saved until the last putt drops.</div>}
      {!data.meIsCommissioner && !saved && <div className="shnote">{data.playerById[data.players.find(p => p.is_commissioner)?.id || '']?.name.split(' ')[0] || 'The commissioner'} enters the strokes as they drop.</div>}
      {saved && data.meIsCommissioner && (
        <div className="shnote">On the books. <button className="takepen" disabled={busy} onClick={clear}>Clear and re-enter</button></div>
      )}
    </div>
  );
}
