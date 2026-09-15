# The Freeman Cup: pre-mortem

Written Sep 14, 2026, twenty-four days out. The exercise: imagine it is Sunday Oct 11 and something went wrong. What was it, and what would we wish we had done in September? Four read-only passes went over the repo (scoring and offline, auth and the desk, the public site and the rules, and the on-course UX). Everything below is backed by a file and line unless it says "speculation". Each item has a scene (when it bites), the evidence, a fix, and a size: S is under an hour, M is an afternoon, L is a day or more.

Two companion pieces go with this document: the wireframe journeys (seven scenes drawn as frames, so you can see the moment things go wrong) and the hi-fi prototype of the fixes I would make first.

## How to read the severity

Blocker: scores are lost or corrupted, or a group cannot score. High: likely during the week and painful. Medium: plausible, recoverable, or embarrassing in front of the field. Low: cosmetic, or an edge the eight of you will probably never hit.

## The short list

If you only do ten things before the Sep 19 rehearsal, do these, in this order.

1. Fix the write-queue delete race (A1). Silent data loss, ten-line change.
2. A score tap must not undo a manual override (A6).
3. Let any group member take the pencil, and let the election work offline (A3, A4).
4. Flush the queue before Submit (A7).
5. Sign out locally, not globally (B1). One argument.
6. Close the `player` self-update hole and the `tee_group` column hole (B5, B6). Two policies.
7. Stop a post-deadline reset from re-posting default pairings (C1). Rule or code.
8. Gate finale honors until all four rounds are in the book (E3).
9. Reload on foreground and give the offline error screen a Try again button (A11, D3).
10. Raise the JWT expiry to 24 hours in the Supabase dashboard (A2). One minute.

Then the two changes to how the week runs that no code fixes: pick a backup commissioner and pre-write the SQL that promotes him (G1), and freeze deploys from Wednesday night to Saturday afternoon (G2).

---

## A. On the course: scoring, offline, the pencil

### A1. A correction tapped while the first save is in flight is deleted. Blocker, S

Scene. One bar on the 7th at Mammoth. The scorer taps Kyle 5, sees the 4 he meant, taps 4 a second later. The 5 was already on its way. When the 5 lands, the queue deletes the row by key, and the row now holds the unsent 4. Nothing re-flushes. The next load shows the server's 5. Nobody is told.

Evidence. `src/lib/writeQueue.ts:105-115` deletes by `keyOf(row)` after a successful upsert without checking whether the row changed since it was read; `enqueueHoleWrite` (78-88) writes the same key and its `flushQueue()` call returns the already-running promise (`if (flushing) return flushing;` at 100). The `blocked` re-put at 121 has the same hazard. `writeQueue.test.ts` only covers the offline case.

Fix. Two parts. Inside one readwrite transaction, read the row again and only delete (or mark blocked) when its `queued_at` equals the one you sent. Set a `dirty` flag in `enqueueHoleWrite`; in `flushQueue`'s finally, if dirty, clear it and flush again. Add the test: enqueue A, start a slow flush, enqueue B on the same key, resolve A, assert B is still queued and then sent.

### A2. An expired token with no signal turns the scorer into a spectator. High, S (dashboard) plus S (code)

Scene. Token minted 11:30 in the clubhouse. At 12:35, in the dead zone on 5, a tap triggers a load; `getSession()` tries to refresh, fails on the network, and returns null. From that moment `meKey` is empty and every tap tells Griffin "Griffin has the pencil." Rows already queued carry `entered_by: null`. Signal returns, the session refreshes, but `data.meKey` stays empty until something else reloads.

Evidence. `src/hooks/useEventData.ts:176-177` derives identity from a fresh `getSession()` every load; `ScoringScreen.tsx:335,343` gate on `data.meKey`. Nothing reloads on `TOKEN_REFRESHED`. Speculation on the exact supabase-js behavior; verify by setting JWT expiry to 60 s and going to airplane mode after it expires.

Fix. Set JWT expiry to 86400 s in the Supabase dashboard for the week. Derive the uid from the `useAuth` session (or cache the last known uid in the snapshot) instead of calling `getSession()` per load. In `useAuth`, call `reload()` on `TOKEN_REFRESHED` and `SIGNED_IN`.

### A3. Nobody can take the pencil from a dead phone without the commissioner. High, S

Scene. Thursday, Griffin's phone dies on 6. Matt opens the card: no Take it button, only "Griffin has the pencil; scores go in from his phone." Kyle is in the other group with no bars. They score on paper until Kyle gets a signal and opens Settings.

Evidence. `ScoringScreen.tsx:363` `const canSwap = iAmScorer || data.meIsCommissioner || (!scorerKey && inGroup);` The RLS `handoff` policy (`freeman-cup-schema.sql:211-216`) already allows any group member to update `tee_group`, and the feed already has the "Taken over from" copy (804).

Fix. `canSwap = iAmScorer || data.meIsCommissioner || inGroup`, with a two-tap confirm when taking from someone else ("Take the pencil from Griffin? His phone keeps its copy; yours becomes the card."). The feed line is the deterrent.

### A4. Electing or switching the scorer needs a signal, and the first tee is where the signal is worst. High, M

Scene. Pairings posted Wednesday night, scorers show "unnamed" on the desk, nobody sets them. Thursday on the first tee with no bars, Take it fails ("Needs a signal"), every player is view-only, and the offline write queue is never reached. Worse, `MatchBrief` only offers the card to the scorer or commissioner, so an unassigned group cannot even open it.

Evidence. `ScoringScreen.tsx:353-355, 365-387` ("goes straight to tee_group, no queue"); `build_round_matches` (`freeman-cup-sheets.sql:196-205`) nulls the scorer unless the seeded scorer landed in the group; `ScoringScreen.tsx:516`.

Fix. Short term, make "Scorers set for tomorrow" a hard item on the night-before checklist (the desk already warns). Better, queue the scorer change like a hole write (a `pencil` row in the same IndexedDB store, flushed first), and let hole taps queue behind it with the intended scorer, so RLS accepts them once the handoff lands.

### A5. A dead scorer's queued rows resurrect and overwrite the new scorer. High, M

