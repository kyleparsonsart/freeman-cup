# Supabase dashboard checklist — Sprint 2 auth

Do these in order. Items 1–3 now; 4–6 before invites go out Sep 27.

## Now

1. **Run the SQL.** SQL editor → paste `freeman-cup-auth.sql` → run once.
   Adds `claim_seat()`, which binds a signed-in account to the player row
   with the matching email on first load.

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

6. **Real seats.** Replace the placeholder emails in `player` (SQL
   editor: `update player set email = '...' where name = '...';`), then
   Authentication → Users → Add user → Create new user for each of the 8
   real emails with "Auto Confirm User" on (signups are off, so accounts
   must be pre-created). No passwords needed — they sign in by code.

## URL configuration (check once)

Authentication → URL Configuration: Site URL `https://freeman-cup.vercel.app`,
and add `http://localhost:5173` to the redirect allow list for dev.

## Local dev

`npm run dev` shows a dashed dev row on the sign-in screen — one tap
signs in as any seed player (password auth, test accounts only). It is
compiled out of production builds.
