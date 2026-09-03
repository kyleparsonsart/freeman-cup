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
   hand-in, and `reset_event()` reopening every card.

1b. **Site URL.** Authentication → URL Configuration → Site URL
   `https://freeman-cup.vercel.app`, and add `http://localhost:5173` to
   the redirect list. Until this is set, sign-in links bounce to
   localhost:3000 (done Aug 30).

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
