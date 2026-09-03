import { useEffect, useRef, useState } from 'react';
import { supabase } from '../lib/supabase';
import { getTheme, setTheme, type Theme } from '../lib/theme';
import { TIEBREAK, type MomentsState } from '../lib/moments';
import { deskFor, quietMins, type DeskState } from '../lib/desk';
import type { Acting } from '../lib/view';
import type { EventData } from '../hooks/useEventData';
import { IconFlagCheckered } from './icons';
import type { DbPlayer } from '../lib/types';

interface Props {
  data: EventData;
  acting?: Acting;
  onActing?: (a: Acting) => void;
  moments?: MomentsState | null;
  open: boolean;
  onClose: () => void;
  reload: () => void;
  signOut: () => Promise<void>;
}

type ShootoutDraft = { a: (number | '')[]; b: (number | '')[] };
const draftFrom = (sh: { a?: number[]; b?: number[] } | null | undefined): ShootoutDraft => ({
  a: [0, 1, 2].map(i => sh?.a?.[i] ?? ''),
  b: [0, 1, 2].map(i => sh?.b?.[i] ?? ''),
});

const STATES: ReadonlyArray<readonly [string, string]> = [
  ['upcoming', 'Not started'],
  ['live', 'Live'],
  ['final', 'Complete'],
];

type Outcome = PromiseLike<{ error: { message: string } | null }>;

/**
 * Slide-over settings. Everyone gets the account row (sign out); the
 * commissioner also gets rounds, scorers, pairings and the reset. Every
 * control writes straight to Supabase through the commissioner policies
 * and reloads; realtime carries the change to the other phones.
 */
