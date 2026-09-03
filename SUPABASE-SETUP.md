# Supabase dashboard checklist — Sprint 2 auth

Do these in order. Items 1–3 now; 4–6 before invites go out Sep 27.

## Now

1. **Run the SQL.** SQL editor → paste `freeman-cup-auth.sql` → run once
   (done Aug 30). Then `freeman-cup-handoff.sql` → run once: logs every
   scorer switch to the feed and turns on realtime for `tee_group` and
   `feed_event`. Then `freeman-cup-commish.sql` → run once: adds
   `round.state` (Not started / Live / Complete) and the commissioner-only
   `reset_event()` behind "Clear all scores". Then `freeman-cup-shootout.sql`
   → run once: adds `event.shootout` (jsonb) with the commissioner-only
   `set_shootout()` RPC for the Captains Shootout, teaches `reset_event()`
   to clear it, and turns on realtime for `event` (run Sep 3). Then
   `freeman-cup-cards.sql` → run once: `tee_group.submitted_at/_by`
   (the signed-card lock), `submit_card()` / `reopen_card()`, the
   `card_in` feed trigger, `scores_this_match()` now honouring the
   hand-in, and `reset_event()` reopening every card (run Sep 3).
   Then `freeman-cup-aggregate.sql` → run once: widens `round.format`
   to allow `aggregate`, clears Round 2's old team-keyed test scores,
   and flips The Commons from foursomes to Aggregate Match Play (run
   Sep 3). Then `freeman-cup-seats.sql` → run once: commissioner-only
   `clear_seat()` behind the Unbind buttons in Settings → Seats — the
   in-app fix for stale test bindings before invites go out.

1b. **Site URL.** Authentication → URL Configuration → Site URL
   `https://freeman-cup.vercel.app`, and add `http://localhost:5173` to
   the redirect list. Until this is set, sign-in links bounce to
   localhost:3000 (done Aug 30).

1c. **Custom SMTP — done Sep 4.** Resend (domain thefreemancup.com,
   verified; sending-access API key), Supabase → Authentication →
   Emails → SMTP Settings: sender `no-reply@thefreemancup.com` /
   "The Freeman Cup", host `smtp.resend.com`, port 465, username
   `resend`, password = the Resend API key. Email OTP Length set to
   **6** under Sign In / Providers → Email (project default was 8;
   the app's code field expects 6). Magic Link template carries
   `{{ .Token }}` + `{{ .ConfirmationURL }}`. Verified end to end on
   the installed iPhone app: typed code signs in, no Safari.

2. **Turn signups off.** Authentication → Sign In / Providers → Email:
   disable "Allow new users to sign up". Sign-in emails then only go to
   auth users that already exist (the 8 test users, later the real 8).

3. **Put the code in the email.** Authentication → Emails → Templates →
   Magic Link: the body must include `{{ .Token }}` — that's the six-digit
   code the app asks for. Keep `{{ .ConfirmationURL }}` too for desktop.
   Example body:

   > Your Freeman Cup sign-in code is **{{ .Token }}**.
   > On a computer you can also just tap: {{ .ConfirmationURL }}

   Why the code matters: on iPhone the installed app has its own storage,
   so a link tapped in Mail signs in Safari, not the app. Typing the code
   inside the app is the reliable path.

## Before invites (by Sep 27)

4. **Custom SMTP.** Authentication → Emails → SMTP Settings: use Resend
   or Postmark with a verified sender. The default mailer rate-limits to
   a couple of emails an hour and lands in spam.

5. **Sessions ~90 days.** Authentication → Sessions: if the plan offers
   time-boxed sessions / inactivity timeout, set 90 days. If not, the
   default (refresh tokens don't expire) is fine for the trip — nobody
   gets signed out mid-round.

6. **Real seats.** For each of the other 7 players:
   - `update player set email = '...' where name = '...';`
   - Authentication → Users → Add user → their real email, any throwaway
     password (the form demands one; it is never used), Auto Confirm on.
   - If the row's `auth_uid` is already set from Sprint 1 testing (Devin,
     Matt), clear it first: `update player set auth_uid = null where name = '...';`
     A claimed seat is never rebound automatically.

   Check with:
   ```sql
   select p.name, p.email, p.auth_uid, u.email as auth_email
   from player p left join auth.users u on u.id = p.auth_uid order by p.name;
   ```

## Local dev

`npm run dev` shows a dashed dev row on the sign-in screen — one tap
signs in as any seed player (password auth, test accounts only). It is
compiled out of production builds.

## Sign-in code email template (Sep 3 2026)

The styled sign-in email lives at `emails/signin-code.html`. To install it:
1. Push so `public/email/email-badge.png` and `public/email/email-jug.png` deploy (the email loads its images from the production URL).
2. Supabase Dashboard -> Authentication -> Email Templates -> **Magic Link**.
3. Set the subject to: `Your Freeman Cup code: {{ .Token }}`
4. Replace the message body with the full contents of `emails/signin-code.html` (it keeps `{{ .Token }}` in two places: the hidden preview line and the code box).
5. Save, then request a code from the app to test.

Final design (Sep 3, after on-device Gmail iOS testing): the masthead is
ink green with the brass badge, gradient-locked (safe because it holds no
text; Gmail defeats locks only by inverting text). The body ships light in
an app-hue green so Gmail dark inverts it into a near-app dark green:
dark phones get dark, light phones get light. Apple Mail shows the light
body regardless of theme (it never inverts colored emails); accepted.
Assets: email-badge.png (brass), email-jug-mid.png (mid green #75897F),
both under public/email/. Blend-mode and full-page lock hacks were tried
and are defeated by 2026 Gmail; do not resurrect them.

Note: "good for the next hour" in the copy matches the default Email OTP expiry (3600s). If that setting changes, update the sentence.
