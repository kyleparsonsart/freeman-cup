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
| Moments (Sep 8) | `src/lib/cards.ts` + `ShareCard.tsx`: full-screen 9:16 posters derived from the data (a correction re-derives them), designed to be screenshotted, one Close button: match result (hole-by-hole strip), day recap, finale, Captains Shootout, player card (handicap and first tee before the trip; record, holes won, birdies, closeout, streak, best hole and partners once golf is played), state of the Cup mid-round, and feed spikes (eagle, four in a row, walk-off). Keys ride the moments slot in App (`match:<id>`, `day:<day>`, `won`, `shootout`, `player:<key>`, `live`, `spike:<type>:<matchId>:<hole>`). Only two auto-open: the match result once for the players in it when the card is handed in (`fc-cards-seen`), and the day recap. Homes: Schedule `Card ›` chip on every finished row, `Recap ›` chip on day rows, brass banner + shootout row once the Cup is decided, and **The field** (names → player card; the only pre-trip entry). Live: share icon in the header while matches are on the course, brass-edged spike feed lines, match finals. A DOM-to-PNG Share button was built and removed the same day (`.ds-preview21/poster.ts.retired`) |
| Tab switch (Sep 8) | One brass `.tabbar` slides between the tabs; the header title eases in from the direction of travel (`.hdtext.from-right/left`). **Do not animate the views themselves with a transform**: iOS Safari kept a composited layer on the animated view and text changes inside the `.tgs` score scrollers stopped repainting (a new hole showed the previous hole's numbers in some cells). Seen and fixed on Sep 8 |
| Scorekeeper fixes (Sep 3) | Five fixes from walking the scorer's round. (1) `.gapbar`: one amber bar when a hole behind the frontier lacks a result (spans both matches of the group), Fix now jumps to it. (2) Blocked scores: the write queue keeps server-refused rows flagged `blocked` (never silently dropped), retries them after fresh rows, shows them in an amber card with entries + reason; `dismissBlocked()` is the only deletion. (3) Signed-card rule: `submit_card()` stamps `tee_group.submitted_at`, RLS then locks the group's scores for all but the commissioner; Submit scores on the last hole (disabled with honest labels while holes are open / rows unsynced / blocked), success opens the card-in drawer (results, day totals, sync check); commissioner reopens from Settings; `card_in` feed line via trigger. (4) Bye bar reworded with bye progress — byes feed day totals and MVP's full-card rule. (5) Full-width next-hole advance where the thumb is; the old header link removed. `src/lib/card.ts` holds the pure card-state helpers |
| Player fixes (Sep 3) | Three fixes from walking the week as a non-scorer. (1) Read-only taps answered: `.ro` no longer kills pointer events; a tap shows "{Scorer} has the pencil" (or the card-in / no-scorer variant) for ~2.4s. (2) The races on Schedule replaces Rosters + "If we finish level" (both removed; the tiebreak lives in the shootout moment): `src/lib/standings.ts` — MVP board (net vs par, own-ball rounds, full-card eligibility, short cards shown struck through) + Player of the Round per Complete own-ball round; moments' finale MVP now reads from the same board. (3) Pre-round match brief: until a round goes live the hero shows opponent, group tee time, stroke holes from strokeMap, and the scorer; scorer/commissioner get "Open the scorecard anyway" |
| The rulebook (Sep 7) | `src/lib/rulebook.ts` (ten articles as data + plain-word search with a synonym map, `searchRules`/`highlight`, 10 unit tests) and `src/components/Rulebook.tsx` (full sheet off the book icon in `.hdicons`, every tab, works offline and before data lands). Search first, quick chips, contents, article view with short ruling then long version and Art. cross-links. Content settled with Kyle Sep 7: GHIN frozen before the trip, full-difference strokes off the low player, gimmes inside the leather, pick up at +2 for par plus four, lost/OB drop and two, one optional first-tee mulligan, aggregate = both nets added, captains rule disputes together and a deadlock halves the hole, pairings kept to one neutral line. Still open in the text: the sand rule (Art. 6.3 says it's posted before Thursday), the exact handicap freeze date (written as the Friday before), the four tees. The same data is meant to feed thefreemancup.com/rules later. |
| The captain's sheet (Sep 7) | Pairings are no longer seeded; captains make them in the app the night before. `freeman-cup-sheets.sql` (Kyle runs; tested end to end against Postgres 16 locally): `captain_sheet` table + RLS (own sheet always, all once matches exist; nobody reads the other lineup before it's read out), `sheet_status()` (metadata only), `seal_sheet(r, slots)` validates the rotation (no pair twice across the team rounds, every player once) and is one-shot, `reveal_sheets(r)` (Send) commissioner-only, needs both sheets unless past the deadline, and runs `build_round_matches` itself; `open_envelope`/`commish_open_for` remain for older builds but nothing calls them (slot i → match i, tee group i; singles 1–2 group 1, 3–4 group 2; Vikes side_a, Celts side_b), `sheet_tick(r)` settles a round after 9:00 pm Chicago the evening before (defaults a missing sheet to the first unused pairing in roster order, reveals, opens, builds). A trigger nudges `round` on every sheet write so non-captains get realtime without reading sheets. `reset_event` now clears sheets, matches and `round.revealed_at`. The seeded matches must be deleted once by hand (block at the bottom of the file). App: `src/lib/sheets.ts` (`sheetDue`, `usedPairs`, `pairingOptions`, `sheetView`, 10 tests), `src/components/CaptainSheet.tsx` rendered by ScoringScreen whenever the current round has no matches: editor (pairing radios + tee order, or singles order with arrows) → sealed/waiting; the letter is `src/lib/letters.ts` + `src/components/Letter.tsx`, a full-screen moment (`.envmo`) App opens once per device (`fc-letters-seen`) for the latest sent round with no scores yet, partner then opponents, strokes and dots in the fine print; non-captains see "Pairings post tonight" with seal status; the commissioner gets a Reveal card when both are in or past due. `useEventData` fetches `captain_sheet` + `sheet_status`, realtime on `captain_sheet` and all `match` events. Schedule/scoreboard tolerate rounds with no matches. Gaps closed after the flow review: a second round on the same day (R3) is due 90 min before its first tee, not 9 pm, and its sheet appears under the morning round's brief once that round has posted (a sheet can't be sealed until every earlier round has matches, since the rotation check reads them); `build_round_matches` re-seats the pencil (keeps the seeded scorer if he's in his group, else the first Celt in the group); the Reveal card shows only while acting as commissioner (Kyle's call, Sep 8: no reveal button for anyone in player view). Sep 8 design pass (Kyle): Submit is one tap labelled Submit Pairings; the Send Pairings footer lives inside the sealed hero (no separate card) and only while acting as commissioner; singles never locks on earlier rounds and the locked copy names the round it waits on; Send re-seats the pencil quietly (`fc.silent` GUC skips `log_scorer_handoff`) and leaves it empty unless the seeded scorer is still in his group, with a Take-it link for group members in the brief and the pencil bar; rounds without pairings show TBD rows with real tee times on Schedule and the scoreboard; the cup strip counts the planned ten points from the start. Sep 8: `unseal_sheet(r, t)` (commissioner; deletes the sheet, undoes the reveal and re-closes the other envelope; only while no matches) with an Unseal control under Settings → Setup → Captain's sheets; seal/reveal/open refuse offline with a plain message; "Clear all scores" is the one-time step that retires the seeded pairings. |
| Aggregate Match Play (Sep 3) | Round 2 at The Commons flips from foursomes to aggregate: 2v2, own ball, hole to the lower sum of the partners' nets. One new branch in `derive()` (sum + "Vikes 4 + 5 less 1 = 8 beats…" why line), `hcp.aggregate = 100` off the low man prorated to 12 holes, format unions widened, feed credits the pair. Because it's own-ball, Round 2 now counts toward the MVP board and carries its own Player of the Round marker — a four-round race. `freeman-cup-aggregate.sql` widens the format constraint, clears the old team-keyed R2 test scores, and flips the round |
| Commissioner fixes (Sep 4) | Five from walking the commissioner's week. (1) Acting as: player by default (`src/lib/view.ts`, localStorage `fc-acting`); commissioner powers arm only in commish view, announced by a brass crown beside the cog; the cog menu stays full either way. (2) The desk (`src/lib/desk.ts` + card atop commissioner Settings): morning readiness (pairings/scorers/format) with a Go-live button that refuses until ready; live per-group thru/freshness (quiet ≥30 min flags) and cards-in; Mark complete arms when the last card lands. (3) Complete guard: setting a round Complete with cards out (desk or Rounds select) asks once with names and open-hole counts. (4) Seats: every player's email + claim state with commissioner-only Unbind via `clear_seat()` — invite day without the SQL editor. (5) Reset becomes hold-for-2s once any score exists |
| Tests | 73 unit (26 scoring + 14 write queue + 8 feed + 6 moments + 6 card + 5 standings + 4 desk + 4 moment overlays). 12 RLS integration tests unchanged; run `npm test` from a real terminal (sandboxed agents can't reach Supabase) |

SQL that has run, in order: `freeman-cup-schema.sql`, `freeman-cup-auth.sql`, `freeman-cup-handoff.sql`, `freeman-cup-commish.sql`, `freeman-cup-shootout.sql` (run Sep 3), `freeman-cup-cards.sql` (run Sep 3), `freeman-cup-aggregate.sql` (run Sep 3), `freeman-cup-seats.sql` (**Sep 4 — not yet run; paste into the SQL editor once**). Each is the record of what ran; don't re-run the schema.

---

## Public scoreboard (thefreemancup.com), built Sep 4

Second Vite page in the same repo, no app code touched. `scoreboard.html` + `src/scoreboard/` (Scoreboard.tsx, shape.ts, moments.ts, weather.ts, scoreboard.css, symbols.ts). It imports the app's `scoring.ts` and `standings.ts` as-is and calls one anon RPC, `public_scoreboard()` (`freeman-cup-scoreboard.sql`), every 60 s. Three lives from the same data: countdown before the trip, live cards during, the record after. Celts always left, Vikes right. Weather is Open-Meteo, fetched client-side, no key. Prototypes that were signed off live in `docs/prototypes/`.

- `vercel.json` rewrites `thefreemancup.com` (and www) to `/scoreboard.html`; `freeman-cup.vercel.app` keeps the app and its home-screen installs.
- `vite.config.ts` has the two-page `rollupOptions.input` and keeps `scoreboard*` out of the app's precache.
- `shape.ts` duplicates the row-to-engine mapping in `useEventData.ts` on purpose (freeze). If they drift, the app's is the reference; unify in 2027.
- `event.previous_winner` / `previous_year` (nullable) drive the "hold the Lassie" line. Null = inaugural copy. Set them after the cup.
- Still to do: run the SQL, add the domain in Vercel and the A record at the registrar (Resend's DNS records are separate), then check thefreemancup.com shows the countdown.

---

## Rehearsing the captain's sheet (do this once before Sep 19)

Two phones is the real thing, but one phone works too: Settings → Setup → Captain's sheets has "Seal as Griffin" (seals his side with the default lineup) and, once revealed, "Open as Griffin" (reads his sheet out), so the whole flow can be walked from the commissioner's phone. Two phones, two captain seats, signal on both, for the dress rehearsal.

1. Run `freeman-cup-sheets.sql` in the Supabase SQL editor (safe to re-run). Then Settings → Event → Clear all scores. That drops the seeded pairings; from here the sheets make them.
2. Phone A (Kyle, Scoring tab): the Round 1 sheet. Pick a pairing, tap the swap button between the two slots to change the order, Submit Pairings (one tap, no confirm). Phone B should show "Celts · Sealed" within a second or two (the seal nudges the round row so non-captains refresh too).
3. Phone B (Griffin): submit his (or Settings → Setup → Seal as Griffin). Phone A, acting as commissioner (Settings → You), now shows the Send Pairings footer under its sealed sheet.
4. Phone A, acting as commissioner: Send pairings. Every signed-in phone gets a sealed letter with its owner's name; open it and the card shows partner, then opponents, tee time and strokes. Close or See the match.
5. Behind the letter both phones are already on the match brief; Schedule shows the matches; thefreemancup.com shows them within 60 seconds.
6. Settings → Setup → Captain's sheets: unseal one side of Round 2 after sealing it, confirm it comes back editable (only possible before Send).
7. Friday: after Round 2 posts, the Round 3 sheet appears under Round 2's brief (it's due 90 min before the first tee, 11:40 am, not 9 pm).
8. Deadline: to see the default path, set a round's `play_date` to yesterday in the SQL editor and open the app; it fills, reveals, opens and posts on its own. Put the date back.
9. Settings → Setup → Posted rounds → Reset to sheets takes one round (and any after it) back to the sheets without touching the rest; Clear all scores resets everything so the trip starts clean.

If anything in 2 to 5 needs explaining twice, keep the seeded pairings (don't clear) and run the envelopes on paper; the app then behaves as it did before this feature.

## Not built

- **Push notifications** — the whole system: VAPID keys, `push_subscription` writes, a server-side sender (Edge Function or Vercel function), the 90-second hold, tiering. Biggest remaining risk to the date; a legitimate 2027 candidate
- **Rules & Scoring** guide sheet (book icon in the prototype header)

---

## Not code, and blocking real use

1. ~~Custom SMTP~~ **Done Sep 4**: Resend + thefreemancup.com, code-in-email sign-in verified on the installed iPhone app. Details in `SUPABASE-SETUP.md`.
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
- A one-bar signal leaves a Supabase fetch hanging far longer than airplane mode does, and the boot screen sat on top of the app until it returned (Sep 6). `useEventData` now paints from the IndexedDB snapshot first and gives the network 8 s before falling back to it. Scores entered meanwhile go through the write queue as before.
- Supabase's safeupdate guard rejects any `DELETE`/`UPDATE` without a `WHERE`, definer functions included. `reset_event` failed with "DELETE requires a WHERE clause" until every statement got `where true` (Sep 6). Write new bulk statements that way from the start.
- Press-and-hold buttons don't survive iOS: the long press turns into text selection and the pointer is cancelled (Sep 6). "Clear all scores" is a confirmation drawer with plain buttons now; don't bring the hold back.

The original warnings still stand: don't let anyone rewrite `calc()` or `derive()`; RLS that silently returns empty sets is the standard failure; copy the stylesheet, don't translate it; scope creep is the biggest risk to Oct 7.

---

## The event (unchanged)

Eight men, two teams, four rounds at Sand Valley, playing for **The Lassie**. Ten points, 5½ wins. Vikes (red): Griffin S. 15 (C), Devin E. 7, Brian K. 6, Matt J. 15. Celts (blue): Kyle P. 15 (C, commissioner), Phil J. 11, Justin D. 7, JT W. 15. Thu Mammoth Dunes four-ball; Fri The Commons aggregate match play (12 holes) then Sand Valley four-ball; Sat Sedge Valley singles. Tie at 5–5 goes to the Captains Shootout on the practice green.

Three tabs: **Live · Scoring · Schedule.** Dark scorecard green, bone, brass; Young Serif (display, one weight, self-hosted Latin subset in `public/fonts/`, replaced Fraunces Sep 1) / Work Sans / Barlow Condensed; sentence case.
