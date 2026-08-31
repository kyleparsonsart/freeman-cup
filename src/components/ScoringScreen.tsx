import { useState, useCallback, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { enqueueHoleWrite, getQueuedWrites, onQueueChange } from '../lib/writeQueue';
import {
  calc, derive, settle, holeComplete, getsStroke, runningAt, headline,
  holeKeys, missingIn, initials, setContext,
  CFG, P,
  type Match,
} from '../lib/scoring';
import type { EventData } from '../hooks/useEventData';
import CupStrip from './CupStrip';

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

export default function ScoringScreen({ data, reload }: Props) {
  const { scoringSessions, scoringMatches, meKey } = data;

  // Always refresh the scoring context
  setContext(data.playerMap, scoringSessions, scoringMatches);

  // Find the current round: the one the commissioner set live, else the
  // earliest not finished
  const todayRound = scoringSessions.find(s => s.state === 'live') || scoringSessions.find(s => {
    const ms = scoringMatches.filter(m => m.s === s.id);
    if (ms.length && ms.every(m => calc(m).done)) return false;
    if (ms.some(m => calc(m).played > 0)) return true;
    return s.state !== 'final';
  }) || scoringSessions[scoringSessions.length - 1];

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
      <CupStrip />
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

function HeroCard({ match: m, session: s, data, pinned, setPinned, reload, tabbed }: HeroCardProps) {
  const r = calc(m);
  const [saving, setSaving] = useState(false);
  const [pending, setPending] = useState(0);

  // How many scores are still waiting to reach the server
  useEffect(() => {
    let live = true;
    const update = () => {
      getQueuedWrites().then(q => { if (live) setPending(q.length); });
    };
    update();
    const off = onQueueChange(update);
    return () => { live = false; off(); };
  }, []);

  const i = Math.min(curHole(m, s.holes, pinned), s.holes - 1);
  const h = m.hs[i];
  const bye = r.done && i >= r.byeStart;
  const keys = s.fmt === 'Foursomes' ? ['a', 'b'] : [...m.a, ...m.b];
  const dv = derive(m, i);

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
    setSaving(true);

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

    setSaving(false);
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

  const nav = (dir: number) => {
    setPinned(prev => ({
      ...prev,
      [m.id]: Math.max(0, Math.min(s.holes - 1, i + dir)),
    }));
  };

  const A = CFG.teams.a.short;
  const B = CFG.teams.b.short;

  return (
    <div className={`hero${tabbed ? ' tabbed' : ''}`}>
      {/* Scorer picker */}
      {picking && canSwap && (
        <div className="picker">
          {groupKeys.map(k => (
            <button
              key={k}
              className={k === scorerKey ? 'sel' : ''}
              onClick={() => switchScorer(k)}
            >
              {P[k]?.n || k}{k === data.meKey ? ' (you)' : ''}
            </button>
          ))}
        </div>
      )}

      {/* Hole navigator */}
      <div className="hnav">
        <button
          onClick={() => nav(-1)}
          disabled={i === 0}
          aria-label="Previous hole"
        >&#8249;</button>
        <div className="hnc">
          <span className="hh1">Hole {i + 1}</span>
          <span className="hh2">
            Par {s.par[i]}{s.si ? ` · SI ${s.si[i]}` : ' · scratch'}
            {saving ? ' · saving…' : pending > 0 ? ` · ${pending} to sync` : data.offline ? ' · offline' : ''}
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
              className={`${h.r === w ? 'sel' : ''} ${viewOnly ? 'ro' : ''}`}
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
        const net = (!isX && g !== undefined && g !== null && st) ? `−1 = ${(g as number) - st}` : '';

        return (
          <div key={k} className="brow">
            <div className="btop">
              <span className={`bn ${side}`}>
                {pnm}
                {hcp != null && <span className="hcp"> ({hcp})</span>}
                {st ? <i className="sdot2" /> : null}
              </span>
              <span className="bnet">{net}</span>
              <button
                className={`xchip${isX ? ' on' : ''} ${viewOnly ? 'ro' : ''}`}
                data-set="x"
                data-k={k}
                aria-label={`Picked up, ${pnm}`}
                aria-pressed={isX}
                onClick={() => handleScoreSet(k, 'X')}
              >
                <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round">
                  <path d="M4 4l12 12M16 4L4 16"/>
                </svg>
                Picked up
              </button>
            </div>

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
                    onClick={() => handleScoreSet(k, val)}
                  >
                    <span className={`mk ${t.sh}`}>{val}</span>
                    <span className="cap">{t.cap}</span>
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

      {/* Scorer banner */}
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
