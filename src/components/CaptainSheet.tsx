/**
 * The captain's sheet, living in the Scoring tab the night before a
 * round (a round with no matches yet). Captains pick a pairing and a
 * tee order and seal; everyone else sees who has sealed. When both are
 * in, the commissioner hands out the envelopes: each captain opens the
 * other side's sheet and reads it aloud. The second opening builds the
 * matches (server side, freeman-cup-sheets.sql) and every phone flips
 * to the match brief. Past 9:00 pm the deadline path does all of it.
 */
import React, { useEffect, useMemo, useState } from 'react';
import { supabase } from '../lib/supabase';
import type { EventData } from '../hooks/useEventData';
import type { DbPlayer, DbRound, DbTeam } from '../lib/types';
import type { Session } from '../lib/scoring';
import { sheetView, usedPairs, pairingOptions, clockLocal, type SheetView } from '../lib/sheets';

interface Props { data: EventData; round: DbRound; session: Session; reload: () => void; secondary?: boolean }

const first = (p: DbPlayer | undefined) => (p?.name || '').split(' ')[0];
const hcp = (p: DbPlayer | undefined) => (p ? Math.round(Number(p.handicap_index)) : '');
/** "Kyle 15" as name plus a small index, for the sheet where the captain is weighing lineups */
const Named = ({ p }: { p: DbPlayer | undefined }) => <>{first(p)}<small className="hi">{hcp(p)}</small></>;

