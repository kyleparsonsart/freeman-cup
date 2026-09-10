# Mail setup

How the Freeman Cup's email goes out, and the one-time setup to turn it on.
Everything here is done once; after that, sending is a button in the app.

## What sends what

| Email | Who gets it | How it goes |
|---|---|---|
| Sign-in code | whoever signs in | Supabase auth over Resend SMTP (live since Sep 4) |
| Invitation (Celts / Vikes) | each team, Sep 27 | Resend broadcast from `emails/invite-celts.html` and `emails/invite-vikes.html` |
| One week out | everyone, Oct 1 | the app: Today tab, Emails, Send to everyone |
| Pairings | each player, the night before a round | the app, after Send Pairings for that round |
| Day recap | everyone, each night once the cards are in | the app |
| Finale | everyone, once the Cup is decided | the app |

The four app emails render on your phone from live data and are relayed by
`api/send-mail.ts`, a Vercel function that checks you are the commissioner,
sends only to player addresses (or to you for a test), refuses a second real
send of the same thing, and logs each send to `feed_event` as `mail_sent`.

## One-time setup (about ten minutes)

1. **Push the repo.** Vercel picks up `api/send-mail.ts` automatically; nothing
   to configure for the function itself.

2. **Add three environment variables in Vercel.** Project, Settings,
   Environment Variables, for Production (add Preview too if you test on
   preview deploys):
   - `SUPABASE_URL`: the project URL, the same value as `VITE_SUPABASE_URL`.
   - `SUPABASE_SERVICE_ROLE_KEY`: Supabase Dashboard, Project Settings, API,
     "service_role" secret. Server only; it never reaches the browser.
   - `RESEND_API_KEY`: the same key the SMTP settings use. It needs sending
     access (the default "Full access" key is fine).

3. **Redeploy** (Deployments, the latest one, Redeploy). Environment variables
   only apply to builds made after they were added.

4. **Send yourself a test.** Open the app signed in as yourself, gear, Today,
   scroll to Emails, and on "One week out" press *Send me a test*. It should
   arrive within a minute from The Freeman Cup <no-reply@thefreemancup.com>.
   If the row says mail is not configured, a variable is missing or the
   redeploy has not finished.

5. **Check Gmail dark once.** Forward the test to a Gmail address (or send a
   test to yourself while your player row carries a Gmail address), open it
   in the Gmail app in dark mode, and confirm the masthead stays green and the
   body reads on the pale ground. The Mail Room prototype is an approximation
   of this; the real send is the truth.

6. **Re-paste the sign-in template.** The masthead and wallpaper changed on
   Sep 10. Supabase Dashboard, Authentication, Email Templates, Magic Link:
   paste the contents of `emails/signin-code.html` over the body and save.
   The `{{ .Token }}` placeholder is in the file already.

## Before the invitations (Sep 27)

1. In `emails/invite-celts.html` and `emails/invite-vikes.html`, fill in the
   teammate lines (marked with an HTML comment). The Celts file already lists
   Kyle.
2. In Resend, create an audience with the seven contacts and their first
   names; the files use the `{{{FIRST_NAME|gentlemen}}}` merge tag.
3. Send each file as a broadcast to its team's segment. Send yourself a test
   broadcast first; Resend has a "send test" on the broadcast screen.
4. Before any of this, the player rows need real addresses (Seats on the
   Event tab) and pre-created auth users, per HANDOFF.

## During the trip

- **Pairings.** Send Pairings as usual. Then Today, Emails, the round's row:
  *Send me a test* shows you your own letter; *Send to everyone* sends each
  player his. The row then reads "Sent 8:31 pm" on every phone.
- **Day recap.** The row unlocks when every card for the day is in. Test it,
  read it, then send. It never goes on its own.
- **Finale.** Unlocks once the Cup is decided (on the course or on the
  practice green). Same two buttons.
- A real send can only happen once per email. If something is wrong after a
  send, fix the data and ask me; there is no resend button by design.

## If something fails

- "Mail is not configured on the server": a Vercel variable is missing, or
  the deploy predates it.
- "Only the commissioner sends email": you are signed in as someone else, or
  your player row lost `is_commissioner`.
- "Not a player address": a player row's email is not what the render used;
  check Seats.
- "Already sent": the log in `feed_event` has a real send for this email.
- "Resend refused the send": the message from Resend follows; usually a key
  without sending access or a domain issue. The domain is verified, so the
  key is the first thing to check.
