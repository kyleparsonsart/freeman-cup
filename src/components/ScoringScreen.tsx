import { useState, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import {
  calc, derive, settle, holeComplete, getsStroke, runningAt, headline,
  holeKeys, missingIn, totals, half, initials, setContext,
  CFG, P,
  type Match,
} from '../lib/scoring';
import type { EventData } from '../hooks/useEventData';

const ME = 'kyle'; // hard-coded as Kyle P.

const NOTE = [
  { o: -2, sh: 'u2', cap: 'Eagle' },
  { o: -1, sh: 'u1', cap: 'Birdie' },
  { o: 0,  sh: '',   cap: 'Par' },
  { o: 1,  sh: 'o1', cap: 'Bogey' },
  { o: 2,  sh: 'o2', cap: 'Double' },
  { o: 3,  sh: 'o3', cap: 'Triple' },
];

function curHole(m: Match, holes: number, pinned: Record<string, number>): number {
  if (pinned[m.id] !== undefined) return pinned[m.id];
  for (let i = 0; i < holes; i++) if (!m.hs[i].r) return i;
  return holes - 1;
}

interface Props {
  data: EventData;
  reload: () => void;
}

export default function ScoringScreen({ data, reload }: Props) {
  const { scoringSessions, scoringMatches } = data;

  // Always refresh the scoring context
  setContext(data.playerMap, scoringSessions, scoringMatches);
  // Update module-level ref so CupStrip can access it
  _scoringMatches = scoringMatches;

  // Find the current round (earliest not finished)
  const todayRound = scoringSessions.find(s => {
    const ms = scoringMatches.filter(m => m.s === s.id);
    if (ms.length && ms.every(m => calc(m).done)) return false;
    if (ms.some(m => calc(m).played > 0)) return true;
    return s.state !== 'final';
  }) || scoringSessions[scoringSessions.length - 1];

  const roundMatches = scoringMatches.filter(m => m.s === todayRound?.id);
  const [heroId, setHeroId] = useState<string | null>(null);
  const [pinned, setPinned] = useState<Record<string, number>>({});

  const hero = roundMatches.find(m => m.id === heroId)
    || roundMatches.find(m => m.a.includes(ME) || m.b.includes(ME))
    || roundMatches[0];

  if (!todayRound || !hero) {
    return <div className="flex-1 flex items-center justify-center text-moss p-8">
      <div className="text-center">
        <div className="font-display text-lg font-semibold text-bone mb-2">Cup complete</div>
        <div>Nothing left to play.</div>
      </div>
    </div>;
  }

  return (
    <div className="flex flex-col flex-1 min-h-0">
      <CupStrip />
      {roundMatches.length > 1 && (
        <GroupTabs
          matches={roundMatches}
          heroId={hero.id}
          onSelect={setHeroId}
        />
      )}
      <HeroCard
        match={hero}
        session={todayRound}
        data={data}
        pinned={pinned}
        setPinned={setPinned}
        reload={reload}
      />
    </div>
  );
}

function CupStrip() {
  const { a, b } = totals();
  const T = _scoringMatches.length;
  const C = Math.floor(T / 2) + 0.5;
  const pa = a / T * 100, pb = b / T * 100, cp = C / T * 100;
  const lead = a === b ? 'All square' : `${a > b ? CFG.teams.a.name : CFG.teams.b.name} lead`;

  return (
    <div className="px-[18px] py-[20px] pb-[18px] border-b border-line bg-ink-2">
      <div className="flex items-center justify-between gap-2.5 mb-2.5">
        <div className="flex items-baseline gap-2 flex-1 min-w-0">
          <span className="font-num text-[45px] font-semibold leading-none tabular-nums text-red">{half(a)}</span>
          <span className="text-[11.5px] tracking-wide text-moss whitespace-nowrap overflow-hidden text-ellipsis">{CFG.teams.a.name}</span>
        </div>
        <div className="flex flex-col items-center gap-1.5 flex-none px-1">
          <TrophySvg />
          <span className="font-display text-[13px] font-semibold text-brass whitespace-nowrap">{CFG.trophy}</span>
        </div>
        <div className="flex items-baseline gap-2 flex-1 min-w-0 justify-end">
          <span className="text-[11.5px] tracking-wide text-moss whitespace-nowrap overflow-hidden text-ellipsis">{CFG.teams.b.name}</span>
          <span className="font-num text-[45px] font-semibold leading-none tabular-nums text-blue">{half(b)}</span>
        </div>
      </div>
      <div className="relative h-[26px] bg-ink-3 border border-line overflow-hidden">
        <div className="absolute top-0 bottom-0 left-0 bg-red transition-all duration-500" style={{ width: `${pa}%` }} />
        <div className="absolute top-0 bottom-0 right-0 bg-blue transition-all duration-500" style={{ width: `${pb}%` }} />
        <div
          className="absolute top-0 bottom-0 transition-all duration-500"
          style={{
            left: `${pa}%`, right: `${pb}%`,
            background: 'repeating-linear-gradient(135deg, rgba(240,235,220,.10) 0 5px, transparent 5px 10px)',
          }}
        />
        <div className="absolute top-[-1px] bottom-[-1px] w-[2px] bg-brass z-[3]" style={{ left: `${cp}%` }} />
        <div className="absolute top-[-1px] bottom-[-1px] w-[2px] bg-brass z-[3]" style={{ right: `${cp}%` }} />
      </div>
      <div className="flex justify-between mt-[7px] text-[11.5px] text-moss-dim tracking-tight">
        <span>{half(a + b)} of {T} decided</span>
        <span>{lead} · {half(C - Math.max(a, b))} to clinch</span>
      </div>
    </div>
  );
}

// module-level reference updated by the component on each render
let _scoringMatches: Match[] = [];

function TrophySvg() {
  return (
    <svg className="w-[34px] h-auto text-brass" viewBox="0 0 56 100" aria-hidden="true">
      <g fill="currentColor">
        <circle cx="27" cy="4" r="3.2"/><rect x="25.4" y="6.5" width="3.2" height="3.5"/>
        <path d="M15 17.5c0-7.5 24-7.5 24 0v1.5H15z"/><path d="M15.5 20.5h23l1.5 5.5H14z"/>
        <path d="M20.5 26h13v6.5h-13z"/>
        <path d="M33.5 32.5c8.5 4.5 12.5 12.5 12.5 21.5 0 12-8 20.5-19 20.5S8 65.5 8 53.5c0-9 4-17 12.5-21.5z"/>
        <rect x="22.5" y="74" width="9" height="8.5"/><path d="M14 89c0-6.5 4.5-8.5 13-8.5s13 2 13 8.5z"/>
        <rect x="7" y="89" width="40" height="5"/><rect x="3" y="94" width="48" height="6"/>
      </g>
      <path d="M37 37.5c8 1.5 12 7.5 12 14s-5.5 10.5-10.5 10.5" fill="none" stroke="currentColor" strokeWidth="4.5" strokeLinecap="round"/>
      <path d="M15.5 18c-4.5-1-8-3.5-9.5-7.5" fill="none" stroke="currentColor" strokeWidth="3.2" strokeLinecap="round"/>
    </svg>
  );
}

interface GroupTabsProps {
  matches: Match[];
  heroId: string;
  onSelect: (id: string) => void;
}

function GroupTabs({ matches, heroId, onSelect }: GroupTabsProps) {
  return (
    <div className="flex gap-[5px] px-[14px] relative z-[2]" role="tablist">
      {matches.map(m => {
        const mine = m.a.includes(ME) || m.b.includes(ME);
        const letter = String.fromCharCode(65 + m.g);
        const rr = calc(m);
        const st2 = !rr.played ? '\u2014'
          : rr.done ? (rr.w === 'h' ? 'Halved' : rr.label)
          : (rr.diff === 0 ? 'Even' : `${Math.abs(rr.diff)} up`);
        const selected = m.id === heroId;
        const colCls = rr.w === 'a' ? 'text-red' : rr.w === 'b' ? 'text-blue' : '';

        return (
          <button
            key={m.id}
            className={`flex-1 min-w-0 grid gap-2 justify-items-center px-2 py-3 pb-[13px]
              border border-line rounded-t-[10px] text-left whitespace-nowrap transition-all
              ${selected
                ? 'bg-ink-2 opacity-100 border-b-line'
                : 'bg-[rgba(23,43,36,.55)] opacity-80 backdrop-blur-[9px]'}`}
            role="tab"
            aria-selected={selected}
            onClick={() => onSelect(m.id)}
          >
            <span className="text-[13px] tracking-wide text-moss">
              Group {letter}{mine ? <span className="text-brass"> (you)</span> : ''}
            </span>
            <span className="flex items-center gap-1.5 max-w-full">
              <span className="flex flex-none">
                {m.a.map((p, i) => (
                  <i key={p} className={`relative w-6 h-6 rounded-full grid place-items-center font-body font-semibold text-[9.5px] tracking-wide not-italic text-white border-[1.5px] border-board bg-red ${i > 0 ? '-ml-2' : ''}`} style={{ zIndex: 2 - i }}>
                    {initials(p)}
                  </i>
                ))}
              </span>
              <span className={`font-num text-[20px] font-semibold leading-none px-0.5 ${colCls}`}>{st2}</span>
              <span className="flex flex-none">
                {m.b.map((p, i) => (
                  <i key={p} className={`relative w-6 h-6 rounded-full grid place-items-center font-body font-semibold text-[9.5px] tracking-wide not-italic text-white border-[1.5px] border-board bg-blue ${i > 0 ? '-ml-2' : ''}`} style={{ zIndex: 2 - i }}>
                    {initials(p)}
                  </i>
                ))}
              </span>
            </span>
          </button>
        );
      })}
    </div>
  );
}

interface HeroCardProps {
  match: Match;
  session: EventData['scoringSessions'][0];
  data: EventData;
  pinned: Record<string, number>;
  setPinned: (fn: (p: Record<string, number>) => Record<string, number>) => void;
  reload: () => void;
}

function HeroCard({ match: m, session: s, data, pinned, setPinned, reload }: HeroCardProps) {
  const r = calc(m);
  const [saving, setSaving] = useState(false);

  const i = Math.min(curHole(m, s.holes, pinned), s.holes - 1);
  const h = m.hs[i];
  const bye = r.done && i >= r.byeStart;
  const keys = s.fmt === 'Foursomes' ? ['a', 'b'] : [...m.a, ...m.b];
  const dv = derive(m, i);

  // Find the scorer for this group
  const scorerKey = s.scorer[m.g];
  const iAmScorer = scorerKey === ME;
  // Commissioner can score any group
  const isCommissioner = data.players.some(p => p.name === 'Kyle P.' && p.is_commissioner);
  const viewOnly = !iAmScorer && !isCommissioner;

  // Find the match's tee_group_id and match_id from the DB
  const dbMatch = data.matches.find(dm => dm.id === m.id);

  const postScore = useCallback(async (
    holeNum: number,
    scores: Record<string, number | string>,
    result: 'A' | 'B' | 'H' | null,
    derived: boolean,
  ) => {
    if (!dbMatch) return;
    setSaving(true);

    // Find entered_by player id
    const mePlayer = data.players.find(p => p.name === 'Kyle P.');

    const row = {
      match_id: dbMatch.id,
      hole: holeNum + 1,
      scores,
      result,
      derived,
      entered_by: mePlayer?.id || null,
    };

    const { error } = await supabase
      .from('match_hole')
      .upsert(row, { onConflict: 'match_id,hole' });

    if (error) {
      console.error('Failed to save score:', error);
    }

    setSaving(false);
    reload();
  }, [dbMatch, data.players, reload]);

  const handleScoreSet = useCallback(async (k: string, value: number | 'X') => {
    if (viewOnly) return;
    // Toggle: tapping same score clears it
    const current = h.sc[k];
    const newVal = current === value ? undefined : value;

    // Build new scores object with player IDs (not keys)
    const newScores: Record<string, number | string> = {};
    for (const key of keys) {
      const playerId = findPlayerId(key, data);
      const scoreKey = s.fmt === 'Foursomes' ? key : playerId;
      if (key === k) {
        if (newVal !== undefined) newScores[scoreKey] = newVal === 'X' ? 'X' : newVal;
      } else {
        const existing = h.sc[key];
        if (existing !== undefined && existing !== null) {
          newScores[scoreKey] = existing;
        }
      }
    }

    // Update local state and derive result
    h.sc[k] = newVal;
    settle(m, i);

    await postScore(i, newScores, h.r, h.d);
  }, [h, i, keys, m, s.fmt, data, postScore, viewOnly]);

  const handleOverride = useCallback(async (w: 'A' | 'B' | 'H') => {
    if (viewOnly) return;
    const newR = (h.r === w && !h.d) ? null : w;
    h.r = newR;
    h.d = false;

    const newScores: Record<string, number | string> = {};
    for (const key of keys) {
      const playerId = findPlayerId(key, data);
      const scoreKey = s.fmt === 'Foursomes' ? key : playerId;
      const existing = h.sc[key];
      if (existing !== undefined && existing !== null) {
        newScores[scoreKey] = existing;
      }
    }

    await postScore(i, newScores, newR, false);
  }, [h, i, keys, m, s.fmt, data, postScore, viewOnly]);

  const nav = (dir: number) => {
    setPinned(prev => ({
      ...prev,
      [m.id]: Math.max(0, Math.min(s.holes - 1, i + dir)),
    }));
  };

  const A = CFG.teams.a.short;
  const B = CFG.teams.b.short;

  return (
    <div className="flex-1 bg-ink-2 border-t border-line flex flex-col overflow-y-auto">
      {/* Hole navigator */}
      <div className="flex items-stretch border-t-2 border-line border-b border-b-line">
        <button
          className="w-16 flex-none text-2xl text-moss border-r border-line min-h-[60px] grid place-items-center disabled:text-ink-3 disabled:cursor-default"
          onClick={() => nav(-1)}
          disabled={i === 0}
        >‹</button>
        <div className="flex-1 flex flex-col items-center justify-center gap-[3px] py-2 px-1">
          <span className="font-num text-2xl font-semibold leading-none">Hole {i + 1}</span>
          <span className="text-[13px] text-moss-dim tracking-wide">
            Par {s.par[i]}{s.si ? ` · SI ${s.si[i]}` : ' · scratch'}
            {saving ? ' · saving…' : ''}
          </span>
        </div>
        <button
          className="w-16 flex-none text-2xl text-moss border-l border-line min-h-[60px] grid place-items-center disabled:text-ink-3 disabled:cursor-default"
          onClick={() => nav(1)}
          disabled={i >= s.holes - 1}
        >›</button>
      </div>

      {/* Override strip */}
      {!bye && (
        <div className="flex border-b border-line">
          {(['A', 'H', 'B'] as const).map(w => (
            <button
              key={w}
              className={`flex-1 min-h-[44px] font-num text-base font-semibold text-moss-dim border-r border-line last:border-r-0
                ${h.r === w ? (w === 'A' ? 'bg-red text-white' : w === 'B' ? 'bg-blue text-white' : 'bg-moss text-ink') : ''}
                ${viewOnly ? 'pointer-events-none' : ''}`}
              onClick={() => handleOverride(w)}
            >
              {w === 'A' ? A : w === 'H' ? 'Halved' : B}
            </button>
          ))}
        </div>
      )}

      {/* Stroke legend */}
      <StrokeLegend match={m} holeIdx={i} session={s} />

      {/* Bye hole bar */}
      {bye && (
        <div className="px-[14px] py-2.5 border-b border-line bg-ink-3 text-[13px] tracking-wide text-brass">
          Bye hole · match closed on {r.byeStart} · recorded but does not count
        </div>
      )}

      {/* Player rows with notation cells */}
      <div>
        {keys.map(k => {
          const side = s.fmt === 'Foursomes' ? k : P[k]?.t || 'a';
          const pnm = s.fmt === 'Foursomes' ? CFG.teams[k].name : (P[k]?.n || k);
          const hcp = s.fmt === 'Foursomes' ? null : P[k]?.h;
          const g = h.sc[k];
          const st = getsStroke(m, k, i);
          const isX = g === 'X';
          const net = (!isX && g !== undefined && g !== null && st) ? `−1 = ${(g as number) - st}` : '';

          return (
            <div key={k} className="py-[14px] first:pt-0">
              {/* Player header */}
              <div className="flex items-center gap-2.5 mx-[14px] mb-2.5">
                <span className={`flex-1 text-xl font-semibold tracking-tight whitespace-nowrap overflow-hidden text-ellipsis ${side === 'a' ? 'text-red' : 'text-blue'}`}>
                  {pnm}
                  {hcp != null && <span className="font-num font-medium text-base text-moss-dim ml-1.5 tabular-nums">({hcp})</span>}
                  {st ? <span className="inline-block w-1.5 h-1.5 rounded-full bg-brass ml-1.5 align-[2px]" /> : null}
                </span>
                <span className="font-num text-[15px] text-brass flex-none tabular-nums">{net}</span>
                <button
                  className={`inline-flex items-center gap-1.5 flex-none py-1.5 px-2.5 rounded-[20px] border font-body font-semibold text-xs tracking-tight leading-none transition-all
                    ${isX ? 'bg-moss-dim border-moss-dim text-ink' : 'border-line text-moss-dim'}
                    ${viewOnly ? 'pointer-events-none' : ''}`}
                  onClick={() => handleScoreSet(k, 'X')}
                >
                  <svg className="w-[11px] h-[11px]" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round">
                    <path d="M4 4l12 12M16 4L4 16"/>
                  </svg>
                  Picked up
                </button>
              </div>

              {/* Six-cell notation row */}
              <div className="grid grid-cols-6 w-full border-t border-b border-line">
                {NOTE.map(t => {
                  const val = s.par[i] + t.o;
                  const on = g === val && !isX;
                  const adj = !!st && !isX && g !== undefined && g !== null && val === (g as number) - 1;

                  if (val < 1) {
                    return (
                      <button key={t.o} className="h-[74px] grid place-items-center bg-ink-2 border-r border-line last:border-r-0 opacity-30" disabled>
                        <span className="font-num text-2xl font-semibold text-moss" />
                      </button>
                    );
                  }

                  return (
                    <button
                      key={t.o}
                      className={`h-[74px] grid place-items-center content-center gap-2 border-r border-line last:border-r-0 transition-colors
                        ${on ? 'bg-ink-3 outline outline-2 outline-white -outline-offset-[3px]' : 'bg-ink-2'}
                        ${adj ? 'shadow-[inset_0_-3px_0_var(--color-brass)]' : ''}
                        ${viewOnly ? 'pointer-events-none' : ''}`}
                      onClick={() => handleScoreSet(k, val)}
                    >
                      <span className={`w-9 h-9 grid place-items-center font-num text-2xl font-semibold leading-none tabular-nums
                        ${on ? 'text-white' : adj ? 'text-brass' : 'text-moss'}
                        ${on && t.sh === 'u1' ? 'border-[1.75px] border-white rounded-full' : ''}
                        ${on && t.sh === 'u2' ? 'border-[1.75px] border-white rounded-full shadow-[0_0_0_2px_var(--color-ink-3),0_0_0_3.5px_white]' : ''}
                        ${on && t.sh === 'o1' ? 'border-[1.75px] border-white' : ''}
                        ${on && t.sh === 'o2' ? 'border-[1.75px] border-white shadow-[0_0_0_2px_var(--color-ink-3),0_0_0_3.5px_white]' : ''}
                        ${on && t.sh === 'o3' ? 'border-[1.75px] border-white shadow-[0_0_0_2px_var(--color-ink-3),0_0_0_3.5px_white,0_0_0_5px_var(--color-ink-3),0_0_0_6.5px_white]' : ''}`}>
                        {val}
                      </span>
                      <span className={`font-body font-semibold text-[11px] tracking-wide leading-none
                        ${on ? 'text-white' : adj ? 'text-brass' : 'text-moss opacity-[.78]'}`}>
                        {t.cap}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      {/* Derived result line */}
      {h.d && !bye && !holeComplete(m, i) && (
        <div className="px-[14px] py-3 text-[15px] text-moss leading-relaxed border-b border-line">
          <span className="text-moss-dim font-semibold mr-1.5">Hole not complete.</span>
          Waiting on {missingIn(m, i).map(k =>
            s.fmt === 'Foursomes' ? CFG.teams[k].name : (P[k]?.n.split(' ')[0] || k)
          ).join(', ')}.
        </div>
      )}
      {h.d && holeComplete(m, i) && dv.why && (
        <div className="px-[14px] py-3 text-[15px] text-moss leading-relaxed border-b border-line">
          <span className="block text-[11.5px] tracking-wide text-moss-dim mb-1">
            {bye ? 'Bye hole, not counted' : 'Decided by the app'}
          </span>
          <span dangerouslySetInnerHTML={{ __html: dv.why.replace(/<b>/g, '<strong class="text-bone font-semibold">').replace(/<\/b>/g, '</strong>') }} />
        </div>
      )}
      {!h.d && h.r && (
        <div className="px-[14px] py-3 text-[15px] text-moss leading-relaxed border-b border-line">
          <span className="block text-[11.5px] tracking-wide text-moss-dim mb-1">
            {bye ? 'Bye hole, not counted' : 'Tapped, not computed'}
          </span>
          Set by hand{h.by ? ` by ${h.by}` : ''}.
        </div>
      )}

      {/* Hole footer */}
      <div className="flex justify-between items-center gap-2.5 px-[14px] py-[11px] text-[13px] text-moss-dim tracking-[.04em]">
        <span>
          {bye
            ? `Match final · ${headline(m).txt}`
            : (h.r ? `${runningAt(m, i)} after ${i + 1}${h.by ? ' · ' + h.by : ''}` : 'Not posted')}
        </span>
        {h.r && i < s.holes - 1 && (
          <button className="text-brass underline underline-offset-2 text-xs tracking-wide py-1" onClick={() => nav(1)}>
            Next hole ›
          </button>
        )}
      </div>

      {/* Scorer banner */}
      <div className="flex items-center gap-2.5 px-[14px] py-2.5 bg-board border-t border-line mt-auto">
        <span className="flex-1 min-w-0 text-sm text-moss whitespace-nowrap overflow-hidden text-ellipsis inline-flex items-center gap-1.5">
          <svg className="w-3 h-3 flex-none text-brass" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4z"/>
          </svg>
          <strong className="text-bone font-semibold">{P[scorerKey]?.n || 'Unknown'}</strong> is scoring this group
        </span>
      </div>
    </div>
  );
}

function StrokeLegend({ match: m, holeIdx: i, session: s }: { match: Match; holeIdx: number; session: EventData['scoringSessions'][0] }) {
  if (!s.si || !CFG.hcp.on) return null;
  const keys = holeKeys(m).filter(k => getsStroke(m, k, i));
  if (!keys.length) return null;

  const label = (k: string) => s.fmt === 'Foursomes' ? CFG.teams[k].name : (P[k]?.n || k);
  const who = keys.length === 1
    ? label(keys[0])
    : keys.slice(0, -1).map(label).join(', ') + ' and ' + label(keys[keys.length - 1]);
  const verb = (keys.length === 1 && s.fmt !== 'Foursomes') ? 'gets' : 'get';

  return (
    <div className="px-[14px] py-[11px] border-b border-line bg-brass text-[#12241D] text-sm tracking-wide leading-relaxed">
      <span className="inline-block w-1.5 h-1.5 rounded-full bg-[#12241D] mr-2 align-[1px] opacity-55" />
      <strong className="font-semibold text-[#0B1A14]">{who}</strong> {verb} a shot on this hole.
      The gold underline marks the score it plays as.
    </div>
  );
}

function findPlayerId(key: string, data: EventData): string {
  // 'a' and 'b' are side keys for foursomes
  if (key === 'a' || key === 'b') return key;
  const player = data.players.find(p => p.name.split(' ')[0].toLowerCase() === key);
  return player?.id || key;
}