Scene. Griffin scores 3 to 5 offline, phone dies; Matt takes the pencil and enters 3 to 5 himself. Griffin's phone comes back: his rows are refused (not the scorer), sit as "3 scores need attention" all week, and his Live and Scoring tabs paint his numbers over the server's. If the pencil goes back to Griffin later that round, the 20 s timer flushes his stale rows over Matt's. Last writer wins, no timestamp check.

Evidence. `writeQueue.ts:116-123` marks a `42501` row `blocked` and retries forever (105-108); `overlayQueue` (145-161) paints blocked rows over server data.

Fix. Send `queued_at` with the upsert and add a `before update` trigger on `match_hole` that no-ops when the incoming stamp is older than `updated_at`. Client side, drop a blocked row whose server row is newer than `queued_at`. After a handoff away from me, prompt to discard my blocked rows for that group.

### A6. A score tap after a manual override silently re-derives the hole. High, S

Scene. Four-ball, hole 9: the Vikes concede, the scorer sets the CEL override. Then, as the bye-hole guidance asks, he enters the four gross scores for day totals. The last tap flips the hole back to derived, maybe VIK or Halved, and the match state changes with only a small "Decided by the app" line. On the 12-hole aggregate that is a quarter of the match.

Evidence. `ScoringScreen.tsx:471-472` `h.sc[k] = newVal; settle(m, i);` and `scoring.ts:156-158` `settle()` sets `h.d = true` unconditionally.

Fix. In `handleScoreSet`, if `h.d` is false keep `h.r` and post `derived:false` with the existing result; show "Set by hand. Tap the override again to let the app decide."

### A7. Submit can race the last hole's save; the card locks the score out. High, S

Scene. On 18 the scorer taps the last score and Submit inside the 2.5 s window. Two requests on a flaky link land out of order: `submit_card` first, then the hole-18 upsert is refused. The drawer says "1 score could not save" and the commissioner has to Reopen.

Evidence. `ScoringScreen.tsx:296-307` sets `pending` only after 2.5 s; 775-777 disables on `pending > 0`; `submitCard` (404-416) does not flush; `scores_this_match` requires `submitted_at is null` (`freeman-cup-cards.sql:129-140`).

Fix. In `submitCard`: `await flushQueue()`, then refuse with "Still syncing" if any of this group's matches are still queued. Compute the button's `pending` from the immediate queue count; keep the 2.5 s delay for the banner text only.

### A8. A hung save freezes the whole queue for minutes. High, S

Scene. Walking into a valley, the upsert neither fails nor completes for 60 to 120 s (iOS is happy to wait). Scores keep queueing safely, but "N to sync" climbs and Submit stays disabled; every trigger just rejoins the hung promise.

Evidence. `writeQueue.ts:39-44` no timeout; `withTimeout` in `useEventData.ts:75-80` only rejects the wrapper.

Fix. `.abortSignal(AbortSignal.timeout(10_000))` on the upsert and on `fetchTables`. A timeout error has no code and already matches `isNetworkError`.

### A9. Two phones editing the same hole clobber each other. Medium, M

Scene. Kyle, in the cart with signal, fixes Phil's 6 to a 5 on hole 4 of group B. Group B's scorer, whose phone has been asleep, enters JT's score on hole 4; his stale row carries Phil 6 and overwrites the fix. History records it; nobody looks until Saturday.

Evidence. `ScoringScreen.tsx:455-468` rebuilds the whole `scores` object from local state; `writeQueue.ts:42` upserts the full row; no version check; nothing reloads on foreground (A11).

Fix. An RPC `set_hole(match, hole, key, value, result, derived)` that merges one key (`scores || jsonb_build_object(key, value)`), or send `expected_updated_at` and block with a clear message when it differs.

### A10. A manual set-back to Not started is undone by the auto-live tick. Medium, S

Scene. Friday 7:20 Kyle sets Round 2 live early; frost delay at 7:25, he sets it back. At 7:30 the first phone with signal calls `round_tick` and it goes live again; the desk's Held row never appears.

Evidence. `freeman-cup-autolive.sql:21` guards only on `auto_live_at is not null`; `SettingsSheet.tsx:56-57` never sets it; `App.tsx:135-146` ticks from every phone. (The desk audit believed this was handled; the SQL says otherwise. Verify which `reset_event` and `round_tick` are live, see F1.)

Fix. A trigger on `round`: when `old.state = 'live' and new.state = 'upcoming'`, set `auto_live_at = coalesce(auto_live_at, now())`.

### A11. No reload on foreground or reconnect; missed realtime events stay missed. Medium, S

Scene. A spectator's phone sits locked for twenty minutes; iOS drops the websocket; it reconnects on wake but the events in the gap are gone. He sees a board frozen at 1:10 pm with a header that says "Last sync: 1:10pm by Phil" (which is the time of the last score in the data, not this phone's last contact) and no banner. He assumes the other group has stalled. On a scorer's phone this is also why A9 happens.

Evidence. `useEventData.ts:417-430` subscribes with no status callback; `writeQueue.ts:174-176` only flushes on visibility and `notify()` only fires when a row changed (125); `App.tsx:70-85` header line.

Fix. Call `load()` (debounced) on `visibilitychange` visible, on `online`, and on the channel's `SUBSCRIBED` status; add a 60 to 90 s fallback poll while the channel is not subscribed. Rename the header line to "Latest score 1:10pm by Phil" and surface `syncedAt` age in the banner when older than a few minutes.

### A12. Service worker autoUpdate reloads the page mid-hole. Medium, S

Scene. A fix goes out at 12:05; a scorer cold-launches on the 2nd tee at 12:10; the new worker activates thirty seconds later and the page reloads. Queued rows are safe, but tab and pinned hole reset and he is looking at the frontier hole instead of the one he was fixing.

Evidence. `vite.config.ts:24 registerType: 'autoUpdate'`, `main.tsx:28 registerSW({ immediate: true })`.

Fix. Either `registerType: 'prompt'` with a quiet "Update ready" strip that applies on the next cold open, or keep autoUpdate and do not deploy during play (G2). Persist `pinned` and `heroId` in `sessionStorage` either way.

### A13. Auth errors are classified as permanent and light the red card. Medium, S

Evidence. `writeQueue.ts:92-94` treats anything with a code as blocked; `PGRST301` (JWT expired) and a `42501` caused by a null session get the "Couldn't save, show this screen to the commissioner" card (`ScoringScreen.tsx:944-975`) though the next flush after refresh would clear it.

