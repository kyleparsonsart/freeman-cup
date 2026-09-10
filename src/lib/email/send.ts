/**
 * Hand rendered emails to /api/send-mail, which checks the caller is the
 * commissioner, refuses a second real send of the same thing, relays to
 * Resend, and logs the send to feed_event as kind 'mail_sent' so every
 * phone can show "Pairings emailed 8:31 pm".
 */
import { supabase } from '../supabase';
import type { EventData } from '../../hooks/useEventData';
import type { Mail } from './emails';

export type MailKind = 'pairings' | 'recap' | 'finale' | 'week';

export interface SendRequest {
  kind: MailKind;
  /** what this is a send of: a round id, a day, or 'cup' / 'week' */
  key: string;
  roundId?: string | null;
  /** a test goes only to the commissioner and is not counted as sent */
  test: boolean;
  mails: Mail[];
}

export async function sendMail(req: SendRequest): Promise<{ sent: number }> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error('Not signed in.');
  const r = await fetch('/api/send-mail', {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${session.access_token}` },
    body: JSON.stringify(req),
  });
  const body = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(body.error || `Send failed (${r.status}).`);
  return body as { sent: number };
}

/** When a real send of this kind and key went out, from the feed_event log; null if it hasn't. */
export function sentAt(d: EventData, kind: MailKind, key: string): string | null {
  const row = d.mailSent.find(e => e.body.mail === kind && e.body.key === key && !e.body.test);
  return row ? row.occurred_at : null;
}

/** A test copy: the commissioner's own copy of the batch, addressed to him. */
export function testCopy(d: EventData, mails: Mail[]): Mail[] {
  const me = d.playerById[d.mePlayerId];
  if (!me?.email || !mails.length) return [];
  const mine = mails.find(m => m.to.toLowerCase() === me.email.toLowerCase()) || mails[0];
  return [{ ...mine, to: me.email, subject: `[Test] ${mine.subject}` }];
}