export default function CaptainSheet({ data, round, session, reload, secondary = false }: Props) {
  const view = useMemo(() => sheetView({
    round, teams: data.teams, players: data.players, sheets: data.sheets, status: data.sheetStatus,
    mePlayerId: data.mePlayerId, meIsCommissioner: data.meIsCommissioner,   // the Reveal card only while acting as commissioner
    rounds: data.rounds, teeGroups: data.teeGroups, matches: data.matches,
  }), [round, data]);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const run = async (call: PromiseLike<{ error: { message: string } | null }>) => {
    if (data.offline) { setErr('Needs a signal. Sealing and opening go straight to the clubhouse; try again when you have one.'); return false; }
    setBusy(true); setErr(null);
    const { error } = await call;
    setBusy(false);
    if (error) {
      setErr(/fetch|network|load failed|timeout/i.test(error.message)
        ? 'Needs a signal. Nothing was sealed; try again when you have one.'
        : error.message);
      return false;
    }
    reload();
    return true;
  };

  // Past the deadline the first phone to look settles the round.
  useEffect(() => {
    if (view.pastDue && view.earlierPosted && !data.offline) supabase.rpc('sheet_tick', { r: round.id }).then(({ error }) => { if (!error) reload(); });
  }, [view.pastDue, round.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const names = (ids: string[]) => ids.map((id, i) => <span key={id}>{i > 0 && <i>&amp;</i>}<Named p={data.playerById[id]} /></span>);

  return (
    <div className={`hero brief capsheet${secondary ? ' secondary' : ''}`} id={secondary ? undefined : 'heroSlot'}>
      {err && <div className="holine err">{err}</div>}
      {data.offline && !err && view.stage !== 'waiting' && <div className="holine">Offline. Sealing and opening need a signal; everything here is read-only until it’s back.</div>}
      {view.stage === 'locked' && <Locked view={view} session={session} />}
      {view.canReveal && (
        <RevealCard view={view} busy={busy} onReveal={() => run(supabase.rpc('reveal_sheets', { r: round.id }))} />
      )}
      {view.stage === 'open' && view.myTeam && (
        <SheetEditor data={data} round={round} session={session} team={view.myTeam} view={view} busy={busy}
          onSeal={slots => run(supabase.rpc('seal_sheet', { r: round.id, slots }))} />
      )}
      {view.stage === 'sealed' && view.mine && (
        <Sealed view={view} session={session} names={names} />
      )}
      {view.stage === 'waiting' && <Waiting view={view} session={session} />}
    </div>
  );
}

function StatusRows({ view }: { view: SheetView }) {
  return (
    <div className="shstatus">
      {view.status.map(s => (
        <div key={s.team.id} className="shrow">
          <span className="who"><i className={`dot${s.sealed ? ' ok' : ''}`} />{s.team.name} · {first(s.captain || undefined) || 'captain'}</span>
          <span className={`st${s.sealed ? ' ok' : ''}`}>
            {!s.sealed ? 'Not sealed' : s.sealed.auto ? `Defaulted at ${clockLocal(view.due)}` : `Sealed ${clockLocal(s.sealed.sealed_at)}`}

          </span>
        </div>
      ))}
    </div>
  );
}

function RevealCard({ view, busy, onReveal }: { view: SheetView; busy: boolean; onReveal: () => void }) {
  const [sure, setSure] = useState(false);
  return (
    <div className="shcard commish">
      <div className="mmk">{view.bothSealed ? 'Both sheets are in' : 'Past the deadline'}</div>
      <div className="mmt">Ready to send</div>
      <div className="mml">
        {view.bothSealed
          ? 'Nobody has seen a lineup yet. Send builds the matches and drops a sealed letter on every phone: partner, opponents, tee time.'
          : 'A sheet is missing. Send fills it with the remaining pairing in roster order and posts the round.'}
      </div>
      {!sure
        ? <button className="abtn" onClick={() => setSure(true)}>Send pairings</button>
        : <div className="shconfirm">
            <button className="abtn" disabled={busy} onClick={onReveal}>{busy ? 'Sending…' : 'Yes, send the letters'}</button>
            <button className="aghost" onClick={() => setSure(false)}>Not yet</button>
          </div>}
      <div className="hint" style={{ padding: '10px 0 0', textAlign: 'center' }}>Commissioner only · can’t be undone</div>
    </div>
  );
}

function Locked({ view, session }: { view: SheetView; session: Session }) {
  return (
    <div className="mymatch">
      <div className="mmk">{session.rd} · {session.fmt}</div>
      <div className="mmt">Sheet opens when the round before posts</div>
      <div className="mml">The rotation check needs the earlier pairings on the record. Due {clockLocal(view.due)} course time; the app fills it in from there.</div>
    </div>
  );
}

function Waiting({ view, session }: { view: SheetView; session: Session }) {
  return (
    <div className="mymatch">
      <div className="mmk">{session.rd} · {session.fmt}</div>
      <div className="mmt">Pairings post tonight</div>
      <div className="mml">
        The captains are sealing their sheets. When both are in, a letter with your partner and your match lands on this phone, <b>{clockLocal(view.due)}</b> at the latest.
      </div>
      <StatusRows view={view} />
      <div className="mmst"><i className="ldot" /><span>{session.course} · {session.holes} holes · tees {session.tees.join(' and ')}</span></div>
    </div>
  );
}

function Sealed({ view, session, names }: { view: SheetView; session: Session; names: (ids: string[]) => React.ReactNode }) {
  const mine = view.mine!;
  return (
    <div className="mymatch">
      <div className="mmk locked"><LockIcon /> Sealed {clockLocal(mine.sealed_at)}</div>
      <div className="mmt">{view.status.find(s => s.team.id !== view.myTeam?.id)?.sealed ? 'Waiting on the send' : `Waiting on ${first(view.status.find(s => s.team.id !== view.myTeam?.id)?.captain || undefined)}`}</div>
      <div className="mml">Your sheet is in and can’t change. The letters go out when the commissioner sends, or at <b>{clockLocal(view.due)}</b>.</div>
      <div className="shsub">Your slots</div>
      {mine.slots.map((slot, i) => (
        <div key={i} className="shslot"><span className="tt">{teeFor(session, view.round, i)}<small>SLOT {i + 1}</small></span><span className={`pair ${view.myTeam?.side}`}>{names(slot)}</span></div>
      ))}
      <StatusRows view={view} />
    </div>
  );
}

function LockIcon() {
  return (
    <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true">
      <rect x="5" y="10.5" width="14" height="10" rx="2" /><path d="M8 10.5V7.5a4 4 0 0 1 8 0v3" />
    </svg>
  );
}

/** Tee time for slot i: team rounds slot i is group i; singles 1 and 2 go in group 1, 3 and 4 in group 2. */
function teeFor(session: Session, round: DbRound, i: number): string {
  const g = round.format === 'singles' ? Math.floor(i / 2) : i;
  return (session.tees[Math.min(g, session.tees.length - 1)] || '').replace(/\s*[AP]M$/i, '');
}

function SheetEditor({ data, round, session, team, view, busy, onSeal }: {
  data: EventData; round: DbRound; session: Session; team: DbTeam; view: SheetView; busy: boolean;
  onSeal: (slots: string[][]) => Promise<boolean>;
}) {
  const singles = round.format === 'singles';
  const mine = useMemo(() => data.players.filter(p => p.team_id === team.id), [data.players, team.id]);
  const used = useMemo(() => usedPairs(team, round, data.rounds, data.matches), [team, round, data.rounds, data.matches]);
  const options = useMemo(() => pairingOptions(mine, used), [mine, used]);
  const [pick, setPick] = useState(() => Math.max(0, options.findIndex(o => !o.used)));
  const [lead, setLead] = useState(0);                       // which pair takes slot 1
  const [order, setOrder] = useState<string[]>(() => [...mine].sort((a, b) => a.name.localeCompare(b.name)).map(p => p.id));
  const [sure, setSure] = useState(false);
  const by = (id: string) => first(data.playerById[id]);

  const slots: string[][] = singles
    ? order.map(id => [id])
    : (() => { const o = options[pick]; if (!o) return []; const [p, q] = o.pairs; return lead === 0 ? [p, q] : [q, p]; })();

  const move = (i: number, d: -1 | 1) => setOrder(o => {
    const j = i + d; if (j < 0 || j >= o.length) return o;
    const n = [...o]; [n[i], n[j]] = [n[j], n[i]]; return n;
  });

  return (
    <div className="mymatch">
      <div className="mmk">Captain’s sheet · {team.name}</div>
      <div className="mmt">{singles ? `Order your four for ${session.day}` : `Set your pairings for ${session.day}`}</div>
      <div className="mml">
        {singles
          ? 'Your 1 plays their 1, and so on. 1 and 2 go off first, 3 and 4 in the second group. Nobody sees this until both sheets are in.'
          : 'Two decisions: which pair plays, and who goes off first. Nobody sees this until both sheets are in.'}
      </div>

      {!singles && (
        <>
          <div className="shsub">Your pairing<small>Four players pair up three ways, and there are three team rounds, so each pairing plays once: pick from three tonight, two tomorrow, and Friday afternoon is whatever’s left. Saturday is singles; you’ll order your four instead.</small></div>
          {options.map((o, i) => (
            <button key={i} className={`shopt${i === pick ? ' sel' : ''}${o.used ? ' dim' : ''}`} disabled={o.used} onClick={() => setPick(i)} role="radio" aria-checked={i === pick}>
              <span className="rad" />
              <span className="pp">
                <span className={`pair ${team.side}`}><Named p={data.playerById[o.pairs[0][0]]} /> <i>&amp;</i> <Named p={data.playerById[o.pairs[0][1]]} /></span>
                <span className={`pair ${team.side}`}><Named p={data.playerById[o.pairs[1][0]]} /> <i>&amp;</i> <Named p={data.playerById[o.pairs[1][1]]} /></span>
                {o.used && <span className="used">Played together in {o.usedIn}</span>}
              </span>
            </button>
          ))}
          <div className="shsub">Tee order<small>Slot 1 plays {view.theirTeam?.name || 'their'} slot 1.</small></div>
          <div className="shslots">
            {slots.map((slot, i) => (
              <div key={i} className="shslot">
                <span className="tt">{teeFor(session, round, i)}<small>SLOT {i + 1}</small></span>
                <span className={`pair ${team.side}`}><Named p={data.playerById[slot[0]]} /> <i>&amp;</i> <Named p={data.playerById[slot[1]]} /></span>
              </div>
            ))}
            <button className="shswap" aria-label="Swap the tee order" onClick={() => setLead(l => (l === 0 ? 1 : 0))}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M7 4v16M7 20l-3-3M7 20l3-3M17 20V4M17 4l-3 3M17 4l3 3" />
              </svg>
            </button>
          </div>
        </>
      )}

      {singles && (
        <>
          <div className="shsub">Your order<small>Position 1 plays their 1. Use the arrows.</small></div>
          {order.map((id, i) => (
            <div key={id} className="shslot">
              {i % 2 === 0 && <span className="grpline">Group {i / 2 + 1} · {teeFor(session, round, i)}</span>}
              <span className="tt num">{i + 1}</span>
              <span className={`pair ${team.side}`}>{by(id)}</span>
              <span className="hc">{data.playerById[id]?.handicap_index}</span>
              <span className="arrows">
                <button aria-label="Move up" disabled={i === 0} onClick={() => move(i, -1)}>▲</button>
                <button aria-label="Move down" disabled={i === order.length - 1} onClick={() => move(i, 1)}>▼</button>
              </span>
            </div>
          ))}
        </>
      )}

      <StatusRows view={view} />
      <div className="shfoot">
        <div className="hint">Sealed sheets can’t be changed. The letters go out when the commissioner sends, or at {clockLocal(view.due)}.</div>
        {!sure
          ? <button className="abtn" disabled={!slots.length} onClick={() => setSure(true)}>Seal the sheet</button>
          : <div className="shconfirm">
              <button className="abtn" disabled={busy} onClick={async () => { if (!(await onSeal(slots))) setSure(false); }}>{busy ? 'Sealing…' : 'Seal it, no changes after'}</button>
              <button className="aghost" onClick={() => setSure(false)}>Let me look again</button>
            </div>}
      </div>
    </div>
  );
}