Fix. Treat `PGRST301`, HTTP 401, and messages matching `/jwt|token/i` as transient; call `getSession()` at the top of `flushQueue` to force a refresh.

### A14. A closed IndexedDB handle makes the queue invisible. Medium, S (speculation on the trigger)

Evidence. `db.ts:13-29` caches `_db` forever with no `onclose`; `getQueuedWrites` swallows errors and returns `[]`; the direct-upsert fallback in `enqueueHoleWrite` (81-86) discards the error, so offline that tap vanishes with no UI.

Fix. `db.onclose = () => { _db = null }`; retry once on `InvalidStateError`; surface a fallback failure as a "couldn't save" state.

### A15. Small ones. Low, S each

`pending` counts every queued row on the phone, not this group's, so the commissioner scoring two groups sees group A's Submit disabled by group B (`ScoringScreen.tsx:304-306`; filter like `gBlocked`). No `holes`-aware validation on `match_hole` (a hole 13 on the Commons, a score of 41, a key that is not a player) and `entered_by` is client-supplied (`freeman-cup-schema.sql:89-98`; one `before insert or update` trigger). Identity is keyed by first name (`useEventData.ts:273-277`); a roster edit producing two Kyles would merge them (assert unique keys at startup, or key by uuid). The scorecard comment says a 12-hole round gets Out only but the code renders an In column of 10 to 12 (`Scorecard.tsx:9,19`; decide which).

### Checked and fine

No duplicate rows (PK plus `onConflict`), history trigger on every write, IndexedDB put before any network so an app kill never loses a tap, pre and post-fetch queue merge by `queued_at`, blocked rows never dropped silently, timezone math pinned to America/Chicago on both sides, auto-live tick idempotent, handicap arithmetic (90 percent four-ball, 100 percent singles and aggregate, off the low man, half up, 12-hole proration), aggregate derive, dormie and closing labels, pick-up at par plus four, Safari scroll-click guard, realtime channel created once and removed on unmount.

---

## B. Sign-in, seats, and sessions

### B1. Sign out is global: signing out in Safari also signs out the home-screen app. High, S

Scene. A player signs in in Safari from the invitation, later installs and signs in inside the app, then taps Sign out in the Safari copy to tidy up. Within the hour the app's token expires, refresh fails, and he is back at the code screen mid-round. Same if Kyle signs out on a laptop.

Evidence. `useAuth.ts:52-54` `supabase.auth.signOut()` defaults to `scope: 'global'`, which revokes every refresh token. The app explicitly expects two sessions per person (`SignInScreen.tsx:71-72,102`).

Fix. `supabase.auth.signOut({ scope: 'local' })`. Also make the player-settings Sign out a two-tap (D8).

### B2. Auth users created by SQL break OTP in two well-known ways. High, S

Evidence. `FREEZE-CHECKLIST.md:35` says I will write SQL to create the seven users; `SUPABASE-SETUP.md:70-72` says Dashboard, Add user, Auto Confirm. Rows inserted straight into `auth.users` with NULL token columns make GoTrue fail on lookup ("converting NULL to string is unsupported", surfaced by `useAuth.ts:33-35` as a raw message). A user with NULL `email_confirmed_at` receives the Confirm signup template on `signInWithOtp`, which carries no `{{ .Token }}`, so the player gets a link and no code.

Fix. Create the seven through the dashboard with Auto Confirm, or `auth.admin.createUser({ email, email_confirm: true })`. I will write that as an admin-API script rather than raw SQL. Then run the check in `SUPABASE-SETUP.md:78-81` and confirm every seat reads Open, not No account.

### B3. A seat email edited after the auth user exists strands that player. Medium, S

Scene. Kyle fixes a typo in Seats after the user was created. The player types the corrected address; Supabase says signups are off; the app says "not on the invite list". The No account chip catches it only on the Setup tab, only when armed, and never for a claimed seat (`SettingsSheet.tsx:547` lets `auth_uid` win).

Evidence. `SettingsSheet.tsx:533-536`, `freeman-cup-auth.sql:17`, `useAuth.ts:30` `shouldCreateUser: false`.

Fix. After any email edit, update `auth.users.email` too (Dashboard, Users). Make the chip show No account even when `auth_uid` is set.

### B4. The 60-second OTP cooldown shows as a raw error. Low, S

Evidence. `useAuth.ts:33-35` maps only "not allowed / not found / signups". A player who requests a code in Safari then again in the app gets "For security purposes, you can only request this after N seconds."

Fix. Map `/security purposes|rate limit/i` to "Give it a minute and try again."

### B5. Any player can promote himself to commissioner with one PATCH. High (trust-dependent), S

Evidence. `freeman-cup-schema.sql:221-222` `create policy commish_players on player for update ... using (is_commissioner() or auth_uid = auth.uid());` with no `with check`. A `PATCH /rest/v1/player?auth_uid=eq.<uid>` with `{"is_commissioner":true}` succeeds, and `is_commissioner()` reads that column, unlocking `reset_event`, `reveal_sheets`, all match writes, and `/api/send-mail`. `is_captain = true` lets a second "captain" seal his team's sheet first. The self-branch was meant for claiming, but claiming goes through the definer `claim_seat()`.

Fix. `using (is_commissioner()) with check (is_commissioner())`. The app never has a non-commissioner update `player`.

### B6. Any group member can update any `tee_group` column, including `submitted_at`. Medium, S

Evidence. `freeman-cup-schema.sql:211-216` `with check (true)`. Intended for `scorer_player_id`; also allows un-handing a card (bypassing commissioner-only `reopen_card`) and setting `submitted_at` without being the scorer.

Fix. `revoke update on tee_group from authenticated; grant update (scorer_player_id) on tee_group to authenticated;` or a trigger that rejects other column changes unless `is_commissioner()`.

### B7. The rest of RLS. Low

`entered_by` is client-supplied (cosmetic; `new.entered_by := coalesce(me(), ...)` in a trigger). The sheet functions grant to `authenticated` without revoking from `public` (`freeman-cup-sheets.sql:379-381`); every guarded one checks identity so anon gets an exception, but add the revoke line for tidiness. Speculation: if the Supabase project is on the free plan, seven days without traffic pauses it; the Sep 27 to Oct 1 window is the risk. Check the plan.

