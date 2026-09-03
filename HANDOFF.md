# The Freeman Cup 2026 — session handoff
**Updated Aug 31, 2026. Trip is Oct 8–10. Ship by Oct 7. Feature freeze Sun Sep 13.**

Read this first, then `SUPABASE-SETUP.md`. The prototype `freeman-cup-v66.html` is still the design spec.

---

## Where the build is

**Sprint 1 done (Aug 30).** Scoring engine ported verbatim, 21 unit + 12 RLS tests, scoring screen live, deployed.

**Sprint 2 done (Aug 31), 13 days ahead of the freeze.**

| | |
|:--|:--|
| Service worker | vite-plugin-pwa, app shell + Google Fonts precached, autoUpdate. Icons: The Lassie in brass on green (`public/icons/`) |
| Write queue | `src/lib/writeQueue.ts` + `db.ts`. IndexedDB, one row per (match_id, hole), latest wins. Flush on open / reconnect / focus / 20 s timer. Snapshot of last good fetch so the app opens with data offline. Hole header shows "N to sync" / "offline" |
| Auth | Magic-link email → six-digit code typed in the app (iOS standalone PWA has its own storage, so a tapped link signs in Safari, not the app). `claim_seat()` binds the account to the player row by email, one-way. Signups off. Dev-only password row for the seed test accounts |
| Scorer handoff | Switch/Cancel on the scorer line for scorer or commissioner, picker per prototype. Trigger logs every switch to `feed_event` (kind `scorer_switch`); "Taken over from X by Y" line. Realtime on `tee_group` flips lock state on other phones |
| Commissioner settings | Gear in header. Account + sign out for everyone. Commissioner: round state (`round.state`: upcoming / live / final, trigger keeps `locked` in step), scorer per tee group, pairings per match (+ foursomes odd-hole pickers), Clear all scores via `reset_event()` behind two taps |
| Live tab (Aug 31) | Cup strip + feed. The feed is **derived** from match_hole (real `updated_at` timestamps) plus scorer switches from feed_event, in `src/lib/feed.ts`: round under way, holes won with birdie/eagle tags, dormie, match finals, lead changes, the clinch, last group in. A correction re-derives, so edit-in-place is free. No hole/match rows are written to feed_event; push (if built) needs its own server-side events |
| Schedule tab (Aug 31) | Day rows, round cards (Live / Final / To play pill, score line), match rows that expand to the full read-only scorecard (`Scorecard.tsx`, port of `cardGrid`), rosters by index, Captains Shootout bar. Commissioner tap-to-edit cells from the prototype were left out; scores are corrected on the Scoring tab |
| Design system (Aug 31) | `/designsystem`, public, Dado-style. Reads every `--token` from the running stylesheet (so it cannot drift), computes contrast live, type roles + specimens, form and layout, every component with sample data, voice, "how this stays true". Dark / Light switch in its header. `src/designsystem/`, `vercel.json` rewrite for the route |
| Light mode (Aug 31) | `src/lib/theme.ts`; Appearance switch in settings for everyone; per-device, applied before first paint; theme-color meta follows. The prototype's `body.light` rules do the rest |
| Recap moments (Sep 2) | `src/lib/moments.ts` + `Moments.tsx`: three full-screen takeovers derived like the feed — day in the book, cup won (bone inversion, MVP by lowest full-card net vs par over own-ball rounds), and the 5–5 Captains Shootout intro. Auto-open once per device (localStorage `fc-moments-seen`), weighted cup → shootout → latest day. Homes after dismissal: pinned `.duelbar` under the strip while the shootout is unresolved, the strip as trophy case once decided (tap → finale), big feed cards that reopen each moment, `Recap ›` chips on finished Schedule day rows. Commissioner enters the shootout (3 strokes per captain, max 5) in Settings via `set_shootout()`; realtime on `event` carries it everywhere. Level putts stay pending — replay hole 3 and re-save |
| Scorekeeper fixes (Sep 3) | Five fixes from walking the scorer's round. (1) `.gapbar`: one amber bar when a hole behind the frontier lacks a result (spans both matches of the group), Fix now jumps to it. (2) Blocked scores: the write queue keeps server-refused rows flagged `blocked` (never silently dropped), retries them after fresh rows, shows them in an amber card with entries + reason; `dismissBlocked()` is the only deletion. (3) Signed-card rule: `submit_card()` stamps `tee_group.submitted_at`, RLS then locks the group's scores for all but the commissioner; Submit scores on the last hole (disabled with honest labels while holes are open / rows unsynced / blocked), success opens the card-in drawer (results, day totals, sync check); commissioner reopens from Settings; `card_in` feed line via trigger. (4) Bye bar reworded with bye progress — byes feed day totals and MVP's full-card rule. (5) Full-width next-hole advance where the thumb is; the old header link removed. `src/lib/card.ts` holds the pure card-state helpers |
| Player fixes (Sep 3) | Three fixes from walking the week as a non-scorer. (1) Read-only taps answered: `.ro` no longer kills pointer events; a tap shows "{Scorer} has the pencil" (or the card-in / no-scorer variant) for ~2.4s. (2) The races on Schedule replaces Rosters + "If we finish level" (both removed; the tiebreak lives in the shootout moment): `src/lib/standings.ts` — MVP board (net vs par, own-ball rounds, full-card eligibility, short cards shown struck through) + Player of the Round per Complete own-ball round; moments' finale MVP now reads from the same board. (3) Pre-round match brief: until a round goes live the hero shows opponent, group tee time, stroke holes from strokeMap, and the scorer; scorer/commissioner get "Open the scorecard anyway" |
| Tests | 64 unit (21 scoring + 14 write queue + 8 feed + 6 moments + 6 card + 5 standings + 4 moment overlays). 12 RLS integration tests unchanged; run `npm test` from a real terminal (sandboxed agents can't reach Supabase) |

SQL that has run, in order: `freeman-cup-schema.sql`, `freeman-cup-auth.sql`, `freeman-cup-handoff.sql`, `freeman-cup-commish.sql`, `freeman-cup-shootout.sql` (run Sep 3), `freeman-cup-cards.sql` (**Sep 3 — not yet run; paste into the SQL editor once**). Each is the record of what ran; don't re-run the schema.

---

## Not built

- **Push notifications** — the whole system: VAPID keys, `push_subscription` writes, a server-side sender (Edge Function or Vercel function), the 90-second hold, tiering. Biggest remaining risk to the date; a legitimate 2027 candidate
- **Rules & Scoring** guide sheet (book icon in the prototype header)

---

## Not code, and blocking real use

1. **Custom SMTP** (Resend or Postmark). Supabase locks email templates behind it, and the six-digit code only appears in the email once `{{ .Token }}` is in the template. Until then sign-in works by tapped link in a browser only, not inside the installed iPhone app. Steps in `SUPABASE-SETUP.md`.
2. **Seven real emails.** Player rows still carry `@example.com` for everyone but Kyle. Each needs a pre-created auth user (signups are off). Devin and Matt have `auth_uid` bound to test accounts; clear before claiming.
3. **Two-phone test.** Sign in as two players, Switch the scorer, score a hole in airplane mode, come back online, watch it sync. Nothing here has been exercised with two real devices yet.

---

## Decisions made this sprint (in addition to the original list)

- **No "Picked up".** Removed Sep 1. Every player holes out or the scorer enters what they would have made; the engine still tolerates an `X` in old rows.
- **Cup strip lives on Live only**, flush to the top with the gear over it. Scoring's header is `Round 3 · Sand Valley`; Schedule's is `The Freeman Cup 2026`.
- **The page scroller's indicator is hidden**; it drew behind sticky and side-scrolling children on iOS.
- **The ruled field is gone** (Sep 1). Page, header and tab bar are plain ink; `board-on` is no longer set on body. `--board` still colours the scorer bar.
- **Page card tried and reverted** (Sep 1, `4596dee` / `5b19f01`). Full width stays: big targets on the course.

- **Code entry over link tap** for sign-in, because of the iOS storage container. Both are sent; the app asks for the code.
- **A claimed seat is never rebound automatically.** Commissioner clears `auth_uid` by hand if someone changes address.
- **Switch is shown to the scorer and the commissioner only** (prototype). The RLS policy is looser (anyone in the group) so the dead-phone case can be widened in the UI without a migration if the dress rehearsal calls for it.
- **A server-rejected queued write is dropped, not retried forever** (e.g. RLS after a handoff). Logged to console; the reload shows server truth.
- **Handoffs need a signal.** They go straight to `tee_group`, not through the queue, and say so when offline.
- **Kept `public/manifest.json`** as the manifest rather than letting the plugin generate a second one.

---

## Things that bit

- `git commit` with nothing staged commits nothing and `git push` then says up to date. Stage first.
- Supabase **Site URL** defaults to `localhost:3000`; magic links bounce there until it's set.
- Pasting SQL from chat can turn `'` into curly quotes. Copy from the `.sql` files in the repo.
- The Add user form demands a password; any throwaway works, the app never uses it.
- Agents running in a sandbox that can't delete files leave `.git/*.lock` and `.git/stale-*` behind; `rm .git/stale-*` when git complains.

The original warnings still stand: don't let anyone rewrite `calc()` or `derive()`; RLS that silently returns empty sets is the standard failure; copy the stylesheet, don't translate it; scope creep is the biggest risk to Oct 7.

---

## The event (unchanged)

Eight men, two teams, four rounds at Sand Valley, playing for **The Lassie**. Ten points, 5½ wins. Vikes (red): Griffin S. 15 (C), Devin E. 7, Brian K. 6, Matt J. 15. Celts (blue): Kyle P. 15 (C, commissioner), Phil J. 11, Justin D. 7, JT W. 15. Thu Mammoth Dunes four-ball; Fri The Commons foursomes (12 holes) then Sand Valley four-ball; Sat Sedge Valley singles. Tie at 5–5 goes to the Captains Shootout on the practice green.

Three tabs: **Live · Scoring · Schedule.** Dark scorecard green, bone, brass; Young Serif (display, one weight, self-hosted Latin subset in `public/fonts/`, replaced Fraunces Sep 1) / Work Sans / Barlow Condensed; sentence case.
