# The Freeman Cup: user story library

A library of user stories for the Freeman Cup app (freeman-cup.vercel.app) and the public site (thefreemancup.com), written to pressure test the build with a round of QA, surface gaps, and seed the improvements list. It follows the whole journey: the invitation email on Sep 27, the week out, the trip itself (Oct 8 to 10), the goodbye, the off-season, and the first day of the 2027 Cup.

## How to read this

Every story has an id, a one-line story, and a "Pass when" line that says what QA should see. Each carries a status that reflects my best understanding of the build as of Sep 10; QA is what confirms it.

- **Built**: expected to pass today.
- **Partial**: some of it exists; the Pass line says what is missing.
- **Not built**: nothing exists for it yet. A candidate for the quick-fix or 2027 list.
- **Verify**: designed and probably built, but I would not bet on it without a test.
- **Passed (Sep 10)**: seen working in the QA pass of Sep 10, on the deployed app or in the phone-width harness.
- **Fixed (Sep 10)**: found wanting on Sep 10 and fixed the same day; the commit is named. Re-check once deployed.

QA log, Sep 10: signed-in walkthrough of every tab and the settings sheet in Chrome; every trip state and moment rendered from fixture data at 390px; a live Round 2 scored on Kyle's phone as Group B's scorer (six holes, a pick-up, a handoff, an edit, two holes in airplane mode, then out to 12 and submit) while the feed and Scoreboard were watched from a second device.