### Checked and fine

A player cannot write another group's holes (twelve RLS integration tests). No client insert on `match`, `feed_event`, `captain_sheet`; no delete on `match_hole`. The other captain cannot read the opposing sheet before Send, and the commissioner (a Celts captain) cannot read the Vikes sheet either. `reset_event`, `reveal_sheets`, `unseal_sheet`, `set_shootout`, `reopen_card`, `seat_accounts` all check `is_commissioner()`. `api/send-mail.ts` never returns the service key, validates the JWT, authorizes by `player.auth_uid`, and restricts recipients to the roster. `public_scoreboard()` exposes no emails, auth ids, or sheets. Email case is lowered everywhere. Refresh tokens do not expire (`SUPABASE-SETUP.md:64-67`). Code entry over link tap is the right call for the iOS storage split.

---

## C. The night before: sheets, letters, pairings

### C1. Any reset after a round's 9 pm deadline immediately re-posts that round with default lineups. High, S (rule) or M (code)

Scene one. The checklist says run Clear all scores before the first tee Thursday and do the Round 1 sheets Wednesday night. If the clear happens any time after Wednesday 9 pm CT (say Thursday 7 am after one last look), the first phone to render the Scoring tab settles Round 1: both sheets defaulted to roster-order pairings, matches built, letters dropped on every phone, and the captains' real picks are gone.

Scene two. Thursday evening Kyle taps Reset to sheets on Round 1 to fix something; Round 1 is past due, so it re-posts itself with defaults on his own reload.

Evidence. `freeman-cup-sheets.sql:232-246` `sheet_settle` fires whenever a round has no matches and `now() >= sheet_due(r)`; `CaptainSheet.tsx:53-55` calls `sheet_tick` on every past-due render; `reset_round` and `reset_event` (`freeman-cup-autolive.sql:35-66`) delete matches and sheets. `reveal_sheets` past due also defaults (`sheets.sql:279-286`).

Fix. Cheapest: two lines in the checklist. Clear all scores must be finished before Wednesday 9 pm, and Reset to sheets is never used on the current round after its deadline (use the per-match selects in Rounds instead). Proper: have `reset_round`/`reset_event` stamp `round.settle_after = now() + interval '1 hour'` (or clear a `sheets_open` flag the commissioner re-arms) and check it in `sheet_settle` and the past-due branch of `reveal_sheets`.

### C2. Seal as Griffin and Unseal are one tap, no confirm, no deadline check, and read as a real seal. Medium, S

Scene. Kyle taps Seal as Griffin at 7 pm (fat finger, or impatience) and Sends. Griffin's phone reads "Vikes · Sealed 7:02 pm", not Defaulted, and his real Submit fails with "your sheet is already sealed." The Vikes play a lineup Griffin never chose.

Evidence. `freeman-cup-sheets.sql:325-332` `commish_seal_for` inserts `auto = false` with no `now() >= sheet_due(r)` check; `SettingsSheet.tsx:342-344` shows both buttons on every unposted round during the trip.

Fix. Insert `auto = true` so the status says Defaulted, and either require past-due or put both behind the same confirm drawer as Clear all scores.

### C3. A three-man team cannot be posted from the app at all. Medium, S (prewritten SQL)

Scene. Someone tweaks a back Friday morning. Rounds 3 and 4 can only be built by hand.

Evidence. `sheets.ts:63` `if (ps.length !== 4) return [];`, `default_slots` raises "team needs four players" (`sheets.sql:98-100`), `validate_slots` demands every player exactly once (156-159). No client insert on `match`.

Fix. Keep a pre-written SQL snippet in HANDOFF that inserts a round's matches by hand and sets `revealed_at`, with a 1-v-2 or a bye. Do not try to generalize the sheet before the trip.

### C4. Post-send pairing edits have no validation and do not re-seat the scorer. Low to medium, S

Evidence. `SettingsSheet.tsx:374-387` lets a select put the same player in both matches or leave a side short; `used_pairs` reads matches so a duplicate pair is only caught at the next sheet with no explanation; only `build_round_matches` re-seats the scorer (`sheets.sql:199-203`), so a swapped-out scorer keeps write rights.

Fix. Client-side duplicate and short-side check before `setSide`; a small trigger on `match` update that re-runs the re-seat.

### C5. Round 3's deadline lands while Round 2 is on the course. Low, none (tell the captains)

Evidence. `sheets.ts:30-41`: Round 3 due = first tee minus 90 minutes, about 11:40 am, during or just after the 12-hole Commons. Sealing needs a signal. The pairing is forced (only the unused pair remains), so the default can only get the tee order wrong. Tell the captains Thursday night.

### C6. The pre-trip Scoring tab says "Pairings post tonight" for ten days. High, S

Scene. Sep 27, Matt installs the app, signs in, and the first screen says pairings post tonight, 9:00 pm at the latest. He checks at 9:15. Nothing. He texts Kyle. Six others do the same. For the captains, the intro says "Time to set your pairings, due 9:00 pm course time" from day one, and `seal_sheet` is one-shot: Griffin can lock Round 1 on Sep 28 out of curiosity, and only the commissioner can unseal.

Evidence. `App.tsx:118` default tab is scoring; `ScoringScreen.tsx:88-90` renders `CaptainSheet` whenever the current round has no matches; `CaptainSheet.tsx:156-158` copy; `sheets.ts:151-153` `clockLocal()` prints a time only, no date; nothing in `sheetView` gates on the date.

Fix. Print the deadline with its date ("Wednesday Oct 7, 9:00 pm"), and until the eve of the round say "Pairings post Wednesday night" instead of "tonight". Default the first tab to Cup until Round 1 has matches. For captains, keep the intro but say "Opens Wednesday" and hold the editor until the day before.

### C7. A seat not in a match gets someone else's letter, addressed to himself. Low

Evidence. `letters.ts:36` falls back to `ms[0]` when `mine` is false and `pendingLetter` (49-60) does not check `mine`; `Letter.tsx:20,62`. Only bites with a spectator seat or a short build (C3). Skip rounds where `!letter.mine`.

### C8. The letter cannot be reopened after the round auto-goes-live, and not from the Schedule. Low, S

