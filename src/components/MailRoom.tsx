/**
 * The mail room, on the commissioner's Today tab: every email the week
 * sends, with a test to yourself and a send to everyone. Nothing here is
 * automatic; the server refuses a second real send of the same thing.
 */
import { useState } from 'react';
import type { EventData } from '../hooks/useEventData';
import type { MomentsState } from '../lib/moments';
import { pairingsMail, recapMail, finaleMail, weekOutMail, type Mail } from '../lib/email/emails';
import { sendMail, sentAt, testCopy, type MailKind } from '../lib/email/send';
import { clockLocal } from '../lib/sheets';

interface Item {
  id: string; kind: MailKind; key: string; roundId?: string | null;
  title: string; sub: string; ready: boolean; build: () => Mail[];
}

export default function MailRoom({ data, moments, reload }: { data: EventData; moments: MomentsState | null; reload: () => void }) {
  const [busy, setBusy] = useState<string | null>(null);
  const [note, setNote] = useState<{ id: string; text: string; err?: boolean } | null>(null);
  const [arm, setArm] = useState<string | null>(null);
  const course = (rid: string) => data.scoringSessions.find(s => s.id === rid)?.course || '';
  const real = data.players.filter(p => p.email && !p.email.endsWith('@example.com')).length;

  const items: Item[] = [];
  data.rounds.slice().sort((a, b) => a.seq - b.seq).forEach(r => {
    const posted = !!r.revealed_at && data.matches.some(m => m.round_id === r.id);
    const over = r.state === 'final';
    items.push({
      id: `pairings:${r.id}`, kind: 'pairings', key: r.id, roundId: r.id,
      title: `Pairings · ${r.label}`, sub: over ? `${course(r.id)} · round is in the book` : posted ? `${course(r.id)} · one email per player` : 'Unlocks when you Send Pairings',
      ready: posted && !over, build: () => pairingsMail(data, r),
    });
  });
  const days = [...new Set(data.scoringSessions.map(s => s.day))];
  days.forEach(day => {
    const dm = moments?.days.find(x => x.day === day);
    items.push({
      id: `recap:${day}`, kind: 'recap', key: day, title: `Day recap · ${day.split(' ')[0]}`,
      sub: dm ? 'Every card for the day is in' : 'Unlocks when the day’s cards are in', ready: !!dm, build: () => recapMail(data, day),
    });
  });
  items.push({ id: 'finale', kind: 'finale', key: 'cup', title: 'The finale', sub: moments?.won ? 'The Cup is decided' : 'Unlocks when the Cup is decided', ready: !!moments?.won, build: () => finaleMail(data) });
  items.push({ id: 'week', kind: 'week', key: 'week', title: 'One week out', sub: 'The schedule, the countdown, the home-screen reminder', ready: true, build: () => weekOutMail(data) });

  const go = async (it: Item, test: boolean) => {
    setNote(null); setArm(null); setBusy(it.id + (test ? ':t' : ''));
    try {
      const all = it.build();
      const mails = test ? testCopy(data, all) : all;
      if (!mails.length) throw new Error(test ? 'Your seat has no email address.' : 'No player has a real email address yet.');
      const { sent } = await sendMail({ kind: it.kind, key: it.key, roundId: it.roundId ?? null, test, mails });
      setNote({ id: it.id, text: test ? 'Test sent to you.' : `Sent to ${sent}.` });
      reload();
    } catch (e) {
      setNote({ id: it.id, text: e instanceof Error ? e.message : String(e), err: true });
    } finally { setBusy(null); }
  };

  return (
    <>
      <div className="grp">
        <h3>Emails</h3>
        <div className="hint">
          Each one renders from the live data the moment you press it. A test goes to
          you alone and can be repeated; Send goes to every player with a real address
          ({real} of {data.players.length}) and only ever once.
        </div>
      </div>
      {items.map(it => {
        const at = sentAt(data, it.kind, it.key);
        const n = note?.id === it.id ? note : null;
        return (
          <div key={it.id} className={`mailrow${it.ready ? '' : ' off'}`}>
            <div className="mt">{it.title}</div>
            <div className="ms">{at ? `Sent ${clockLocal(at)}` : it.sub}</div>
            {it.ready && (
              <div className="ma">
                <button className="unbind" disabled={!!busy} onClick={() => go(it, true)}>{busy === it.id + ':t' ? 'Sending…' : 'Send me a test'}</button>
                {!at && (arm === it.id
                  ? <>
                      <span className="ms">Send to {real}?</span>
                      <button className="unbind go" disabled={!!busy} onClick={() => go(it, false)}>{busy === it.id ? 'Sending…' : 'Yes, send'}</button>
                      <button className="unbind" onClick={() => setArm(null)}>No</button>
                    </>
                  : <button className="unbind go" disabled={!!busy || real === 0} onClick={() => setArm(it.id)}>Send to everyone</button>)}
              </div>
            )}
            {n && <div className={`ms${n.err ? ' err' : ' ok'}`}>{n.text}</div>}
          </div>
        );
      })}
    </>
  );
}