Stories are grouped by user type. A person can be several types at once (Kyle is a player, a captain, and the commissioner; any player can be that group's scorer for a round). Permissions are cumulative in that order.

| Type | Who | What they can do that the type below cannot |
|---|---|---|
| Public viewer | Anyone with the link to thefreemancup.com | Read the public scoreboard. Nothing else. |
| Invitee | One of the eight, before his first sign-in | Sign in with a code. Nothing until his seat is claimed. |
| Player | All eight, signed in and seated | See everything in the app, open his letter, read cards, browse the rulebook, view the feed. |
| Scorer | The one elected player per tee group, per round | Enter and fix gross scores for his group's card, hand off the pencil, submit the card. |
| Captain | Kyle (Celts) and the Vikes captain | Seal a lineup for each team round, open the other side's envelope, settle disputes, putt the Shootout. |
| Commissioner | Kyle, only while "acting as commissioner" | Seats and handicaps, round state, Send Pairings, reopen cards, enter the Shootout, send emails. |

A note on the "acting as" switch: the commissioner's phone is a player's phone by default. Everything below the gear reads the effective role, so a story for Player must pass on Kyle's phone in player mode, and a story for Commissioner must fail there.

---

## 1. Public viewer (thefreemancup.com)

The site has no sign-in. It is for wives, friends, and anyone a player sends the link to. It reads the same data the app does and never shows anything a player would consider private (letters, sheets, the commissioner's desk).

**PV-01** As a visitor before the trip, I want a countdown and the schedule so I know when to start watching. Pass when: with no round live and no cards in, the page shows the countdown to Oct 8, the four rounds with course and format, and placeholders where scores will go. Status: Passed (Sep 10).

**PV-02** As a visitor, I want the two rosters with captains marked so I know who is who. Pass when: Celts listed first, Vikes second, captain marked, handicap beside each name. Status: Passed (Sep 10).

**PV-03** As a visitor, I want to understand the format in a minute. Pass when: "How the cup works" folded under the cup strip explains four rounds, ten points, first to 5½, the Shootout, and the 2 / 1 hole points. Status: Passed (Sep 10).

**PV-04** As a visitor during a round, I want to see every match live with the state in the middle. Pass when: each match card shows Celts on the left, Vikes on the right, holes played, and the state ("2 up thru 7", "AS", "Dormie", "Final 3 & 2"). Updates without a manual refresh within a minute of a score landing. Status: Built (verify the refresh cadence).

**PV-05** As a visitor, I want the latest moments per match so I can follow along without the app. Pass when: the last five moments per card with an expander, each naming the hole, the standout score, and the new state. Status: Passed (Sep 10).

**PV-06** As a visitor, I want the cup strip so I can see who is closer to the Lassie. Pass when: points per side, the clinch line, and the stripes move as matches finalize. Status: Passed (Sep 10).

**PV-07** As a visitor, I want the full scorecard of any match. Pass when: the scorecard accordion opens to gross, net dots, and hole results for every player in the match. Status: Passed (Sep 10).

**PV-08** As a visitor, I want the King's Race so I can see who is playing best. Pass when: the Race table on a solid ink-2 panel, crown on the leader, points and record per player, no Player of the Round on the site. Status: Passed (Sep 10).

**PV-09** As a visitor, I want a weather strip so I know what the guys are playing in. Pass when: the five-hour forecast strip appears at the top of "Out on the course" while a round is live. Status: Built (verify the forecast source is not rate limited on a busy afternoon).

**PV-10** As a visitor, I want the day's results after the round. Pass when: Round by round accordion for each finished day, with finals and the Player of the Round omitted. Status: Passed (Sep 10).

**PV-11** As a visitor, I want the site to work on my phone in a text thread. Pass when: the link previews with a title, description, and the badge image when pasted into iMessage or a group text. Status: Verify (Open Graph tags).

**PV-12** As a visitor, I want the site to reach a sensible end state. Pass when: after the Cup is decided, the site leads with the winner, the final score, the Shootout if it happened, and the MVP; the countdown does not reappear. Status: Verify.

**PV-13** As a visitor after the trip, I want to still find the 2026 results a year later. Pass when: the site shows the 2026 Cup, in full, until the 2027 Cup exists, and then keeps it under a year selector. Status: Not built (see section 8).

---

## 2. Invitee (from the email to a claimed seat)

The invitation goes out as a Resend broadcast on Sep 27. The path is: read the email, add the app to the home screen, open it from the home screen, ask for a code, type it, land on a claimed seat.

**IN-01** As an invitee, I want the invitation to tell me what the Cup is, who I am playing for, and the one thing I must do. Pass when: the Celts and Vikes invites arrive with the right team, the teammates listed, the dates, and the "add to home screen first, then sign in" instruction. Merge tag renders the first name (falls back to "gentlemen" if missing). Status: Built (the teammate lines still need filling).

**IN-02** As an invitee, I want the email to look right in whatever I read it in. Pass when: Apple Mail light and dark show the ink green; Gmail dark shows the green masthead over a pale body; nothing is unreadable in any of them. Status: Built (Gmail dark on a real send still to be seen).

**IN-03** As an invitee, I want the link in the email to open the app in a browser without errors. Pass when: the link opens freeman-cup.vercel.app to the sign-in screen. Status: Passed (Sep 10).

**IN-04** As an invitee on iPhone, I want to add the app to my home screen without knowing how. Pass when: the sign-in or a first-run screen explains Share, then Add to Home Screen, and the installed app has the badge icon, the right name, and no browser chrome. Status: Fixed (Sep 10, 2485553): the sign-in screen tells a browser visitor to add the Cup to the home screen first; the line hides inside the installed copy.

**IN-05** As an invitee on Android, I want the same thing. Pass when: Chrome offers the install prompt or the app explains the menu path; the installed app has the icon and name. Status: Verify.

**IN-06** As an invitee, I want to sign in with my email and a code, no password. Pass when: entering the invited address sends a six-digit code within a minute; the code screen accepts it; a wrong code says so and lets me try again; the code expires after an hour and says so. Status: Passed (Sep 10).

**IN-07** As an invitee, I want the code email to look like the rest of the Cup. Pass when: the sign-in email arrives with the new masthead and wallpaper and the code is easy to read and copy. Status: Passed (Sep 10).

**IN-08** As an invitee, I want the code to be easy to enter. Pass when: iOS offers the code from the email as an autofill suggestion above the keyboard; pasting the six digits fills the field. Status: Verify.

**IN-09** As an invitee who typed the wrong address, I want to know that rather than wait for nothing. Pass when: an address that is not on the roster either says so before sending or lands on the "No seat for this email" screen with "Ask Kyle to add it" and a Sign out button. Status: Built (the no-seat screen exists; verify the message when the address has no auth user at all, since Supabase may silently send nothing).

**IN-10** As an invitee, I want my seat claimed automatically the first time I sign in. Pass when: signing in with the invited address lands on the app as that player, with the right team, no extra step. Status: Passed (Sep 10).

**IN-11** As an invitee, I want to stay signed in. Pass when: closing and reopening the home-screen app a week later does not ask for a code again; the session lasts through Oct 10 without a prompt. Status: Passed (Sep 10).

**IN-12** As an invitee who signed in inside Safari instead of the home-screen app, I want to understand why the home-screen app still asks me. Pass when: the sign-in screen has one line saying the home-screen copy keeps its own sign-in. Status: Fixed (Sep 10, 2485553).

**IN-13** As an invitee, I want the app to work if I never install it. Pass when: everything a Player can do works in Safari or Chrome as a plain website. Status: Passed (Sep 10).

---

## 3. Player (all eight, the whole trip)

### 3a. Before the trip

**PL-01** As a player, I want a "one week out" email with the schedule and a nudge to install. Pass when: the email arrives Oct 1 with the four rounds, tee times if known, the countdown, and the home-screen reminder. Status: Built (sent by hand from Today, Emails).

**PL-02** As a player before the trip, I want the app to show me something useful, not an empty scoreboard. Pass when: Cup tab shows the strip at 0 to 0, the countdown, the field, and the King's Race at zero; Schedule shows all four rounds as upcoming with course and format; Scoreboard says no round is live. Status: Passed (Sep 10).

**PL-03** As a player, I want to see my own handicap and my teammates' before the trip so I can argue about strokes early. Pass when: the field shows each player's index. Status: Built.

**PL-04** As a player, I want to read the rulebook any time. Pass when: the book icon in the header opens the rulebook from every tab; articles scroll; search finds "gimme", "OB", "pick up", "mully", "tie"; quick chips work; a cross reference jumps. Status: Passed (Sep 10).

**PL-05** As a player, I want the rulebook to be the current rules. Pass when: Art. 3 says 90% four-ball and full difference singles and aggregate, Commons prorated; Art. 4 says pick up at +2 for par plus four; Art. 11 says 2 alone and 1 together. Status: Passed (Sep 10).

**PL-06** As a player, I want to know which tees we are playing. Pass when: the Schedule shows the tee for each course once the commissioner posts it. Status: Fixed (Sep 10, 4d4d703): round.tee and round.yards; shown on the Schedule, the letter, the pairings email and the site once the commissioner posts them.

**PL-07** As a player, I want to know the sand ruling before Thursday. Pass when: Art. 6.3 no longer says "settled before Thursday and posted here" and states the ruling. Status: Not built (content decision for Kyle).

### 3b. The night before a round

**PL-08** As a player, I want my pairings letter on my phone when the commissioner sends them. Pass when: after Send Pairings, opening the app shows a sealed envelope; tapping opens my letter with my partner, my opponents, the course, my tee time, and my stroke tiles. Status: Passed (Sep 10).

**PL-09** As a player, I want the letter to be easy to scan on a phone at dinner. Pass when: the envelope is centered, the stroke tiles read at a glance (my side first, low man dashed, mine outlined in brass), and "Your dots" and "First tee" rows are correct for my match. Status: Passed (Sep 10).

**PL-10** As a player, I want the pairings email too, in case I am not looking at the app. Pass when: the email version arrives when the commissioner sends it, with the same partner, opponents, tee time, and strokes as the letter. Status: Built.

**PL-11** As a player, I want to see every match for tomorrow, not just mine. Pass when: after the letters go out, the Schedule shows all four matches for the round with tee times, Celts first. Status: Passed (Sep 10).

**PL-12** As a player, I want to reopen my letter later. Pass when: the letter can be reopened from the Schedule or the round card after the envelope has been opened once. Status: Passed (Sep 10).

**PL-13** As a player, I want to know when the letters are coming. Pass when: before Send Pairings, the round shows a line like "Pairings tonight" or the 9 pm deadline, so nobody keeps refreshing. Status: Verify.

### 3c. On the course, not scoring

**PL-14** As a player, I want to see my own match live on the Scoreboard tab. Pass when: the Scoreboard opens on the live round, my match is easy to find, and the card shows gross, dots, hole results, and the match state; I cannot edit anything. Status: Passed (Sep 10).

**PL-15** As a player, I want to see the other group's match. Pass when: switching to the other match shows their card and state as their scorer enters it. Status: Passed (Sep 10).

**PL-16** As a player, I want to see my stroke holes before we tee off. Pass when: dots on the scorecard match the letter. Status: Passed (Sep 10).

**PL-17** As a player, I want the Cup tab to tell me the state of the Cup without reading. Pass when: the strip shows points and the clinch, the stripes are smooth, and the last-sync line under the header is recent. Status: Passed (Sep 10).

**PL-18** As a player, I want the feed to show the important things and not noise. Pass when: holes won with birdies and eagles, lead changes, dormie, finals, and card-in show; scorer switches do not; the feed shows five entries with Show all. Status: Passed (Sep 10).

**PL-19** As a player, I want to be told what I could not see. Pass when: when the other group's match goes final or dormie, or the Cup lead changes, my phone gets a push; birdies do not push; a push waits 90 seconds so a correction cancels it. Status: Verify: still the biggest open item; needs a real installed iPhone.

**PL-20** As a player, I want the app to survive no signal. Pass when: with airplane mode on, every tab still opens with the last data and says how old it is; nothing crashes; on reconnect it refreshes without a reload. Status: Passed (Sep 10).

**PL-21** As a player, I want the King's Race on the Cup tab. Pass when: the Race shows points per player with a crown on the leader, a "How points work" chip that opens Art. 11, and Player of the Round below. Status: Passed (Sep 10).

**PL-22** As a player, I want to see the stars on holes I won. Pass when: two gold stars on a hole won alone, one on a hole won together, none for a halve, loss, or pick-up; bye holes still earn them. Status: Passed (Sep 10).

### 3d. After the round

**PL-23** As a player, I want the match result moment when my match finishes. Pass when: the match card takeover appears once on my phone after the card is submitted, with the result, the story, and a tertiary Close; it does not reappear after Close. Status: Passed (Sep 10).

**PL-24** As a player, I want the Player of the Round revealed with some ceremony. Pass when: the Schedule round card shows "Player of the round · View" with no name; View opens the card with the name, points, and second place. Status: Passed (Sep 10).

**PL-25** As a player, I want a day recap I can screenshot. Pass when: once every card for the day is in, the Day Recap moment opens with every match, the lead-change bars, the one-line story per match, spacing between Commons and Sand Valley, no Tomorrow line, and Close. Status: Passed (Sep 10).

**PL-26** As a player, I want the recap in my inbox too. Pass when: the recap email arrives after the commissioner sends it, with the day's results, the stories, and the Player of the Round. Status: Built.

**PL-27** As a player, I want my own card for the week. Pass when: tapping my name in the field opens my player card with record, points, and the week in review. Status: Passed (Sep 10).

**PL-28** As a player, I want to find a moment I closed too fast. Pass when: every moment that has fired can be reopened from somewhere (the Schedule round card, the match, or the feed). Status: Verify (match and Player of the Round have chips; check day recap and finale).

### 3e. Saturday and the finale

**PL-29** As a player, I want the singles to feel different. Pass when: Saturday's four matches show as singles with the right strokes (full difference off the lower man). Status: Passed (Sep 10).

**PL-30** As a player, I want the clinch to land on my phone the moment it happens. Pass when: when a side reaches 5½ the finale moment opens on every phone, names the winner, the score, the MVP and the Medalist; the Cup tab shows the Lassie's new home. Status: Passed in the harness (Sep 10); MVP and Medalist lines added c3831c3; the push itself is PL-19.

**PL-31** As a player, I want to watch the Shootout if it is 5 to 5. Pass when: the Shootout moment shows the three stations, each captain's strokes as the commissioner enters them, and the winner; the feed notes the Knee Knocker replay if it happens. Status: Passed (Sep 10).

**PL-32** As a player, I want the finale email as a keepsake. Pass when: it arrives with the winner, the final score, the MVP, the Medalist, and the Shootout if any. Status: Built.

**PL-33** As a player, I want the app to feel finished on Sunday morning, not stuck mid-round. Pass when: Cup tab leads with the result, Scoreboard shows the last round as final, Schedule shows all four rounds final, and no live pulse remains. Status: Verify.

### 3f. Account

**PL-34** As a player, I want to sign out and back in. Pass when: Sign out from the gear returns to the sign-in screen; signing back in restores my seat with nothing lost. Status: Passed (Sep 10).

**PL-35** As a player, I want to sign in on a second device. Pass when: a laptop sign-in with the same email works alongside the phone; both see the same data; scoring lock rules still hold (only one scorer per group). Status: Verify.

**PL-36** As a player, I want to know what the app does with my email. Pass when: the invitation or sign-in screen says the address is used only to sign in and for the six emails of the week. Status: Fixed (Sep 10, 2485553): one line under the sign-in form.

---

## 4. Scorer (one per tee group, per round)

The scorer is a player who holds the pencil. The role is per group and per round, elected before the round, and can be handed off. Only the scorer can edit the group's card until it is submitted.

**SC-01** As a group, we want to elect our scorer on the first tee. Pass when: with no scorer set, any player in the group can take the pencil from the Scoreboard tab; the group's card shows who holds it. Status: Passed (Sep 10); the brief reads "You keep the card for your group" when it is you (4d4d703).

**SC-02** As the scorer, I want to enter gross scores fast with a glove on. Pass when: each hole shows big number targets for every player in the group; a tap sets the gross; the hole result derives instantly; the next hole is one tap away. Status: Passed (Sep 10).

**SC-03** As the scorer, I want the app to apply strokes and decide the hole. Pass when: net is shown from gross and dots, the better ball (four-ball), the sum (aggregate), or the single ball (singles) decides the hole, and the match state updates. Status: Passed (Sep 10).

**SC-04** As the scorer, I want to enter a pick-up correctly. Pass when: I enter par plus four as the gross; the rulebook chip or hint on the hole says so; the app treats it as a loss for hole points and still counts the partner's ball. Status: Fixed (Sep 10, 43351d1): the par-plus-four tile is captioned "Pick up" and a note under the stroke legend explains the rule on any hole where one went in.

**SC-05** As the scorer, I want a conceded hole or a halved-by-ruling hole to be enterable. Pass when: there is a way to mark a hole won, lost, or halved without gross scores, and it is logged as such. Status: Verify (Art. 4.3 and 10.2 need it; check whether the card allows a result without scores).

**SC-06** As the scorer, I want to fix a wrong score. Pass when: going back to a hole and changing a gross re-derives that hole and every state after it; the feed corrects itself; a push held for the old result is cancelled. Status: Passed (Sep 10).

**SC-07** As the scorer, I want to hand the pencil to a teammate or opponent. Pass when: the handoff is one tap, the other player's phone gains the edit controls within seconds, mine loses them, and the handoff is logged but not in the feed. Status: Passed (Sep 10).

**SC-08** As a player who is not the scorer, I want to be unable to edit even by accident. Pass when: no gross target responds to a tap on a non-scorer's phone; the row security refuses a write if the client is bypassed. Status: Passed (Sep 10).

**SC-09** As the scorer, I want scoring to survive no signal. Pass when: in airplane mode I can enter six holes; the card shows the queued state; when signal returns the holes sync in order and nothing is lost or duplicated. Status: Passed (Sep 10).

**SC-10** As the scorer, I want to know when my last entry actually reached the server. Pass when: a visible sync indicator turns from queued to synced per hole, or a single "last synced" line moves. Status: Verify.

**SC-11** As the scorer whose phone dies, I want the group to carry on. Pass when: another player in the group can take the pencil without my phone; when my phone comes back its queued holes do not overwrite newer ones. Status: Verify (last-write-wins on a match_hole row; check the timestamps protect the newer entry).

**SC-12** As the scorer, I want the match to end when it is decided and to keep scoring the byes. Pass when: at dormie and then at a decided match the state says "Final 3 & 2" but the card keeps accepting gross for the remaining holes; those holes earn hole points. Status: Passed (Sep 10).

**SC-13** As the scorer, I want to submit the card after the last hole. Pass when: Submit is offered only when every hole has scores; submitting locks the card, posts card-in to the feed, and fires the match result moment. Status: Passed (Sep 10).

**SC-14** As the scorer, I want to be warned if I submit with a missing hole. Pass when: holes missing gross for any player are listed before I can submit, or submit is disabled with the reason. Status: Verify.

**SC-15** As the scorer, I want a wrong score after submit to be fixable by the commissioner only. Pass when: after submit, my edit controls are gone; the commissioner can reopen the card; after the fix, the card can be re-submitted and the moment and feed update. Status: Passed (Sep 10).

**SC-16** As the scorer at The Commons, I want the 12-hole card. Pass when: the card shows 12 holes, prorated strokes, and submit after the 12th. Status: Passed (Sep 10).

**SC-17** As the scorer, I want the two-balls note for a dispute. Pass when: there is a way to record a note on a hole (which ball was played, both outcomes) for the captains to rule on. Status: Not built (Art. 10.1 promises it; a hole note field would do).

---

## 5. Captain (Kyle and the Vikes captain)

**CA-01** As a captain, I want to seal my lineup the night before a team round. Pass when: from the Scoring tab the captain's sheet opens for the next round; I fill the slots; the rotation rule warns if a teammate has already been paired with that partner; Seal locks it and shows the time. Status: Passed (Sep 10).

**CA-02** As a captain, I want handicaps beside names on the sheet. Pass when: each name on the sheet shows the index. Status: Passed (Sep 10).

**CA-03** As a captain, I want to know the other side has sealed without seeing their sheet. Pass when: the sheet status shows "Vikes sealed 7:42 pm" with no lineup visible. Status: Passed (Sep 10).

**CA-04** As a captain who forgets, I want the app to cover me. Pass when: at 9 pm a missing sheet is defaulted, marked auto, and the commissioner can still Send Pairings. Status: Built (verify the 9 pm default fires without the app open, or that it is applied at reveal time).

**CA-05** As a captain, I want to change my mind before the reveal. Pass when: an unseal or re-seal is possible until the commissioner sends pairings, and it is logged. Status: Verify.

**CA-06** As a captain, I want to see the other side's sheet once pairings are sent. Pass when: after Send Pairings the full matchups are visible to everyone and the sheets are readable. Status: Passed (Sep 10).

**CA-07** As a captain, I want a singles lineup on Friday night. Pass when: the sheet for Saturday takes four singles slots per side; the pairing is slot against slot. Status: Passed (Sep 10).

**CA-08** As a captain, I want a place to settle a dispute. Pass when: a disputed hole from a group (SC-17) shows to both captains with the two outcomes; agreeing sets the result; failing to agree halves the hole; the match recomputes. Status: Not built (the rule exists, the tool does not; for 2026 the commissioner reopens the card and sets it by hand).

**CA-09** As a captain in the Shootout, I want to see the stations and my strokes as they are entered. Pass when: the Shootout view shows Long Rail, Fringe, Knee Knocker, max five per station, the running total, and the replay of the Knee Knocker if level. Status: Passed (Sep 10).

---

## 6. Commissioner (Kyle, acting as commissioner)

### 6a. The switch

**CM-01** As the commissioner, I want to act as a player by default. Pass when: on a fresh open the app is in player mode; no commissioner controls show; the crown is absent. Status: Fixed (Sep 10, 4d4d703): in player mode the sheet is titled Settings and shows only the switch and the account.

**CM-02** As the commissioner, I want to arm the role deliberately. Pass when: the gear offers "Act as commissioner"; when on, the crown shows in the header and the Today and Event tabs appear; it stays on until switched off, and survives a reload. Status: Passed (Sep 10).

**CM-03** As the commissioner, I want commissioner writes refused when I am in player mode. Pass when: with the switch off, nothing on the phone can reveal pairings, reopen a card, or send mail. Status: Fixed (Sep 10, 4d4d703): the three commissioner tabs exist only while armed.

### 6b. Setup (before Sep 27)

**CM-04** As the commissioner, I want to seat the eight players with emails and handicaps. Pass when: Event tab, Seats lists eight rows with name, team, captain flag, email, and index; editing saves; a placeholder address is obvious. Status: Fixed (Sep 10, 4d4d703): email and index edit in place on the Event tab; placeholder addresses flagged "No email".

**CM-05** As the commissioner, I want to know which seats are not yet claimable. Pass when: Seats marks rows whose email has no auth user or whose auth_uid is not linked, so I can fix it before the invitations go out. Status: Partial (Sep 10): the Seats tab flags placeholder addresses; a missing auth user still needs SQL (see HANDOFF).

**CM-06** As the commissioner, I want to freeze handicaps. Pass when: indexes can be edited until Wednesday and then locked, and the rulebook date matches. Status: Verify (a lock may not exist; a rule that they are not touched is enough for 2026).

**CM-07** As the commissioner, I want to post the tee for each course. Pass when: each round carries a tee name and yardage that the Schedule and the site show. Status: Fixed (Sep 10, 4d4d703): Event, Tees.

**CM-08** As the commissioner, I want to set the sand ruling. Pass when: Art. 6.3 text is editable or the decision is made in the code before freeze. Status: Not built (content).

**CM-09** As the commissioner, I want to send the invitations. Pass when: the two invite files, with teammates filled in, go as Resend broadcasts to the two segments; a test broadcast to me first. Status: Partial (files exist; teammate lines and the Resend audience are pending).

**CM-10** As the commissioner, I want to send the one-week-out email. Pass when: Today, Emails, One week out, Send me a test, then Send to everyone; the row shows Sent with the time; a second real send is refused. Status: Passed (Sep 10).

### 6c. Each evening

**CM-11** As the commissioner, I want to see both sheets are in. Pass when: Today shows each team's sealed time or "not yet", and the 9 pm default state. Status: Passed (Sep 10).

**CM-12** As the commissioner, I want to send pairings with one tap. Pass when: Send Pairings builds matches from the two sheets in slot order, sets tee groups and tee times, marks the round revealed, and drops a sealed letter on every phone. Status: Passed (Sep 10).

**CM-13** As the commissioner, I want to set tee times. Pass when: tee times per group can be entered before Send Pairings and show on the letters, the Schedule, and the site. Status: Built (verify the edit path).

**CM-14** As the commissioner, I want to email the letters. Pass when: Today, Emails, the round's Pairings row unlocks after Send Pairings; test shows me my own letter; Send to everyone sends each player his; the row shows Sent. Status: Passed (Sep 10).

**CM-15** As the commissioner, I want to undo a bad reveal. Pass when: if a sheet was wrong, I can unreveal, fix, and resend before anyone tees off, and the letters replace themselves. Status: Verify (the email cannot be unsent; the app side should allow it).

**CM-16** As the commissioner, I want to send the day recap only when the day is truly done. Pass when: the Recap row stays locked until every card for the day is submitted; it never sends on its own. Status: Passed (Sep 10).

### 6d. During a round

**CM-17** As the commissioner, I want to set a round live and final. Pass when: Today, Rounds lets me move a round between upcoming, live, and final; the header pulse and the site follow. Status: Passed (Sep 10).

**CM-18** As the commissioner, I want to reopen a submitted card. Pass when: a submitted card shows Reopen to me alone; reopening restores the scorer's controls; the fix and re-submit update feed and moments. Status: Passed (Sep 10).

**CM-19** As the commissioner, I want to take the pencil from any group if I must. Pass when: I can assign the scorer for any tee group from Today. Status: Verify.

**CM-20** As the commissioner, I want to fix a score myself in a pinch. Pass when: with the role armed I can edit any hole in any match; the edit is logged as mine. Status: Verify.

**CM-21** As the commissioner, I want to lock a round so nothing changes after the captains have ruled. Pass when: the round's locked flag stops all writes, including mine, until unlocked. Status: Built (locked exists on the round; verify the UI).

### 6e. Saturday

**CM-22** As the commissioner, I want the Shootout to appear only when it is needed. Pass when: at 5 to 5 after the last singles card, Today offers Enter the Shootout; not before. Status: Passed (Sep 10).

**CM-23** As the commissioner, I want to enter the Shootout stroke by stroke. Pass when: each captain, each station, max five, running totals; Knee Knocker replay adds a station; Done fires the finale for the right winner. Status: Passed (Sep 10).

**CM-24** As the commissioner, I want to send the finale email. Pass when: the Finale row unlocks on the clinch or Shootout; test, then send; it names the winner, score, MVP, Medalist, Shootout. Status: Passed (Sep 10).

### 6f. Safety

**CM-25** As the commissioner, I want a mistaken send to be hard. Pass when: Send to everyone always asks "Send to N?" first; the count matches the number of real addresses; tests never count as sent. Status: Passed (Sep 10).

**CM-26** As the commissioner, I want to know an email went out even from another phone. Pass when: the Sent time shows on every device, since it comes from the feed_event log. Status: Passed (Sep 10).

**CM-27** As the commissioner, I want to see why a send failed. Pass when: each failure reads as one of the five messages in MAIL-SETUP.md. Status: Passed (Sep 10).

**CM-28** As the commissioner, I want a way to see what the players see. Pass when: switching the role off shows exactly a player's app, letters and moments included. Status: Passed (Sep 10).

---

## 7. The goodbye (Saturday night and Sunday)

**GB-01** As a player, I want the finale to be the last thing the app says, and to stay there. Pass when: reopening the app after the Cup is decided lands on the result, not a live scoreboard; every tab reads as final. Status: Verify (see PL-33).

**GB-02** As a player, I want the week in review on my card. Pass when: my player card shows record, hole points, best round, Player of the Round if I won one, and the MVP if it was me. Status: Passed (Sep 10).

**GB-03** As a player, I want a moment I can post. Pass when: the finale, day recaps, my player card, and any match card screenshot cleanly as 9:16 with nothing cut off on an iPhone 15 and a Pixel. Status: Passed (Sep 10).

**GB-04** As a player, I want the Lassie's holder recorded. Pass when: the Cup tab and the site name the 2026 holder; the finale email says who takes the Lassie home. Status: Verify (the event has a trophy field; holder may need a line).

**GB-05** As the commissioner, I want a final export of the week. Pass when: I can pull every card, every match, the standings, and the Race as a file (CSV or JSON) for the record. Status: Not built.

**GB-06** As a player, I want to stop receiving anything I did not ask for. Pass when: the only emails after Saturday are the finale and nothing else; no unsubscribe is needed because nothing recurs. Status: Built.

---

## 8. The off-season and the next Cup

Kyle's brief: a clean slate for the next Cup, and a place to reach the previous year's scores and data. The schema already has an `event` row with a `year`, and every team, player, round, and match hangs off an event, so the data model supports this. What is missing is the app and site choosing an event, and an archive view.

**OS-01** As a player in the off-season, I want the app to show the last Cup, not a broken live view. Pass when: between Cups the app opens on the most recent event's finale state with the full results readable; no countdown to a past date; no live pulse. Status: Not built (today the app loads the single event; confirm what it shows on Oct 11).

**OS-02** As the commissioner, I want to start the 2027 Cup without touching 2026. Pass when: creating a new event (name, year, venue, trophy, clinch points) makes it the current one; teams, seats, rounds, and courses are set up fresh under it; 2026 rows are untouched. Status: Not built (SQL today; a Today or Event action later).

**OS-03** As a player, I want a clean slate on the first day of the new Cup. Pass when: opening the app after the new event is current shows zero points, no feed, no moments, the new schedule; nothing from last year bleeds in. Status: Not built (depends on OS-02 and every query filtering by the current event, which they already do).

**OS-04** As a player, I want to look back at 2026. Pass when: a Past Cups entry (gear, or a chip on the Cup tab) lists prior years; picking one shows the finale, the four days, every match card, the King's Race, and the MVP, read only. Status: Not built.

**OS-05** As a player, I want to carry my seat across years. Pass when: signing in with the same email in 2027 lands on my 2027 seat; my 2026 history is reachable from my player card. Status: Not built (auth user is per person; the player row is per event; a link between the two years is needed, most simply the email).

**OS-06** As a player, I want the all-time record. Pass when: the Lassie's holders by year, each player's career record and hole points, and the MVPs by year are shown somewhere small and permanent. Status: Not built (2027 idea; trivial once OS-04 exists).

**OS-07** As a visitor to the site, I want the same. Pass when: the site shows the current Cup by default and a year selector for past ones; the past view is the finale state, not a countdown. Status: Not built (see PV-13).

**OS-08** As the commissioner, I want the rulebook to carry the year. Pass when: the rulebook edition reads "Freeman Cup 2027" for the new event and the 2026 book stays with the 2026 archive. Status: Not built (the edition is a constant today).

**OS-09** As the commissioner, I want to carry handicaps and emails forward without retyping. Pass when: creating the new event offers to copy seats from the previous one, with indexes editable. Status: Not built (2027 convenience).

**OS-10** As the commissioner, I want the moments and feed of a past year to stay quiet. Pass when: opening a 2026 archive never auto-fires a moment or a push. Status: Not built (auto-open is keyed on unseen moments; the archive path must mark them seen or skip the auto-open).

**OS-11** As the commissioner, I want to retire the 2026 emails cleanly. Pass when: the Emails group only lists the current event's emails; 2026 send logs remain in feed_event under the 2026 event. Status: Not built (follows from OS-03).

---

### 3g. Decisions taken during QA (Sep 10)

- Light mode is shelved for 2026; every phone runs dark (4d4d703). XC-05 now reads: with the phone in light mode the app still renders ink green.
- The header reads "1st Annual Invitational" (4d4d703).
- The Clinched feed row rides the winner's team gradient with a brass tag instead of the cream block (c3831c3).
- The King's Race only counts a card as short against rounds that are in the book, so a round in play never knocks anyone off the board (3f77231). Art. 11.2 stands.
- Aggregate hole points follow the ball: the sum wins the hole, the lower net takes 2, matching nets take 1 each (2371197). Art. 11.1 rewritten.
- The Cup strip says "Celts have the points · cards still out" between the clinching putt and the last card (3f77231).
- The handoff log reads "Handed to JT by Kyle" when the scorer passes the pencil (6211093).

## 9. Cross-cutting stories

These apply to every user type and are worth a pass of their own.

**XC-01** Celts first, Vikes second, everywhere. Pass when: every list, card, strip, letter, email, feed line, and site table puts Celts first; the one exception is a leader-first headline ("Vikes lead, 2 to 0"). Status: Fixed (Sep 10, 4d4d703 and 3f77231): scoring strip, feed sublines, round finals, sheets, match editors, shootout rows and seats all Celts first; the leader-first headline is the one exception.

**XC-02** Every chip that opens something has a caret and is 32px tall. Pass when: View, How points work, Show all, match chips, and the rules chips all match. Status: Passed (Sep 10).

**XC-03** The app never shows an em-dash and uses American spelling. Pass when: a grep of the source and the emails finds neither. Status: Fixed (Sep 10, 4d4d703): em-dashes out of the scoring screen and settings copy.

**XC-04** The app works in landscape and on small phones. Pass when: an iPhone SE and a Pixel 7 show every screen without clipped chips or overlapped stripes. Status: Verify.

**XC-05** Dark is the only mode. Pass when: with the phone in light mode the app still renders ink green; nothing inverts. Status: Passed (Sep 10).

**XC-06** Fonts load offline. Pass when: Young Serif, Work Sans, and Barlow Condensed render from the self-hosted files with no signal. Status: Built (they are in public/fonts; verify the service worker caches them).

**XC-07** A fresh deploy does not strand an open phone. Pass when: after a new Vercel deploy, an app that was already open picks up the new version on next open without a stale cache or a blank screen. Status: Verify (service worker update strategy).

**XC-08** Time is local to Wisconsin. Pass when: tee times, Sent times, and moments show Central time on a phone set to Pacific. Status: Verify; tee times now read lowercase (12:00pm) everywhere (4d4d703).

**XC-09** Nobody can write what they should not. Pass when: the RLS integration suite passes against the live project (not just the offline run), for player, scorer, captain, and commissioner. Status: Built (run it online before freeze).

**XC-10** Nothing surprising happens on its own. Pass when: no email, push, or moment fires without either a score, a card, or a commissioner tap behind it. Status: Passed (Sep 10).

---

## 10. Gap register

Pulled from the Not built and Partial stories above, sorted into what fits before the Sep 13 freeze, what should be in before Oct 8 regardless, and what waits for 2027.

**Quick fixes worth doing before freeze** (Sep 10: IN-12, PL-36, SC-04 and the Seats warning are done)

- PL-07 and CM-08 Write the sand ruling into Art. 6.3.
- CM-05 The auth-user half of seating still takes SQL; a checklist in HANDOFF, or a warning when a seat's email has no auth user.
- The "Open the app" fine print in the four app emails and the invites (email links always open the browser).

**Must be true before Oct 8, freeze or not**

- CM-09 Invitations: teammate lines, Resend audience, test broadcast.
- PL-19 Push delivery verified on a real iPhone home-screen app, including the 90-second hold.
- SC-09 and SC-11 Offline queue and the dead-phone handoff tested on grass, not on Wi-Fi.
- XC-07 Service worker update path verified after a deploy.
- OS-01 Decide what the app shows on Oct 11 so it does not look broken during the goodbye.

**Gaps to accept for 2026 and fix for 2027**

- SC-05 Entering a conceded or ruled hole without scores (workaround: commissioner reopens and enters a gross that yields the result).
- SC-17 and CA-08 Dispute notes and a captains' ruling tool (workaround: the captains talk, the commissioner edits).
- GB-05 Export of the week's data.
- OS-02 through OS-11 The multi-year model: current event selection, Past Cups archive, seat carry-over, all-time records, year on the rulebook, site year selector.

**Content decisions only Kyle can make**

- The sand ruling (Art. 6.3).
- The tee per course (Art. 5.1), if the round does not yet carry it.
- The teammate lines in the two invitations.