Evidence. "Open your letter again" lives in the pre-round brief only while `s.state === 'upcoming' && r.played === 0` (`ScoringScreen.tsx:508-527`); rounds go live thirty minutes before the tee on their own; `ScheduleScreen` has no letter prop, which contradicts USER-STORIES PL-12 (marked Passed).

Fix. An envelope chip on the Schedule round row for any revealed round the user is in; correct PL-12.

### Checked and fine

Both captains submit then want to change: Unseal before Send, per-match selects after. Pairings sent twice: `reveal_sheets` early-returns once matches exist, mail dedupe per round. Singles ordering maps 1-2 to group 1 and 3-4 to group 2 in both SQL and copy. Rounds 2 and 3 sheets appear within 36 hours of their due and refuse to seal until earlier rounds have matches. `sheet_due` and `zoned()` agree on Chicago time.

---

## D. In the hand: the app's UX on a phone in the sun

### D1. Push notifications do not exist, but the story library and checklist schedule a test for them. High, S (docs) plus honest copy

Evidence. No `Notification`, `pushManager`, or push handler anywhere in `src/`, `public/`, or `vite.config.ts`; `HANDOFF.md:71` says push is not built; yet `USER-STORIES.md:141` PL-19 is Verify, SC-06 says "a push held for the old result is cancelled, Passed", and the checklist's rehearsal list includes PL-19. The only live signal is the Cup tab's brass dot, which pulses for the whole five hours a round is live (`App.tsx:120,325`), not when something new happens.

Fix. Mark PL-19 and SC-06's push clause Not built and pull the rehearsal line. Say in the one-week-out email that the app does not notify: check the Cup tab. If anything, an in-app "3 new since you looked" chip on the Cup tab keyed on feed items newer than the last visit.

### D2. Cold open with no signal: the error screen says pull down to retry, and pull-to-sync is not mounted. High, S

Scene. A player who never opened the app on Wi-Fi opens it in the cart at Mammoth with one bar. After the 8 s timeout he sees "Couldn't reach the clubhouse. Check your signal, then pull down to try again." Pulling does nothing. He force-quits and relaunches.

Evidence. `App.tsx:286` `{data && <PullSync/>}`; the error block at 296-303 renders only when `data` is null.

Fix. A Try again button in the error block that calls `reload()`, and mount `PullSync` whenever the body exists. In the one-week-out email: open the app once on Wi-Fi before Thursday.

### D3. The one line that says the state of the Cup is 11.5px at 2.9:1 contrast. High, S

Evidence (token pairs from `index.css:7-10`). `.striplbl` 11.5px `--moss-dim` on `--ink-2` is 2.89:1; that is "Celts lead · 3 to clinch". Unselected `.tab` 16px `--moss-dim` on `--ink` is 3.34:1. `.tag`, `.ev .t`, `.ev .sub2`, `.dayhd .tog`, `.mvprow .rd2`, `.hh .meta2`, `.sh .meta`, `.stft` all 12 to 14px at 3.34:1. Poster labels `.pc .k` 10.5px, `.pmvp` 9.5px, `.plive .st small` 10px, `.fplayer .capt` 9.5px. Vikes red on ink is 3.47:1 and on ink-2 3.01:1 at 14.5 to 15px (`.prow .pn.a`, `.ev .who.a`); blue is 4.52 on ink but 3.92 on ink-2. Dimmed states go to opacity .3 to .5.

Scene. Noon at Sand Valley, no shade. The tug bar reads; the words under it do not. The scorer squints at "Vikes 2 up" in 15px red.

Fix. Lift `--moss-dim` to about `#7C8F86` (4.5:1 on ink-2) and reserve the old value for decoration only. Make `.striplbl` 13px in `--moss`. Lift the Vikes red one step for text (about `#D9584A`), or render team names in bone with a color swatch the way the poster already does. Raise poster `.k` labels to 12px. The same tokens are on the site (H6).

### D4. Takeovers can stack three deep on one open, and the finale can land on a scorer mid-hole. Medium, S

Scene. Friday breakfast, Phil opens the app for the first time since Thursday lunch: Thursday recap, then his match poster, then the Friday letter, each with a small Close at the bottom. Saturday, the Celts clinch while group B is on 15; the finale poster covers group B's scorer's card the moment the realtime event lands.

Evidence. `App.tsx:149-156, 170-177, 192-197` each auto-open gated only on `!moKey`; `.moment` is `position:absolute; inset:0; z-index:26` (`index.css:829`).

Fix. Never auto-open while the current user is the scorer of a live, unsubmitted group; show a strip instead. Cap auto-opens to one per app open and hold the rest as "New: 2 moments" on the Cup tab.

### D5. The poster's only exit is a 13.5px underlined link, and nothing says "screenshot to share". Medium, S

Evidence. `ShareCard.tsx:54-56` renders one `.aghost` Close; `.aghost` is 13.5px with 4px padding, about 28px tall (`index.css:700`). The intent "a plain screenshot is the share" lives only in code comments (`ShareCard.tsx:43-46`); no `navigator.share` anywhere.

Fix. A full-width 48px ghost Close, a one-line hint in `.pnote` ("Screenshot to share it"), and a Share button that calls `navigator.share({ title, text, url: site })` when available. Tap-outside or swipe-down to dismiss.

### D6. The day recap poster may clip on shorter phones with no scroll. Medium, S (speculation on exact heights)

Evidence. `.moment.poster{overflow:hidden}` and `.pc{flex:1;min-height:0;overflow:hidden}` (`index.css:1410-1412`); Friday's `DayBody` stacks the strip, four match rows with lead lines and stories, and a footer (`ShareCard.tsx:151-197`). On an iPhone SE or 13 mini the bottom match could be lost silently on the card designed to be screenshotted.

Fix. Render the Friday fixture at 375 by 667. Either let `.pc` scroll or scale the poster from a fixed design size.

### D7. Email deep links land in Safari, at the sign-in screen, on the wrong tab. Medium, S

Evidence. Every email button targets the bare origin (`shell.ts:7`, `emails.ts:113,149`); there is no query or hash routing; the default tab is Scoring while recap and finale live on Cup; Safari's storage is separate from the installed app so the link asks for a new code.

Fix. Make the button copy honest ("The recap is on the Cup tab of the app on your home screen") and send the button to thefreemancup.com, which needs no sign-in. If a button must go to the app, support `?tab=live` and `#won`.

