/**
 * /api/send-mail: the one place email leaves the Freeman Cup.
 *
 * A Vercel serverless function (deploys with the app; no Supabase CLI).
 * The app renders the emails on the commissioner's phone and posts them
 * here; this function checks the caller is the commissioner, only ever
 * sends to the players' own addresses (or to the commissioner for a
 * test), refuses to send the same real thing twice, relays to Resend,
 * and logs the send to feed_event as kind 'mail_sent'.
 *
 * Environment (Vercel project settings):
 *   SUPABASE_URL              the project URL (VITE_SUPABASE_URL also works)
 *   SUPABASE_SERVICE_ROLE_KEY service role key, server only, never in the client
 *   RESEND_API_KEY            the Resend key already used for SMTP
 */
import { createClient } from '@supabase/supabase-js';

const FROM = 'The Freeman Cup <no-reply@thefreemancup.com>';
const MAX = 20;

interface Mail { to: string; subject: string; html: string }
interface Body { kind: string; key: string; roundId?: string | null; test: boolean; mails: Mail[] }

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only.' });
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const service = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const resend = process.env.RESEND_API_KEY;
  if (!url || !service || !resend) return res.status(500).json({ error: 'Mail is not configured on the server: set SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY and RESEND_API_KEY in Vercel.' });

  const token = String(req.headers.authorization || '').replace(/^Bearer\s+/i, '');
  if (!token) return res.status(401).json({ error: 'Not signed in.' });
  const admin = createClient(url, service, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data: { user }, error: uerr } = await admin.auth.getUser(token);
  if (uerr || !user) return res.status(401).json({ error: 'Not signed in.' });

  const { data: me } = await admin.from('player').select('id,email,event_id,is_commissioner').eq('auth_uid', user.id).maybeSingle();
  if (!me?.is_commissioner) return res.status(403).json({ error: 'Only the commissioner sends email.' });

  let body: Body;
  try { body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body; } catch { return res.status(400).json({ error: 'Bad request.' }); }
  const { kind, key, test } = body || {};
  const mails = Array.isArray(body?.mails) ? body.mails : [];
  if (!kind || !key || !mails.length) return res.status(400).json({ error: 'Nothing to send.' });
  if (mails.length > MAX) return res.status(400).json({ error: `At most ${MAX} emails per send.` });
  if (mails.some(m => !m.to || !m.subject || !m.html || m.html.length > 200_000)) return res.status(400).json({ error: 'A message is missing a recipient, subject or body.' });

  // recipients are the players' own addresses, or the commissioner alone for a test
  const { data: players } = await admin.from('player').select('email').eq('event_id', me.event_id);
  const allowed = new Set((players || []).map(p => String(p.email).toLowerCase()));
  const bad = mails.filter(m => test ? m.to.toLowerCase() !== me.email.toLowerCase() : !allowed.has(m.to.toLowerCase()));
  if (bad.length) return res.status(400).json({ error: test ? 'A test goes only to you.' : `Not a player address: ${bad[0].to}` });

  if (!test) {
    const { data: prior } = await admin.from('feed_event').select('id,occurred_at').eq('event_id', me.event_id).eq('kind', 'mail_sent')
      .eq('body->>mail', kind).eq('body->>key', key).eq('body->>test', 'false').limit(1);
    if (prior && prior.length) return res.status(409).json({ error: 'Already sent.' });
  }

  const r = await fetch('https://api.resend.com/emails/batch', {
    method: 'POST',
    headers: { authorization: `Bearer ${resend}`, 'content-type': 'application/json' },
    body: JSON.stringify(mails.map(m => ({ from: FROM, to: [m.to], subject: m.subject, html: m.html }))),
  });
  if (!r.ok) {
    const detail = await r.text().catch(() => '');
    return res.status(502).json({ error: `Resend refused the send (${r.status}). ${detail.slice(0, 200)}` });
  }

  await admin.from('feed_event').insert({
    event_id: me.event_id, round_id: body.roundId || null, kind: 'mail_sent', tier: 'none',
    body: { mail: kind, key, test: !!test, count: mails.length, to: mails.map(m => m.to), by: me.id },
  });
  return res.status(200).json({ sent: mails.length });
}
