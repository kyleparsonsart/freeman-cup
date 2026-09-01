import { useState, useCallback, useEffect, useLayoutEffect, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { enqueueHoleWrite, getQueuedWrites, onQueueChange } from '../lib/writeQueue';
import {
  calc, derive, settle, holeComplete, getsStroke, runningAt, headline,
  holeKeys, missingIn, initials, setContext,
  CFG, P,
  type Match,
} from '../lib/scoring';
import type { EventData } from '../hooks/useEventData';

const NOTE = [
  { o: -2, sh: 'u2', cap: 'Eagle' },
  { o: -1, sh: 'u1', cap: 'Birdie' },
  { o: 0,  sh: '',   cap: 'Par' },
  { o: 1,  sh: 'o1', cap: 'Bogey' },
  { o: 2,  sh: 'o2', cap: 'Double' },
  { o: 3,  sh: 'o3', cap: 'Triple' },
  { o: 4,  sh: '',   cap: '\u2013' },
  { o: 5,  sh: '',   cap: '\u2013' },
  { o: 6,  sh: '',   cap: '\u2013' },
  { o: 7,  sh: '',   cap: '\u2013' },
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

/** The round the Scoring tab shows: the one set live, else the earliest not finished. */
export function currentRound(data: EventData) {
  const { scoringSessions, scoringMatches } = data;
  return scoringSessions.find(s => s.state === 'live') || scoringSessions.find(s => {
    const ms = scoringMatches.filter(m => m.s === s.id);
    if (ms.length && ms.every(m => calc(m).done)) return false;
    if (ms.some(m => calc(m).played > 0)) return true;
    return s.state !== 'final';
  }) || scoringSessions[scoringSessions.length - 1];
}

export default function ScoringScreen({ data, reload }: Props) {
  const { scoringSessions, scoringMatches, meKey } = data;

  // Always refresh the scoring context
  setContext(data.playerMap, scoringSessions, scoringMatches);

  const todayRound = currentRound(data);

  const roundMatches = scoringMatches.filter(m => m.s === todayRound?.id);
  const [heroId, setHeroId] = useState<string | null>(null);
  const [pinned, setPinned] = useState<Record<string, number>>({});

  const hero = roundMatches.find(m => m.id === heroId)
    || (meKey ? roundMatches.find(m => m.a.includes(meKey) || m.b.includes(meKey)) : undefined)
    || roundMatches[0];

  if (!todayRound || !hero) {
    return (
      <div className="empty">
        <b>Cup complete</b>
        Nothing left to play.
      </div>
    );
  }

  const tabbed = roundMatches.length > 1;

  return (
    <>
      {tabbed && (
        <div className="board">
          <GroupTabs
            matches={roundMatches}
            heroId={hero.id}
            onSelect={setHeroId}
            meKey={meKey}
          />
        </div>
      )}
      <div id="heroSlot" className="fill">
        <HeroCard
          match={hero}
          session={todayRound}
          data={data}
          pinned={pinned}
          setPinned={setPinned}
          reload={reload}
          tabbed={tabbed}
        />
      </div>
    </>
  );
}

interface GroupTabsProps {
  matches: Match[];
  heroId: string;
  onSelect: (id: string) => void;
  meKey: string;
}

function GroupTabs({ matches, heroId, onSelect, meKey }: GroupTabsProps) {
  return (
    <div className="ftabs" role="tablist">
      {matches.map(m => {
        const mine = !!meKey && (m.a.includes(meKey) || m.b.includes(meKey));
        const letter = String.fromCharCode(65 + m.g);
        const rr = calc(m);
        const st2 = !rr.played ? '\u2014'
          : rr.done ? (rr.w === 'h' ? 'Halved' : rr.label)
          : (rr.diff === 0 ? 'Even' : `${Math.abs(rr.diff)} up`);
        const selected = m.id === heroId;
        const colCls = rr.w === 'a' ? 'a' : rr.w === 'b' ? 'b' : '';

        return (
          <button
            key={m.id}
            className="ftab"
            role="tab"
            aria-selected={selected}
            onClick={() => onSelect(m.id)}
          >
            <span className="ft1">
              Group {letter}{mine ? <span className="yo"> (you)</span> : ''}
            </span>
            <span className="ftrow">
              <span className="avs">
                {m.a.map(p => (
                  <i key={p} className="av a">{initials(p)}</i>
                ))}
              </span>
              <span className={`ft2 ${colCls}`}>{st2}</span>
              <span className="avs">
                {m.b.map(p => (
                  <i key={p} className="av b">{initials(p)}</i>
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
  tabbed: boolean;
}

/**
 * Safari sometimes fires a click on lift after a thumb-scroll that began on
 * a picker cell (a horizontal scroll-snap row inside the vertical page
 * scroller). Tapping the selected score clears it, so a scroll could
 * "randomly" toggle a score off. Remember where the pointer went down and
 * the scroll positions; a click that arrives after movement is a scroll.
 */
function useTapGuard() {
  const down = useRef<{ x: number; y: number; sl: number; st: number; t: number } | null>(null);
  const scrollerOf = (el: HTMLElement | null) => el?.closest('.tgs') as HTMLElement | null;
  const bodyOf = (el: HTMLElement | null) => el?.closest('.body') as HTMLElement | null;
  const onPointerDown = (e: React.PointerEvent<HTMLElement>) => {
    const t = e.currentTarget;
    down.current = {
      x: e.clientX, y: e.clientY,
      sl: scrollerOf(t)?.scrollLeft ?? 0,
      st: bodyOf(t)?.scrollTop ?? 0,
      t: Date.now(),
    };
  };
  const isTap = (e: React.MouseEvent<HTMLElement>) => {
    const d = down.current;
    down.current = null;
    if (!d) return true; // keyboard / synthetic click
    const t = e.currentTarget;
    const moved = Math.abs(e.clientX - d.x) > 8 || Math.abs(e.clientY - d.y) > 8;
    const scrolled = (scrollerOf(t)?.scrollLeft ?? 0) !== d.sl || (bodyOf(t)?.scrollTop ?? 0) !== d.st;
    const held = Date.now() - d.t > 700;
    return !moved && !scrolled && !held;
  };
  return { onPointerDown, isTap };
}

function HeroCard({ match: m, session: s, data, pinned, setPinned, reload, tabbed }: HeroCardProps) {
  const r = calc(m);
  const tap = useTapGuard();

  // Every picker row starts at its left edge on each new hole. The rows
  // are the same DOM nodes across holes, so a row scrolled to the high
  // scores would otherwise stay there and invite a wrong tap.
  const heroRef = useRef<HTMLDivElement>(null);

  // Ripples: a light disc spreads from the tap point across the cell and
  // fades as the selected fill takes over. One per element, keyed so a
  // second tap restarts it. Auto-decided holes ripple the override button
  // from its centre.
  type Ripple = { id: number; x: number; y: number; d: number };
  const [ripples, setRipples] = useState<Record<string, Ripple>>({});
  // the override strip rises instead: one button at a time, restartable
  const [rise, setRise] = useState<{ w: 'A' | 'B' | 'H'; id: number } | null>(null);
  const riseOn = useCallback((w: 'A' | 'B' | 'H') => {
    const id = Date.now() + Math.random();
    setRise({ w, id });
    setTimeout(() => setRise(p => (p?.id === id ? null : p)), 450);
  }, []);
  const rippleAt = useCallback((key: string, el: HTMLElement | null, cx?: number, cy?: number) => {
    if (!el) return;
    const r = el.getBoundingClientRect();
    const x = cx === undefined ? r.width / 2 : cx - r.left;
    const y = cy === undefined ? r.height / 2 : cy - r.top;
    const d = 2 * Math.hypot(Math.max(x, r.width - x), Math.max(y, r.height - y));
    const id = Date.now() + Math.random();
    setRipples(p => ({ ...p, [key]: { id, x, y, d } }));
    setTimeout(() => setRipples(p => {
      if (p[key]?.id !== id) return p;
      const n = { ...p }; delete n[key]; return n;
    }), 700);
  }, []);
  // plain function, not a component: a nested component would remount on
  // every re-render (each tap reloads data) and restart the animation
  const ripple = (k: string) => {
    const rp = ripples[k];
    return rp ? (
      <span key={rp.id} className="ripple" style={{ left: rp.x - rp.d / 2, top: rp.y - rp.d / 2, width: rp.d, height: rp.d }} />
    ) : null;
  };
  const [pending, setPending] = useState(0);

  // How many scores are still waiting to reach the server. Online, a row
  // sits in the queue for a few hundred ms before it flushes; showing that
  // reads as flicker, so a non-zero count only appears once it has been
  // waiting a couple of seconds. Zero clears immediately.
  useEffect(() => {
    let live = true;
    let timer: ReturnType<typeof setTimeout> | null = null;
    const update = () => {
      getQueuedWrites().then(q => {
        if (!live) return;
        if (timer) { clearTimeout(timer); timer = null; }
        if (q.length === 0) setPending(0);
        else timer = setTimeout(() => { if (live) setPending(q.length); }, 2500);
      });
    };
    update();
    const off = onQueueChange(update);
    return () => { live = false; off(); if (timer) clearTimeout(timer); };
  }, []);

  const i = Math.min(curHole(m, s.holes, pinned), s.holes - 1);
  const h = m.hs[i];
  const bye = r.done && i >= r.byeStart;
  const keys = s.fmt === 'Foursomes' ? ['a', 'b'] : [...m.a, ...m.b];
  const dv = derive(m, i);

  useLayoutEffect(() => {
    heroRef.current?.querySelectorAll<HTMLElement>('.tgs').forEach(el => { el.scrollLeft = 0; });
  }, [m.id, i]);

  const lastRes = useRef<{ id: string; i: number; r: string | null }>({ id: m.id, i, r: h.r });
  useEffect(() => {
    const prev = lastRes.current;
    lastRes.current = { id: m.id, i, r: h.r };
    if (prev.id === m.id && prev.i === i && prev.r !== h.r && h.r) {
      riseOn(h.r);
    }
  }, [m.id, i, h.r, riseOn]);

  // Find the scorer for this group
  const scorerKey = s.scorer[m.g];
  const iAmScorer = !!data.meKey && scorerKey === data.meKey;
  // The commissioner can score any group
  const viewOnly = !iAmScorer && !data.meIsCommissioner;

  // Find the match's tee_group_id and match_id from the DB
  const dbMatch = data.matches.find(dm => dm.id === m.id);

  // Scorer handoff: the scorer hands the pencil on, the commissioner can
  // reassign anyone. Goes straight to tee_group (the handoff policy), no
  // queue — this one needs a signal, and says so.
  const [picking, setPicking] = useState(false);
  const [swapErr, setSwapErr] = useState<string | null>(null);
  const canSwap = iAmScorer || data.meIsCommissioner;
  const teeGroupId = dbMatch?.tee_group_id;
  const handoff = teeGroupId ? data.handoffs[teeGroupId] : undefined;
  const groupKeys = groupPlayers(m.s, m.g, data.scoringMatches);

  const switchScorer = async (k: string) => {
    if (!teeGroupId) return;
    if (k === scorerKey) { setPicking(false); return; }
    setSwapErr(null);
    const { data: rows, error } = await supabase
      .from('tee_group')
      .update({ scorer_player_id: findPlayerId(k, data) })
      .eq('id', teeGroupId)
      .select('id');
    if (error) {
      setSwapErr(/fetch|network|load failed/i.test(error.message)
        ? 'Needs a signal to switch scorer. Try again when you have one.'
        : error.message);
      return;
    }
    if (!rows?.length) {
      // RLS filtered the row: not in this group and not the commissioner
      setSwapErr('Only the scorer or the commissioner can switch.');
      return;
    }
    setPicking(false);
    reload();
  };

  const postScore = useCallback(async (
    holeNum: number,
    scores: Record<string, number | string>,
    result: 'A' | 'B' | 'H' | null,
    derived: boolean,
  ) => {
    if (!dbMatch) return;

    const row = {
      match_id: dbMatch.id,
      hole: holeNum + 1,
      scores,
      result,
      derived,
      entered_by: data.mePlayerId || null,
    };

    // Goes into the IndexedDB queue first, then syncs: immediately when
    // online, otherwise on reconnect / reopen / timer. The queue notifies
    // useEventData, which reloads and overlays anything still unsynced.
    await enqueueHoleWrite(row);
  }, [dbMatch, data.mePlayerId]);

  const handleScoreSet = useCallback(async (k: string, value: number | 'X') => {
    if (viewOnly) return;
    // Pin to current hole so we don't auto-advance after scoring
    setPinned(prev => ({ ...prev, [m.id]: i }));

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
  }, [h, i, keys, m, s.fmt, data, postScore, viewOnly, setPinned]);

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

  // the hole number slides in from the tapped arrow's side, i.e. away from it
  const [slide, setSlide] = useState<{ dir: number; id: number } | null>(null);
  const nav = (dir: number) => {
    const next = Math.max(0, Math.min(s.holes - 1, i + dir));
    if (next !== i) setSlide({ dir, id: Date.now() });
    setPinned(prev => ({ ...prev, [m.id]: next }));
  };

  const A = CFG.teams.a.short;
  const B = CFG.teams.b.short;

  return (
    <div className={`hero${tabbed ? ' tabbed' : ''}`} ref={heroRef}>
      {/* Hole navigator */}
      <div className="hnav">
        <button
          onClick={() => nav(-1)}
          disabled={i === 0}
          aria-label="Previous hole"
        >&#8249;</button>
        <div className="hnc">
          <span key={slide?.id ?? 'still'} className={`hh1${slide ? (slide.dir > 0 ? ' from-right' : ' from-left') : ''}`}>Hole {i + 1}</span>
          <span className="hh2">
            Par {s.par[i]}{s.si ? ` · SI ${s.si[i]}` : ' · scratch'}
            {pending > 0 ? ` · ${pending} to sync` : data.offline ? ' · offline' : ''}
          </span>
        </div>
        <button
          onClick={() => nav(1)}
          disabled={i >= s.holes - 1}
          aria-label="Next hole"
        >&#8250;</button>
      </div>

      {/* Override strip */}
      {!bye && (
        <div className="bovr">
          {(['A', 'H', 'B'] as const).map(w => (
            <button
              key={w}
              data-w={w}
              className={`${h.r === w ? 'sel' : ''}${rise?.w === w ? ' rise' : ''} ${viewOnly ? 'ro' : ''}`}
              onPointerDown={tap.onPointerDown}
              onClick={e => {
                if (!tap.isTap(e)) return;
                handleOverride(w);
              }}
            >
              {w === 'A' ? A : w === 'H' ? 'Halved' : B}
              {rise?.w === w && <span key={rise.id} className="fillup" />}
            </button>
          ))}
        </div>
      )}

      {/* Stroke legend */}
      <StrokeLegend match={m} holeIdx={i} session={s} />

      {/* Bye hole bar */}
      {bye && (
        <div className="byebar">
          Bye hole · match closed on {r.byeStart} · recorded but does not count
        </div>
      )}

      {/* Player rows with notation cells */}
      {keys.map(k => {
        const side = s.fmt === 'Foursomes' ? k : P[k]?.t || 'a';
        const pnm = s.fmt === 'Foursomes' ? CFG.teams[k].name : (P[k]?.n || k);
        const hcp = s.fmt === 'Foursomes' ? null : P[k]?.h;
        const g = h.sc[k];
        const st = getsStroke(m, k, i);
        const isX = g === 'X';
        const isScorerRow = k === scorerKey;

        return (
          <div key={k} className="brow">
            <div className="btop">
              <span className={`bn ${side}`}>
                {pnm}
                {hcp != null && <span className="hcp"> ({hcp})</span>}
                {st ? <i className="sdot2" /> : null}
              </span>
              {isScorerRow && (
                <span className="skin">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4z"/>
                  </svg>
                  Scorekeeper
                  {canSwap && (
                    <button className="swap" onClick={() => { setPicking(p => !p); setSwapErr(null); }}>
                      {picking ? 'Cancel' : 'Switch'}
                    </button>
                  )}
                </span>
              )}
            </div>
            {isScorerRow && picking && canSwap && (
              <div className="picker">
                {groupKeys.map(gk => (
                  <button key={gk} className={gk === scorerKey ? 'sel' : ''} onClick={() => switchScorer(gk)}>
                    {P[gk]?.n || gk}{gk === data.meKey ? ' (you)' : ''}
                  </button>
                ))}
              </div>
            )}

            <div className="tgs-wrap"><div className="tgs">
              {NOTE.map(t => {
                const val = s.par[i] + t.o;
                const on = g === val && !isX;
                const adj = !!st && !isX && g !== undefined && g !== null && val === (g as number) - 1;

                if (val < 1) {
                  return (
                    <button key={t.o} className="tg" disabled>
                      <span className="mk" />
                    </button>
                  );
                }

                return (
                  <button
                    key={t.o}
                    className={`tg${on ? ' sel' : ''}${adj ? ' adj' : ''} ${viewOnly ? 'ro' : ''}`}
                    onPointerDown={tap.onPointerDown}
                    onClick={e => {
                      if (!tap.isTap(e)) return;
                      if (!viewOnly && !on) rippleAt(`tg:${k}:${val}`, e.currentTarget, e.clientX, e.clientY); // not when clearing
                      handleScoreSet(k, val);
                    }}
                  >
                    <span className={`mk ${t.sh}`}>{val}</span>
                    <span className="cap">{t.cap}</span>
                    {ripple(`tg:${k}:${val}`)}
                  </button>
                );
              })}
            </div></div>
          </div>
        );
      })}

      {/* Derived result line */}
      {h.d && !bye && !holeComplete(m, i) && (
        <div className="bder">
          <span className="tag">Hole not complete</span>
          Waiting on {missingIn(m, i).map(k =>
            s.fmt === 'Foursomes' ? CFG.teams[k].name : (P[k]?.n.split(' ')[0] || k)
          ).join(', ')}.
        </div>
      )}
      {h.d && holeComplete(m, i) && dv.why && (
        <div className="bder">
          <span className="tag">{bye ? 'Bye hole, not counted' : 'Decided by the app'}</span>
          <span dangerouslySetInnerHTML={{ __html: dv.why }} />
        </div>
      )}
      {!h.d && h.r && (
        <div className="bder">
          <span className="tag">{bye ? 'Bye hole, not counted' : 'Tapped, not computed'}</span>
          Set by hand{h.by ? ` by ${h.by}` : ''}.
        </div>
      )}

      {/* Hole footer */}
      <div className="hfoot">
        <span>
          {bye
            ? `Match final · ${headline(m).txt}`
            : (h.r ? `${runningAt(m, i)} after ${i + 1}${h.by ? ' · ' + h.by : ''}` : 'Not posted')}
        </span>
        {h.r && i < s.holes - 1 && (
          <button className="lnk" onClick={() => nav(1)}>
            Next hole ›
          </button>
        )}
      </div>

      {/* Handoff log line */}
      {handoff && (
        <div className="holine">
          Taken over from {playerName(handoff.from, data)} by {playerName(handoff.by, data)}, {ago(handoff.at)}
        </div>
      )}
      {swapErr && <div className="holine err">{swapErr}</div>}

      {/* Scorer bar, only when the scorer isn't one of the rows above
          (foursomes, or the other match in a singles group) */}
      {!keys.includes(scorerKey) && (
        <>
          {picking && canSwap && (
            <div className="picker">
              {groupKeys.map(k => (
                <button key={k} className={k === scorerKey ? 'sel' : ''} onClick={() => switchScorer(k)}>
                  {P[k]?.n || k}{k === data.meKey ? ' (you)' : ''}
                </button>
              ))}
            </div>
          )}
          <div className="scbar bottom">
            <span className="scin">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4z"/>
              </svg>
              <b>{P[scorerKey]?.n || 'Nobody'}</b> is scoring this group
            </span>
            {canSwap && (
              <button className="swap" onClick={() => { setPicking(p => !p); setSwapErr(null); }}>
                {picking ? 'Cancel' : 'Switch'}
              </button>
            )}
          </div>
        </>
      )}
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
    <div className="legend">
      <i className="ldot" />
      <b>{who}</b> {verb} a shot on this hole.
      The gold underline marks the score it plays as.
    </div>
  );
}

/** Every player in a tee group: at singles a group carries two matches. */
function groupPlayers(sessionId: string, g: number, matches: Match[]): string[] {
  const set: string[] = [];
  matches.filter(m => m.s === sessionId && m.g === g).forEach(m => {
    [...m.a, ...m.b].forEach(p => { if (!set.includes(p)) set.push(p); });
  });
  return set;
}

function playerName(id: string | null, data: EventData): string {
  if (!id) return 'nobody';
  return data.playerById[id]?.name || 'someone';
}

function ago(iso: string): string {
  const mins = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins} min ago`;
  const d = new Date(iso);
  return `${((d.getHours() + 11) % 12) + 1}:${String(d.getMinutes()).padStart(2, '0')} ${d.getHours() >= 12 ? 'PM' : 'AM'}`;
}

function findPlayerId(key: string, data: EventData): string {
  // 'a' and 'b' are side keys for foursomes
  if (key === 'a' || key === 'b') return key;
  const player = data.players.find(p => p.name.split(' ')[0].toLowerCase() === key);
  return player?.id || key;
}