### D8. Sign out is one un-confirmed tap in the player's settings. Medium, S

Evidence. `SettingsSheet.tsx:174-180`. Combined with B1, one fat thumb at the turn costs a code email on a one-bar signal. Two-tap it.

### D9. Tab-name drift in copy. Low, S

"The finale and the week live on the Live tab" (`ScoringScreen.tsx:96-98`); "open Scoring ›" (`SyncBanner.tsx:69`); "Send Pairings lives on the Scoring tab" (`SettingsSheet.tsx:288`). The tabs are Cup, Scoreboard, Schedule. Replace with Cup tab and "open the Scoreboard ›".

### D10. Android back gesture exits the app from any overlay. Low, S

Evidence. No `pushState` or `popstate` anywhere; Settings, Rulebook, Letter, and every poster are absolute layers. Push a history entry on open, close on `popstate`.

### D11. Time formats differ by screen, and one header can end in a dangling separator. Low, S

Evidence. Schedule "Tees 12:00 PM and 12:10 PM"; header "Round 1 · Four-ball · 12:00/12:10pm"; letter "off at 12:00pm"; sheet "9:00 pm"; feed times with no am/pm (`feed.ts:250-254`). `teeLine([])` returns `''` so the header reads "Round 1 · Four-ball · " before tee times exist (`App.tsx:276-278`). One `clock12()` helper, and drop the trailing segment when empty.

### D12. The trophy case dates itself by the phone's clock. Low, S

Evidence. `LiveScreen.tsx:104` `new Date().getFullYear()`; in January it reads "The 2027 Freeman Cup, Vikes take the Lassie". Use `data.event.year` (the finale poster already does).

### D13. Tap targets under 44px. Low, S

`.aghost` Close, Sign out, Not yet still arguing (about 28px); `.rchip` Summary, Recap, Card, View (32px); `.dayhd .tog` (about 20px); `.sethd .done`, `.rbback`, `.rbnav button` (13px, little padding); `.cog` (33px); `.takepen` inline link. Give each a 44px hit area with padding, not visual size.

### D14. The rest. Low, S each

`apple-mobile-web-app-status-bar-style="default"` in `index.html:8` contradicts the CSS that pads for a translucent bar (`index.css:788-793`); verify on an installed phone and switch to `black-translucent` if the CSS intent holds. `navigator.vibrate` does nothing on iPhone (`App.tsx:24-26`); do not promise a haptic. `--dim` is used but never declared (`index.css:1676,1684`); use `--moss`. The install hint is iOS-only wording (`SignInScreen.tsx:102`); add the Android line. Poster name taps are a one-way door (`ShareCard.tsx:76-78`; Close returns to the app, not the poster you came from). The rulebook focuses its search input on open (`Rulebook.tsx:25`), which pops the keyboard on Android.

### Checked and fine

`.phone{position:fixed;inset:0}` avoids the 100vh trap; safe-area padding on header, tabs, sheets, poster actions; keyboard snap-back in `main.tsx`; `overscroll-behavior:contain` and a pull-to-sync that yields to horizontal swipes with an 8 s watchdog; tap highlight off on score cells; fonts self-hosted with swap, nothing depends on canvas so no silent poster failure; six-box code entry with iOS autofill; spectators cannot sign up; Cup and Schedule zero states are clear; every auto-opened moment has a standing door back to it; nothing in another player's view is in Kyle's first person; the commissioner defaults to player view.

---

## E. Rules, moments, honors: where the book and the engine disagree

### E1. The King's Race ignores overrides and conceded holes. Medium, S

Evidence. `standings.ts:62-63` recomputes the hole winner from the scores (`derive`), never from the stored `h.r`. Two conflicts with the book: Art. 10.2 (a disputed hole is halved) is applied by override, but the scores still say a side won, so that player still banks 2 points while `calc` says halved. Art. 4.3 (a hole can be conceded) entered as a result with no scores has `holeComplete = false`, earns nothing, and never counts toward the full card, so conceding a hole also makes you card-short (131).

Fix. `const r = h.d ? derive(m, i).r : h.r;` and decide in Art. 11 whether a conceded hole earns the team point (1 each) or nothing; count result-only holes toward the card.

### E2. "Full cards only" flickers and is only enforced once the commissioner marks Complete. Medium, S

Evidence. `standings.ts:122,131` `due` sums holes of rounds with `state === 'final'`, while `e.holes` counts every hole including the live round. A player who skipped two bye holes Thursday (16 of 18, off the board Thursday night) is back on Friday after two holes (18 ≥ 18) and off again when Friday is marked Complete. And since the finale fires on `cardsIn` (`moments.ts:206`), which can precede the Complete mark, `won.mvp`, the finale poster's honors (`ShareCard.tsx:235-237`) and `finaleMail` (`emails.ts:127`) can crown a short-card player, against Art. 11.2.

Fix. Eligibility per round: for every finished round, `holesInRound === s.holes`. Treat a round as finished when its cards are in, not only when `s.state` says final.

### E3. Finale honors are declared while a round is still to play. Medium, S

Scene. The Vikes clinch Friday afternoon at 5½ to ½. Every phone gets the finale Friday night naming an MVP and a Medalist that Saturday's 18 singles holes (up to 36 more hole points) can overturn; the finale email is sendable the same night; Saturday's live matches lose the tug-bar strip on the Cup tab because the woncard replaces it.

Evidence. `moments.ts:198-211` clinches on cumulative points (correct per Art. 1.1), then `:248 won.mvp = mvpOf(...)`; `LiveScreen.tsx:97-115` replaces the strip; `emails.ts:144-146`.

Fix. On the finale card, email, and moment, show honors only when all four rounds are in; otherwise "King's Race leader, Saturday still to play". Keep the CupStrip under the woncard while a round remains, with the woncard's copy "Cup clinched, Saturday for pride and the King's Race."

### E4. The clinching match is keyed on the last edited hole, not the closing hole. Low, S

Evidence. `moments.ts:141-145`, `cards.ts:190-195`, `feed.ts:200-211` use `max(updated_at)` over holes with a result. A 4&3 match whose group kept entering bye holes gets a later stamp than one that finished on 18 at the same moment, and a later correction to any earlier hole re-orders the finals. Use the closing hole's stamp (`when[m.id:calc(m).played]`).