export default function SettingsSheet({ data, acting = 'player', onActing, moments = null, open, onClose, reload, signOut }: Props) {
  const [err, setErr] = useState<string | null>(null);
  const [confirmClear, setConfirmClear] = useState(false);
  const [cleared, setCleared] = useState(false);
  const [theme, setThemeState] = useState<Theme>(getTheme());
  const flipTheme = () => {
    const next: Theme = theme === 'light' ? 'dark' : 'light';
    setTheme(next);
    setThemeState(next);
  };

  const me = data.playerById[data.mePlayerId];
  const commish = data.meIsCommissioner;

  const run = async (q: Outcome) => {
    setErr(null);
    const { error } = await q;
    if (error) { setErr(error.message); return; }
    reload();
  };

  const setRoundState = (id: string, state: string) =>
    run(supabase.from('round').update({ state }).eq('id', id));
  const setScorer = (tgId: string, pid: string) =>
    run(supabase.from('tee_group').update({ scorer_player_id: pid }).eq('id', tgId));
  const setSide = (matchId: string, side: 'a' | 'b', ids: string[]) =>
    run(supabase.from('match').update({ [`side_${side}`]: ids }).eq('id', matchId));
  const setOdds = (matchId: string, side: 'a' | 'b', pid: string) =>
    run(supabase.from('match').update({ [`odds_${side}`]: pid || null }).eq('id', matchId));

  // Captains Shootout draft; re-seeded from the server row whenever the
  // sheet opens or another phone saves one.
  const [sh, setSh] = useState<ShootoutDraft>(() => draftFrom(data.event.shootout));
  useEffect(() => { setSh(draftFrom(data.event.shootout)); }, [open, data.event.shootout]);
  const shReady = [...sh.a, ...sh.b].every(v => typeof v === 'number');
  const shTa = sh.a.reduce<number>((t, x) => t + (Number(x) || 0), 0);
  const shTb = sh.b.reduce<number>((t, x) => t + (Number(x) || 0), 0);
  const saveShootout = () =>
    run(supabase.rpc('set_shootout', { s: { a: sh.a, b: sh.b, done: true } }));
  const clearShootout = () => run(supabase.rpc('set_shootout', { s: null }));

  // Completing a round with cards still out asks once, with names.
  const [finalGuard, setFinalGuard] = useState<{ roundId: string; msg: string } | null>(null);
  const guardFor = (roundId: string): string | null => {
    const tgs = data.teeGroups.filter(t => t.round_id === roundId);
    const out = tgs.filter(t => !t.submitted_at);
    if (!out.length) return null;
    const session = data.scoringSessions.find(x => x.id === roundId);
    const letters = out.map(t => `Group ${String.fromCharCode(65 + Math.max(0, tgs.findIndex(x => x.id === t.id)))}`);
    let openHoles = 0;
    out.forEach(t => {
      const ids = data.matches.filter(m => m.tee_group_id === t.id).map(m => m.id);
      const gm = data.scoringMatches.filter(m => ids.includes(m.id));
      gm.forEach(m => { for (let i = 0; i < (session?.holes || 0); i++) if (!m.hs[i]?.r) openHoles++; });
    });
    return `${letters.join(' and ')} ${out.length === 1 ? "hasn't" : "haven't"} handed the card in` +
      (openHoles ? ` — ${openHoles} hole${openHoles === 1 ? '' : 's'} still open` : '') +
      '. Completing locks scoring and any unsynced scores will be refused.';
  };
  const requestRoundState = (id: string, state: string) => {
    setFinalGuard(null);
    if (state === 'final') {
      const msg = guardFor(id);
      if (msg) { setFinalGuard({ roundId: id, msg }); return; }
    }
    setRoundState(id, state);
  };

  const clearAll = async () => {
    if (!confirmClear) { setConfirmClear(true); return; }
    setErr(null);
    setConfirmClear(false);
    const { error } = await supabase.rpc('reset_event');
    if (error) { setErr(error.message); return; }
    setCleared(true);
    setTimeout(() => setCleared(false), 1600);
    reload();
  };

  // Once the Cup is under way, clearing takes a two-second hold.
  const underway = data.matchHoles.length > 0;
  const [holding, setHolding] = useState(false);
  const holdTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const startHold = () => {
    setErr(null);
    setHolding(true);
    holdTimer.current = setTimeout(async () => {
      setHolding(false);
      const { error } = await supabase.rpc('reset_event');
      if (error) { setErr(error.message); return; }
      setCleared(true);
      setTimeout(() => setCleared(false), 1600);
      reload();
    }, 2000);
  };
  const cancelHold = () => {
    setHolding(false);
    if (holdTimer.current) { clearTimeout(holdTimer.current); holdTimer.current = null; }
  };

  const unbindSeat = (pid: string) =>
    run(supabase.rpc('clear_seat', { p: pid }));

  const desk: DeskState | null = commish ? deskFor(data) : null;

  // The commissioner's controls, grouped by job under tabs.
  const [stab, setStab] = useState<'today' | 'setup' | 'event' | 'you'>('today');
  const setBodyRef = useRef<HTMLDivElement>(null);
  const goStab = (t: typeof stab) => {
    setStab(t);
    setBodyRef.current?.scrollTo(0, 0);
  };
  const STABS: ReadonlyArray<readonly [typeof stab, string]> = [
    ['today', 'Today'], ['setup', 'Setup'], ['event', 'Event'], ['you', 'You'],
  ];

  const teamOf = (side: 'a' | 'b') => data.teams.find(t => t.side === side);
  const playersOf = (side: 'a' | 'b'): DbPlayer[] => {
    const t = teamOf(side);
    return data.players.filter(p => p.team_id === t?.id);
  };
  const first = (id: string) => data.playerById[id]?.name.split(' ')[0] || '?';
  const fname = (n?: string | null) => (n || '').split(' ')[0];

  const tgsOfRound = (roundId: string) =>
    data.teeGroups.filter(t => t.round_id === roundId).sort((a, b) => a.seq - b.seq);

  const groupPlayerIds = (tgId: string): string[] => {
    const ids: string[] = [];
    data.matches.filter(m => m.tee_group_id === tgId).forEach(m => {
      [...m.side_a, ...m.side_b].forEach(id => { if (!ids.includes(id)) ids.push(id); });
    });
    return ids;
  };

  return (
    <div
      className={`settings${open ? ' on' : ''}`}
      role="dialog"
      aria-modal="true"
      aria-label="Settings"
      aria-hidden={!open}
    >
      <div className="sethd">
        <h2>{commish ? 'Commissioner' : 'Settings'}</h2>
        <button className="done" onClick={onClose}>Done</button>
      </div>
      {commish && (
        <div className="stabs" role="tablist">
          {STABS.map(([t, label]) => (
            <button key={t} role="tab" aria-selected={stab === t} onClick={() => goStab(t)}>
              {label}
            </button>
          ))}
        </div>
      )}
      <div className="setbody" ref={setBodyRef}>
        {err && <div className="holine err">{err}</div>}

        {commish && stab === 'you' && onActing && (
          <>
            <div className="grp">
              <h3>Acting as</h3>
              <div className="hint">
                Player is the default: you see the app exactly as the other
                seven do, and your scores-anywhere powers stay holstered.
                Commissioner arms them and puts the crown by the cog.
              </div>
            </div>
            <div className="seg" role="tablist" aria-label="Acting as">
              <button role="tab" aria-selected={acting === 'player'} className={acting === 'player' ? 'on' : ''} onClick={() => onActing('player')}>Player</button>
              <button role="tab" aria-selected={acting === 'commish'} className={acting === 'commish' ? 'on' : ''} onClick={() => onActing('commish')}>Commissioner</button>
            </div>
          </>
        )}

        {(!commish || stab === 'you') && (
          <>
            <div className="grp">
              <h3>Appearance</h3>
              <div className="hint">Dark holds up better in direct sun on the course. Light is easier indoors.</div>
            </div>
            <div className="fld">
              <label>Light mode</label>
              <button className="sw" role="switch" aria-checked={theme === 'light'} aria-label="Light mode" onClick={flipTheme} />
            </div>

            <div className="grp"><h3>Account</h3></div>
            <div className="fld">
              <label>
                {fname(me?.name) || 'Signed in'}
                <span className="sub2">{commish ? 'Commissioner' : 'Player'}</span>
              </label>
              <button className="aghost" onClick={signOut}>Sign out</button>
            </div>
          </>
        )}

        {commish && (
          <>
            {stab === 'today' && <>
            {/* ---- The desk ---- */}
            {desk && (
              <Desk
                desk={desk}
                data={data}
                onLive={() => requestRoundState(desk.round.id, 'live')}
                onComplete={() => requestRoundState(desk.round.id, 'final')}
              />
            )}
            {!desk && data.scoringSessions.length > 0 && data.scoringSessions.every(x => x.state === 'final') && (
              <div className="empty">
                <IconFlagCheckered />
                <b>All four rounds in the book</b>
                The desk stands down. Reopen a card from Setup if anything
                needs correcting.
              </div>
            )}
            {desk && finalGuard?.roundId === desk.round.id && (
              <div className="guard">
                {finalGuard.msg}{' '}
                <button className="glock" onClick={() => { setFinalGuard(null); setRoundState(desk.round.id, 'final'); }}>
                  Lock it anyway
                </button>
              </div>
            )}

            {/* ---- Rounds ---- */}
            <div className="grp">
              <h3>Rounds</h3>
              <div className="hint">
                Set a round live on the first tee; the Scoring tab follows it.
                Complete locks its scores for everyone but you.
              </div>
            </div>
            {data.rounds.map((r, i) => {
              const s = data.scoringSessions[i];
              return (
                <div key={r.id} className="rdrow">
                  <div className="r1">
                    <span className="nm2">{r.label} · {s?.course}</span>
                    <span className="cs">{s?.day}</span>
                  </div>
                  <div className="r2">
                    <select value={r.state} onChange={e => requestRoundState(r.id, e.target.value)}>
                      {STATES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                    </select>
                  </div>
                  {finalGuard?.roundId === r.id && (
                    <div className="guard">
                      {finalGuard.msg}{' '}
                      <button className="glock" onClick={() => { setFinalGuard(null); setRoundState(r.id, 'final'); }}>
                        Lock it anyway
                      </button>
                    </div>
                  )}
                </div>
              );
            })}

            </>}
            {stab === 'setup' && <>
            {/* ---- Scorers ---- */}
            <div className="grp">
              <h3>Scorers</h3>
              <div className="hint">
                One per tee time, not per match. At singles a group carries two
                matches and the scorer covers both. Elected on the first tee,
                changeable any time.
              </div>
            </div>
            {data.rounds.map((r, ri) =>
              tgsOfRound(r.id).map((tg, gi) => {
                const gp = groupPlayerIds(tg.id);
                return (
                  <div key={tg.id} className="fld">
                    <label>
                      {r.label} · {data.scoringSessions[ri]?.tees[gi]}
                      <span className="sub2">
                        {gp.map(first).join(', ')}
                        {tg.submitted_at ? ' · Card in' : ''}
                      </span>
                    </label>
                    {tg.submitted_at && (
                      <button className="aghost" onClick={() => run(supabase.rpc('reopen_card', { tg: tg.id }))}>
                        Reopen
                      </button>
                    )}
                    <select
                      value={tg.scorer_player_id ?? ''}
                      onChange={e => setScorer(tg.id, e.target.value)}
                    >
                      {!tg.scorer_player_id && <option value="">Nobody</option>}
                      {gp.map(id => (
                        <option key={id} value={id}>{first(id)}</option>
                      ))}
                    </select>
                  </div>
                );
              }),
            )}

            {/* ---- Pairings ---- */}
            <div className="grp">
              <h3>Pairings</h3>
              <div className="hint">
                Red on the left, blue on the right. Cards go in the night before;
                changing a match with scores on it does not clear them.
              </div>
            </div>
            {data.rounds.map((r, ri) => {
              const s = data.scoringSessions[ri];
              const slots = r.format === 'singles' ? 1 : 2;
              const tgs = tgsOfRound(r.id);
              const ms = data.matches.filter(m => m.round_id === r.id).sort((a, b) => a.seq - b.seq);
              return (
                <div key={r.id}>
                  <div className="grp" style={{ paddingTop: 10 }}>
                    <h3 style={{ color: 'var(--bone)', fontSize: 14 }}>{r.label} · {s?.fmt}</h3>
                  </div>
                  {ms.map(m => {
                    const gi = tgs.findIndex(t => t.id === m.tee_group_id);
                    const letter = String.fromCharCode(65 + Math.max(0, gi));
                    return (
                      <div key={m.id} className="rdrow">
                        <div className="r1">
                          <span className="nm2">Match {m.seq} · Group {letter}</span>
                          <span className="cs">{s?.tees[gi]}</span>
                        </div>
                        {(['a', 'b'] as const).map(side => {
                          const ids = side === 'a' ? m.side_a : m.side_b;
                          const team = teamOf(side);
                          return (
                            <div key={side} className="r2" style={{ marginTop: side === 'b' ? 8 : 0 }}>
                              <span
                                className="cs"
                                style={{ width: 34, flex: 'none', alignSelf: 'center', color: `var(--${side === 'a' ? 'red' : 'blue'})` }}
                              >
                                {team?.short}
                              </span>
                              {Array.from({ length: slots }, (_, k) => (
                                <select
                                  key={k}
                                  value={ids[k] ?? ''}
                                  onChange={e => {
                                    const next = [...ids];
                                    next[k] = e.target.value;
                                    setSide(m.id, side, next.filter(Boolean));
                                  }}
                                >
                                  {!ids[k] && <option value="">—</option>}
                                  {playersOf(side).map(p => (
                                    <option key={p.id} value={p.id}>{fname(p.name)}</option>
                                  ))}
                                </select>
                              ))}
                            </div>
                          );
                        })}
                        {r.format === 'foursomes' && (
                          <div className="r2" style={{ marginTop: 8 }}>
                            <span className="cs" style={{ width: 34, flex: 'none', alignSelf: 'center' }}>Odds</span>
                            {(['a', 'b'] as const).map(side => {
                              const ids = side === 'a' ? m.side_a : m.side_b;
                              const cur = side === 'a' ? m.odds_a : m.odds_b;
                              return (
                                <select
                                  key={side}
                                  value={cur ?? ''}
                                  onChange={e => setOdds(m.id, side, e.target.value)}
                                >
                                  <option value="">Tees off odd holes…</option>
                                  {ids.map(id => (
                                    <option key={id} value={id}>{first(id)}</option>
                                  ))}
                                </select>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              );
            })}

            </>}
            {stab === 'event' && <>
            {/* ---- Captains Shootout ---- */}
            {(moments?.tie || data.event.shootout) && (
              <>
                <div className="grp">
                  <h3>{TIEBREAK.name}</h3>
                  <div className="hint">
                    Strokes per hole for each captain, entered here once the
                    putts have actually dropped. Saving decides the cup on
                    every phone. Clear puts the jug back on the line.
                  </div>
                </div>
                {(['a', 'b'] as const).map(side => {
                  const team = teamOf(side);
                  const cap = moments?.captains[side] || team?.name || side;
                  return (
                    <div key={side} className="rdrow">
                      <div className="r1">
                        <span className="nm2">{cap}</span>
                        <span className="cs" style={{ color: `var(--${side === 'a' ? 'red' : 'blue'})` }}>{team?.name}</span>
                      </div>
                      <div className="r2">
                        {TIEBREAK.stations.map((st, i) => (
                          <select
                            key={i}
                            aria-label={`${cap} · ${st.n}`}
                            value={sh[side][i]}
                            onChange={e => setSh(d => {
                              const next = { a: [...d.a], b: [...d.b] };
                              next[side][i] = e.target.value === '' ? '' : Number(e.target.value);
                              return next;
                            })}
                          >
                            <option value="">{st.d}ft…</option>
                            {Array.from({ length: TIEBREAK.maxStrokes }, (_, n) => (
                              <option key={n + 1} value={n + 1}>{n + 1}</option>
                            ))}
                          </select>
                        ))}
                      </div>
                    </div>
                  );
                })}
                {shReady && (
                  <div className="hint" style={{ padding: '0 18px 8px' }}>
                    {shTa === shTb
                      ? `Level at ${shTa}. Replay ${TIEBREAK.stations[2].n} until someone blinks, then change hole 3.`
                      : `${shTa < shTb ? moments?.captains.a || 'Red' : moments?.captains.b || 'Blue'} takes it, ${Math.min(shTa, shTb)}–${Math.max(shTa, shTb)}.`}
                  </div>
                )}
                <div className="fld">
                  <label>
                    {data.event.shootout ? 'On the books' : 'Not yet decided'}
                    {data.event.shootout && <span className="sub2">Saved to every phone</span>}
                  </label>
                  {data.event.shootout && (
                    <button className="aghost" onClick={clearShootout}>Clear</button>
                  )}
                  <button className="abtn" style={{ width: 'auto', padding: '10px 16px' }} disabled={!shReady} onClick={saveShootout}>
                    {data.event.shootout ? 'Save again' : 'Save the shootout'}
                  </button>
                </div>
              </>
            )}

            {/* ---- Seats ---- */}
            <div className="grp">
              <h3>Seats</h3>
              <div className="hint">
                Who each chair belongs to. Unbind clears a stale account so the
                right email can claim the seat — run this before invites go out.
              </div>
            </div>
            {data.players.map(p => (
              <div key={p.id} className="seatrow">
                <span className="sn2">{fname(p.name)}</span>
                <span className="se">{p.email}</span>
                <span className={`schip${p.auth_uid ? ' ok' : ''}`}>{p.auth_uid ? 'Claimed' : 'Open'}</span>
                {p.auth_uid && p.id !== data.mePlayerId && (
                  <button className="unbind" onClick={() => unbindSeat(p.id)}>Unbind</button>
                )}
              </div>
            ))}

            {/* ---- Danger ---- */}
            <div className="grp">
              <h3>Danger</h3>
              <div className="hint">
                Clears every score, reopens every card, puts all four rounds back
                to Not started. The history table keeps the record.
                {underway
                  ? ' The Cup is under way, so this takes a two-second hold — releasing early cancels.'
                  : ' Do this once, before Thursday.'}
              </div>
            </div>
            <div className="danger">
              {underway ? (
                <button
                  className={`dbtn hold${holding ? ' holding' : ''}`}
                  onPointerDown={startHold}
                  onPointerUp={cancelHold}
                  onPointerLeave={cancelHold}
                  onPointerCancel={cancelHold}
                  onContextMenu={e => e.preventDefault()}
                >
                  {cleared ? 'Cleared' : holding ? 'Hold on…' : 'Hold to clear everything'}
                </button>
              ) : (
                <button className="dbtn" onClick={clearAll} onBlur={() => setConfirmClear(false)}>
                  {cleared ? 'Cleared' : confirmClear ? 'Tap again to clear everything' : 'Clear all scores'}
                </button>
              )}
            </div>
            </>}
          </>
        )}
      </div>
    </div>
  );
}


/** The commissioner's day on one card: launch, watch, landing. */
function Desk({ desk, data, onLive, onComplete }: {
  desk: DeskState;
  data: EventData;
  onLive: () => void;
  onComplete: () => void;
}) {
  const first = (id: string | null) => id ? (data.playerById[id]?.name.split(' ')[0] || '?') : null;
  const t = (ms: number) => {
    const d = new Date(ms);
    let h = d.getHours();
    const ap = h >= 12 ? 'pm' : 'am';
    h = ((h + 11) % 12) + 1;
    return `${h}:${String(d.getMinutes()).padStart(2, '0')}${ap}`;
  };
  const s = desk.session;
  const total = desk.groups.length;

  return (
    <>
      <div className="grp">
        <h3>The desk</h3>
        <div className="hint">
          {desk.state === 'upcoming'
            ? `${s.day} · ${s.rd} · ${s.course} · tees ${s.tees.join('/')}`
            : desk.state === 'live'
              ? `${s.rd} live at ${s.course}`
              : `${s.rd} is in the book`}
        </div>
      </div>

      {desk.state === 'upcoming' ? (
        <>
          <div className={`deskrow${desk.pairingsSet === desk.pairingsTotal ? ' ok' : ' warn'}`}>
            <span className="dk">Pairings</span>
            <span className="dv">{desk.pairingsSet} of {desk.pairingsTotal} set</span>
            <span className="dtick">{desk.pairingsSet === desk.pairingsTotal ? '\u2713' : '!'}</span>
          </div>
          <div className={`deskrow${desk.scorersSet === total ? ' ok' : ' warn'}`}>
            <span className="dk">Scorers</span>
            <span className="dv">
              {desk.scorersSet === total
                ? desk.groups.map(g => first(g.scorer)).join(' \u00b7 ')
                : `${desk.groups.filter(g => !g.scorer).map(g => `Group ${g.letter}`).join(', ')} unnamed`}
            </span>
            <span className="dtick">{desk.scorersSet === total ? '\u2713' : '!'}</span>
          </div>
          <div className="deskrow">
            <span className="dk">Format</span>
            <span className="dv">{s.fmt} \u00b7 {s.holes} holes</span>
            <span className="dtick" />
          </div>
          <button
            className="abtn deskgo"
            disabled={desk.scorersSet < total || desk.pairingsSet < desk.pairingsTotal}
            onClick={onLive}
          >
            {desk.scorersSet < total ? 'Name the scorers first'
              : desk.pairingsSet < desk.pairingsTotal ? 'Finish the pairings first'
              : `Set ${s.rd} live`}
          </button>
        </>
      ) : desk.state === 'live' ? (
        <>
          {desk.groups.map(g => {
            const q = quietMins(g.lastAt);
            const quiet = q !== null && q >= 30 && g.open > 0;
            return (
              <div key={g.tgId} className={`deskrow${quiet ? ' warn' : ' ok'}`}>
                <span className="dk">Group {g.letter}</span>
                <span className="dv">
                  {g.submitted ? 'card in'
                    : g.lastAt === null ? 'no scores yet'
                    : quiet ? `thru ${g.thru} \u00b7 quiet ${q} min`
                    : `thru ${g.thru} \u00b7 last score ${t(g.lastAt!)}`}
                </span>
                <span className="dtick">{g.submitted ? '\u2713' : quiet ? '!' : ''}</span>
              </div>
            );
          })}
          <div className="deskrow">
            <span className="dk">Cards</span>
            <span className="dv">{desk.cardsIn} of {total} in</span>
            <span className="dtick">{desk.cardsIn === total ? '\u2713' : ''}</span>
          </div>
          <button className={`abtn deskgo${desk.cardsIn < total ? ' soft' : ''}`} onClick={onComplete}>
            {desk.cardsIn < total
              ? `Mark complete \u2014 ${total - desk.cardsIn} card${total - desk.cardsIn === 1 ? '' : 's'} still out`
              : `Mark ${s.rd} complete`}
          </button>
        </>
      ) : null}
    </>
  );
}
