# The road to Oct 8: what is left

Written Sep 10 after the QA pass. Everything built today is in the repo and pushed except the last handful of commits, so the first item is the push. Items are grouped by the date they must be done by, and each names who does it: you, me, or the two of us with a phone.

## By Saturday Sep 13 (feature freeze)

Build, mine, all small:

- [x] Fine print under the "Open the app" button in the four app emails and the two invitations, saying email links always open the browser and the home-screen copy is the one to use.
- [x] Art. 6.3 sand ruling: all sand is waste area (ground the club, practice swings, loose impediments; play it as it lies).
- [x] Rulebook Art. 5.1 to mention that the tee and yardage show on the Schedule once posted (one sentence).
- [x] Seats: a "No account" chip on a row whose email has no auth user yet (seat_accounts RPC; run freeman-cup-accounts.sql once).
- [x] HANDOFF.md and USER-STORIES.md refreshed for the settings sheet reorganization and the captain's intro.

Decisions, yours:

- [x] The sand ruling: waste area.
- [x] The tee name and yardage for each of the four courses, typed into Settings, Rounds.
- [ ] Whether the finale poster (the "Celts take the Lassie" full-screen moment) should carry the dedication line too. Optional; yes or no.

Verify, both of us, in Chrome once the last push deploys:

- [ ] Walk the reorganized settings sheet (Today, Rounds, Emails, Setup) and the header toggle.
- [ ] Open the captain's intro for Round 3 in the rehearsal state and confirm the score line reads right with real data.
- [ ] The King's Race after the aggregate rule change: Devin 2, Matt 0 on that hole.

## By Saturday Sep 27 (invitations)

Yours:

- [ ] Collect the seven addresses.
- [ ] Type each into Settings, Setup, Seats (the "No email" chips go out as you go).
- [ ] Send me the list and I will write the SQL that creates the seven auth users and links them to the seats in one paste.
- [ ] Fill the teammate lines in emails/invite-celts.html and emails/invite-vikes.html (marked with an HTML comment), or send me the final rosters and I will.
- [ ] In Resend: create the audience with the seven contacts and first names, two segments (Celts, Vikes).
- [ ] Send yourself a test broadcast of each invitation from Resend; read both on your phone in Gmail dark once.
- [ ] Send the two broadcasts.

Mine:

- [ ] SQL for the auth users (above), the moment the list arrives.
- [ ] A last read of both invitation files for names, dates, tees.

## By Thursday Oct 1 (one week out)

- [ ] Freeze handicaps: confirm each index in Seats against GHIN on the Friday before, then leave them alone (Art. 3.1).
- [ ] Today, Emails, One week out: Send me a test, read it, Send to everyone.
- [ ] Ask each of the seven, in the group chat, to confirm the app is on his home screen and he has signed in inside it. Anyone who has not gets a nudge; the code email is instant.

## Before the first tee, Thursday Oct 8

- [ ] Run "Clear all scores" once from Setup, Start over, so the rehearsal rounds are gone and the captains' sheets take over.
- [ ] Confirm all four rounds read Not started, all seats Claimed, all tees posted.
- [ ] Wednesday night: Round 1 captains' sheets, Send Pairings, then Today, Emails, Pairings · Round 1 (test, then everyone).
- [ ] Thursday morning: Set Round 1 live from the desk on the first tee.
- [ ] Charge cables in both carts. Scorers' phones are the ones that matter.

## Only a real course can prove these (dress rehearsal Sep 19 or 26)

These are the three Verify items left from the story library. Each needs an installed iPhone app on grass, not a browser on Wi-Fi.

- [ ] PL-19 Push delivery: with the app installed and notifications allowed, score a match final in one group and confirm the other group's phones get the push, and that a correction within 90 seconds cancels it.
- [ ] SC-09 and SC-11 Offline queue: score three holes with no signal, watch them sync on the way back, then kill the scorer's phone mid-round and have another player take the pencil; confirm nothing is lost or overwritten.
- [ ] XC-07 Service worker update: deploy anything after the rehearsal starts, and confirm an already-open phone picks up the new build on its next open without a blank screen.

## Accepted for 2026, on the 2027 list

Entering a conceded or ruled hole without scores (the commissioner reopens and enters a gross that yields the result); dispute notes and the captains' ruling tool; export of the week's data; the multi-year model (current event, Past Cups archive, seat carry-over, all-time records, year on the rulebook, site year selector); light mode.