### E5. There is no way to record an abandoned match, so the Cup can never go final and a 5 to 5 cannot be detected. Medium, S (SQL escape hatch) or M

Evidence. `scoring.ts:215-233` `done` only via hole results; `Scoreboard.tsx:114` and `moments.ts:195-196` require every match done. An injury or walk-off before the match is decided has no representation; the commissioner would have to fabricate results.

Fix. A `match.conceded_to` column honored by `calc` (M), or, for 2026, a pre-written SQL snippet that fills remaining holes with the conceding result and a note in HANDOFF.

### E6. Rehearsal "seen" keys survive Clear all scores. Medium, S

Evidence. `moments.ts:266-277` and `cards.ts:625-635` store `won`, `duel`, `day:Thu Oct 8` in localStorage and nothing clears them; `reset_event` wipes the server only. Any phone that saw the rehearsal finale or a day recap will not auto-open the real one.

Fix. Namespace the keys with `event.id` plus a reset stamp (`event.reset_at` bumped by `reset_event`), or clear them when the app sees zero match rows.

### E7. Copy that disagrees with the book. Low, S

Invitations and the week-out email say three rounds ("Ryder Cup rules · 3 rounds" in `emails/invite-*.html:70`; "Three rounds, four courses, one jug" in `emails.ts:171`); the book says four. `emails.ts:131` hard-codes "Level after 10 points" while everything else derives from `plannedPoints`. The duel copy in `Moments.tsx:42-43,59-62` says "three holes, stroke play" and describes honor alternating and playing out alone; Art. 9.1 says three stations and none of that. Three "whose ball" conventions: `feed.ts:57-66` uses net, `cards.ts:58-67` uses gross for the walk-off spike (so in four-ball the spike can credit the partner who did not win the hole on net), `scoreboard/moments.ts:35-56` uses net. One shared helper. The legacy `'X'` value is treated as no score by the engine but par plus four by standings and the site (`scoring.ts:175,197` vs `standings.ts:93`); unreachable from the UI, so map it to par plus four in `derive` or reject it. Art. 3 says the index is rounded by the commissioner; the code rounds the product (`scoring.ts:141-147`), which differs at 15.4 versus 6.6; enter whole indexes and it is moot.

### Checked and fine

Allowances, proration, ties on a hole, halves, dormie, closing, aggregate arithmetic, hole points 2/1/0 with byes counted, Player of the Round on full cards, clinch at 5½ of 10, the 5 to 5 path (duel pending, shootout board as the Scoring tab, site says a shootout decides it, no finale email), shootout validation (three or more equal-length stations, done flag, unequal sums), finale waits on the clinching round's cards, round reset re-renders clean, a missing score leaves the match honestly "thru N".

---

## F. Data, config, and drift

### F1. The record of which SQL has run is stale, and the same function is defined in five files. Medium, S

Evidence. `HANDOFF.md:37` lists only through `freeman-cup-seats.sql`; `sheets`, `scoreboard`, `tees`, `accounts`, `autolive`, `shootout2` are described as run elsewhere but not in the ledger. Each missing one fails quietly: no `round_tick` and the minute poll's errors are swallowed (`App.tsx:141`); no `seat_accounts` and every chip reads Open; no `tee` column and the Tees save shows a raw Postgres error; no `autolive.sql` and `reset_event` does not clear `auto_live_at`. `reset_event` is defined in five files; the last one run wins.

Fix. Five minutes in the SQL editor, and I will paste the block:

```sql
select proname from pg_proc where proname in
  ('round_tick','seat_accounts','clear_seat','reveal_sheets','sheet_tick','set_shootout','public_scoreboard');
select column_name from information_schema.columns
  where table_name = 'round' and column_name in ('revealed_at','auto_live_at','tee','yards');
select prosrc like '%auto_live_at%' as reset_clears_autolive from pg_proc where proname = 'reset_event';
```

Then update the ledger line and add the rule: never re-run `cards.sql`, `commish.sql`, or `shootout.sql` after `autolive.sql`.

### F2. Clear all scores also wipes the email send-log, re-arming Send to everyone. Medium, S

Evidence. `freeman-cup-autolive.sql:41` `delete from feed_event where true;` and `mail_sent` rows live in `feed_event` (`send-mail.ts:71-74`). Oct 1 the week-out email goes out; Oct 7 Clear all scores; the Emails tab shows One week out unsent with a live Send to everyone.

Fix. Exclude `kind = 'mail_sent'` from the delete in `reset_event`.

### F3. No undo for Clear all scores or Reset to sheets. Medium, none for 2026

Evidence. `match_hole_history` keeps rows but references deleted matches and there is no restore RPC; sheets and feed rows are simply gone. The confirm drawer is good. Hide Start over once the real event has scores, or gate it behind typing CLEAR.

### F4. The service role key sits in `.env.local` against the docs, and this folder has been shared with agents. Low, S

Evidence. `.env.local:3`; `MAIL-SETUP.md:36-37` says never. It is gitignored and Vite only bundles `VITE_*`, so it does not reach the client. Rotate it once before the trip and keep it out of the repo folder.

### F5. Concurrent sends can double-deliver. Low, S

Evidence. `send-mail.ts:55-59` check-then-insert with no unique index. Needs two devices or a retry. A partial unique index on `feed_event (event_id, kind, (body->>'mail'), (body->>'key'))`.

### F6. `api/send-mail.ts` is never type-checked. Low, none

`tsconfig.app.json` includes only `src`; Vercel transpiles the function. Do not touch it after the freeze.

### F7. Speculation: Resend audience unsubscribe and DMARC. Low, S

Broadcasts may append an unsubscribe footer and honor audience-level unsubscribes; check one rendered test. Add a `_dmarc` TXT (`v=DMARC1; p=none`) at the registrar; SPF and DKIM come with Resend's verification, DMARC does not.

---

## G. The week itself: operations no code fixes

### G1. One commissioner, one phone. Medium

Every privileged path checks the single `is_commissioner` seat. If Kyle's phone dies Friday, nobody can Send Pairings, reopen a card, mark Complete, or email. Pre-write and keep on paper: the SQL that promotes a backup (`update player set is_commissioner = true where name = '...'`), the dashboard login, and where the service key lives. Note that Kyle in player view still carries commissioner RLS, so a tap on another group's card is accepted server side; be aware, not a bug.

### G2. Deploys during play. Medium

With autoUpdate every open phone reloads on a deploy (A12). Freeze deploys from Wednesday 9 pm to Saturday 6 pm unless a blocker demands it, and if it does, deploy between rounds.

### G3. The first Wi-Fi open. High, none

The service worker precaches the shell only after the app has been opened online once (checked fine). A player who installs from the invitation and never opens the app until the cart has one bar gets D2. The week-out email should say: open the app once on Wi-Fi, sign in inside it, and leave it on your home screen.

### G4. Scorers named the night before. High, none

A4 in operational form. Wednesday, Thursday and Friday night the desk should show a named scorer for every group before anyone goes to bed.

### G5. Paper. Low

Print two blank scorecards per group per day. Not because the app will fail, but because the fix for every blocker above starts with "what did the paper say".

### G6. Battery. Low

Scorers' phones are the ones that matter; a cable in each cart and a battery pack in each bag. Screen-on scoring for five hours on a bright screen is most of a phone.

---

## H. The public site (thefreemancup.com)

### H1. Until pairings post, the site says "First tee 12:00am". High, S

Scene. For the three weeks before Oct 8 the family sees "First tee Thursday, October 8 · 12:00am" under the countdown, the Next-up card says "2 four-ball matches go off from 12:00am at Mammoth Dunes", and the weather window is labeled "12a to 5a". The same happens between rounds for every not-yet-posted round. The TBD rows in the day block use the tee groups and are right, which makes it worse.

Evidence. `src/scoreboard/Scoreboard.tsx:67-70` derives `teeTime` from matches (`tees[0] || '00:00:00'`); matches exist only after `reveal_sheets`.

Fix. Keep the raw tee-group times per round in `shape.ts` and use `tees[0] || firstTeeGroupTime`.

### H2. No Open Graph or Twitter tags, no canonical. Medium, S

Evidence. `scoreboard.html:1-19` has only a description meta. iMessage, WhatsApp, and Facebook previews are text-only; www and apex are two duplicate URLs to crawlers.

Fix. `og:title`, `og:description`, `og:image` (1200 by 630 under `/brand/`, already excluded from the rewrite), `og:url`, `twitter:card`, and a canonical on the apex.

### H3. The round-by-round accordion opens the wrong day on the morning of a round. Medium, S

Evidence. `Scoreboard.tsx:127,177`: before any score, today's round is `upcoming` but in `onCourse`, so it is excluded from `next` and tomorrow's day opens by default.

Fix. `open={r.state === 'live' || onCourse.includes(r) || (!onCourse.length && r === next)}`.

### H4. After the first load, a dead backend is never surfaced. Medium, S

Evidence. `Scoreboard.tsx:86-87,105` the catch reads a stale `snap` closure and `err` only renders when `d` is null. If Supabase is unreachable Saturday afternoon the page shows old scores with the Live pill pulsing and the footer promising "within a minute". No request timeout and no in-flight guard.

Fix. Track `lastOkAt`; past three intervals show "Last updated 10:42 · reconnecting" and stop the pulse; guard `run()` with an in-flight flag and a timeout.

### H5. Contrast on the site fails AA for small text. Medium, S

Evidence. `scoreboard.css:8` `--moss-dim` on `--ink` is 3.3:1 at 11 to 14.5px in `.striplbl`, `.sect .sub`, `.holenote`, `.mvp .r .rd`, `.team .th .rn`, `.wxc .h`, the footer; `--red` on ink 3.5:1 at 14px in `.tee .who .v`; white on `--blue` 3.8:1 in the halved and Celts win rows. The 52px numbers are fine.

Fix. Same token lift as D3, and the lighter tints already defined at `scoreboard.css:335` for small red and blue text.

### H6. Accordions are mouse and touch only. Low, S

Evidence. `.hx,.xp,.sc-x,.dx{display:none}` removes the checkboxes from the tab order and the accessibility tree; no `<h1>`. Visually-hidden pattern with `:focus-visible` on the label, or `<details>`.

### H7. The rest. Low, S each

"Day N of 4" counts rounds not days (`Scoreboard.tsx:245-247`; Friday afternoon reads Day 3 of 4). Null weather hours render 0° and snow shows as rain (`weather.ts:46-53`; it is October in Wisconsin). King's Race ties are hidden, first alphabetical gets the crown (`standings.ts:133-134`; show T1 and crown both, and have `mvp()` return the tied set). The catch-all rewrite serves HTML for `/favicon.ico` and `/robots.txt` (`vercel.json:49-66`). No long-lived cache headers on hashed assets. The boot screen shows raw error text to family (`Scoreboard.tsx:105`) and a null RPC result throws before any guard (`shape(null)`). `public_scoreboard()` has no `event_id` filter, fine with one event, a 2027 row would merge both years.

### Checked and fine

Phase logic through the week (pre with a correct day count, live before the tee, Next-up between rounds, final only when all points are decided, November stays final with weather hidden). Frost delay flows through on the next poll. One group started reads right. 12-hole rounds key everything off `s.holes`. First names only with ellipsis. Players table pre-trip shows par. Safari and iOS quirks handled (`<use href>`, Intl with timeZone, reduced motion). Moments HTML escaped. Anon RPC exposes nothing private and tables have no anon select. Domain routing handles www and apex, `/playersignin` redirects to the app, the mailer is unreachable on the public host. The service-worker reset script is served only on the public host and cannot loop. The shootout renders on the site (the fix from Sep 11).

---

## What the two artifacts show

The wireframe journeys draw seven of the scenes above as frames with the moment of failure marked: the dead phone on 6 (A3, A4, A5), the lost correction (A1), the Sep 27 install (C6, D1, G3), the Thursday-morning clear (C1), the Friday clinch (E3, E2), the email link (D7, B1), and the family's first look at the site (H1, H2).

The hi-fi prototype shows the fixes I would build first, in the app's own tokens: the pencil takeover with confirm, the offline error screen with Try again and the stale-data banner, the pre-trip waiting screen with a dated deadline, the finale card with honors held until Saturday and the strip kept underneath, the poster with a real Close and a Share, the contrast lift side by side, and the site's pre-trip hero and link preview.
