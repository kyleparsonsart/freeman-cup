# The Commish Checklist

The whole trip in order, from the invitations to the drive home. Each block is a moment with a time, what you do, and what "done" looks like. Times are Sand Valley time (Central). App paths read Settings, Tab, Section. Where a thing needs a signal, it says so; the lodge and the clubhouse have Wi-Fi, the courses mostly do not.

A rule that covers half of this list: the desk (Settings, Today) tells you what it needs next. When in doubt, open it.

---

## Before the trip

### Sep 16 to 26: addresses

- [ ] Collect the seven addresses.
- [ ] Type each into Settings, Setup, Seats as it arrives. The "No email" chip clears as you go.
- [ ] Check the Supabase plan (Settings, Billing). Free tier pauses after seven idle days; either upgrade for the month or open the app every few days until Oct 1.
- [ ] In Resend: create the audience with the seven contacts and first names, two segments (Celts, Vikes).
- [ ] Send yourself a test broadcast of each invitation. Read both on your phone in Gmail dark. Check the "four of you" line, "4 rounds", and whether Resend added an unsubscribe footer.

Done when: seven seats have emails, the plan question is settled, and both test invites read right on your phone.

### The day the last address arrives: auth users

- [ ] Run `node scripts/create-auth-users.mjs` with the service key from Supabase Settings, API (or Dashboard, Authentication, Users, Add user, Auto Confirm on, seven times). Never raw SQL into `auth.users`.
- [ ] Settings, Setup, Seats: every chip reads Open. A "No account" chip means the email on the seat and the auth user do not match; fix the seat, not the user.
- [ ] Sign in on a phone that has never seen the app, inside the home-screen copy, with your own address. This is the exact path each of the seven takes.

Done when: seven Open chips and one clean fresh-phone sign-in.

### Sat Sep 27: invitations

- [ ] Send the Celts broadcast, then the Vikes broadcast, from Resend.
- [ ] Group chat, same hour: "Invites are out. Open it in Safari, Share, Add to Home Screen, sign in with the code inside the app. Then open it once more on Wi-Fi."
- [ ] Over the next few days, Settings, Setup, Seats: watch Open turn to Claimed. Nudge anyone still Open by Oct 1.

Done when: seven Claimed chips.

### Thu Oct 1: one week out

- [ ] Settings, Today, Emails, One week out: Send me a test. Read it. Send to everyone.
- [ ] Settings, Rounds: tee name and yardage typed for all four courses (from the Sand Valley confirmation).
- [ ] Group chat: ask each of the seven to confirm the app is on his home screen and he has signed in inside it, and that he opened it once on Wi-Fi.

### Fri Oct 2: handicaps frozen

- [ ] Settings, Setup, Seats: confirm each index against GHIN, then leave them alone (Art. 3.1).
- [ ] Do not deploy anything from here to Saturday Oct 10 unless something is broken. Every open phone reloads on a deploy.

### Tue Oct 6: the last clean slate

- [ ] Settings, Setup, Start over, Clear all scores. Confirm. This wipes the rehearsal rounds, cards, sheets, and feed. It must be done before Wednesday 9 pm, never after; a clear after a round's deadline hands that round default pairings.
- [ ] Confirm: all four rounds read Not started, all seats Claimed, all tees posted.
- [ ] Print two blank scorecards per group per day. Eight sheets. Put them in the bag.
- [ ] Write the backup-commissioner SQL from HANDOFF.md on paper, with the Supabase login. Put it in the bag too.
- [ ] Cables for both carts, a battery pack per bag. The scorers' phones are the ones that matter.

Done when: the desk shows four clean rounds and the bag has paper, cables, and the emergency sheet.

---

## Wed Oct 7: the eve

### Any time before 9 pm: your own sheet

- [ ] Scoring tab: set the Celts pairings for Round 1 and seal. Griffin does the same for the Vikes. Yours is blind until Send.
- [ ] Text Griffin at 7 pm if his is not in. The desk shows "Vikes · Not sealed" until it is.

### 9:00 pm: Send Round 1

- [ ] Settings, Today: both sheets sealed. Send pairings. Eight envelopes drop on eight phones. Needs a signal.
- [ ] If Griffin never sealed: after 9 pm the desk offers to default his side. Text him first; use Seal as Griffin only if he has told you what he wants.
- [ ] Settings, Today, scorers: name a scorer for each Round 1 group. Do not leave this for the tee; the first tee is where the signal is worst.
- [ ] Settings, Today, Emails, Pairings · Round 1: Send me a test, read it, Send to everyone.

Done when: the Schedule tab shows Thursday's four names per match and a named scorer per group, and the pairings email is in your inbox.

---

## Thu Oct 8: Round 1, Mammoth Dunes, four-ball, 12:00 and 12:10

### 10:30 am: the range

- [ ] Open the app on lodge Wi-Fi. Cup tab. Everything current.
- [ ] Ask both scorers to open the app on Wi-Fi too, and to see their letter and their strokes on the card.

### 11:30 am: goes live

- [ ] The round goes live on its own 30 minutes before the first tee. Settings, Today shows "Goes live 11:30am" until then and Live after. If a phone with signal has not looked by then, yours does it when you open the desk: Set live now.
- [ ] Frost or a delay: Settings, Today, set the round back to Not started. It holds until you set it live by hand.

### 12:00 pm: first tee

- [ ] Scorers confirm they hold the pencil (the pencil icon is on their row). Anyone in the group can take it if the named scorer's phone is dead: tap a tile, Take it, confirm.
- [ ] Remind both groups: scores go in hole by hole; the app derives the result; a conceded or ruled hole is set by hand with the CEL/VIK/Halved override and still gets its strokes entered for the King's Race.
- [ ] Paper cards in each cart as the fallback. The rule: paper first, phone second, never neither.

### On the course

- [ ] Your own group: score as usual. Blocked or "needs attention" rows: dismiss only after the commissioner (you) has read them. They mean the server refused a row, usually a card handed in early.
- [ ] Other group stalls on the Cup tab for more than three holes: assume no signal, not no golf. The phone catches up when it sees a bar.
- [ ] A dispute on a hole: Art. 10.2, halve it, set by hand.

### After the round, at the clubhouse

- [ ] Both scorers: Submit the card. The button waits until every score has landed; if it says "Still syncing", get a bar and try again.
- [ ] Settings, Today: 2 of 2 cards in. Mark complete. This is what puts Round 1 in the book, fixes Player of the Round, and makes the King's Race eligibility real.
- [ ] A wrong score after Submit: Settings, Rounds, Round 1, Reopen the card, fix, Submit again, Mark complete again.

### Thursday evening: sheets for Friday

- [ ] Captains' sheets open for Round 2 (aggregate, The Commons, 12 holes) and Round 3 (four-ball, Sand Valley) as separate cards. Round 2 is due 9 pm tonight. Round 3 is due Friday 11:40 am, 90 minutes before its first tee, and its pairing is forced by what has already played, so only the tee order is a choice.
- [ ] Tell Griffin about the Round 3 deadline tonight; he will be on the Commons when it lands.
- [ ] 9:00 pm: Send Round 2 pairings. Name Round 2 scorers. Send the Pairings · Round 2 email.
- [ ] Settings, Today, Emails, Day recap · Thu: test, read, Send to everyone. The recap poster also drops on every phone.

Done when: Round 1 shows Final on the Schedule, Round 2 has names and scorers, and two emails went out.

---

## Fri Oct 9: Round 2, The Commons, aggregate, 8:00 and 8:10, then Round 3, Sand Valley, four-ball, 1:10 and 1:20

### 7:00 am

- [ ] Open the app on Wi-Fi. Round 2 goes live at 7:30 on its own.
- [ ] Aggregate: both partners' net scores add up; a side missing a score has no total for the hole. Scorers enter all four gross scores every hole, no exceptions.
- [ ] 12 holes: the card ends at 12. Submit after 12.

### 10:30 am: between rounds

- [ ] Submit both cards, Mark complete for Round 2 at the clubhouse. Do this before lunch, not after.
- [ ] Round 3 sheets: both due by 11:40. If yours is not in, seal it now. Text Griffin.
- [ ] 11:40 am: Send Round 3 pairings (or the desk defaults whoever is missing at the deadline; check that it did what you expect). Name Round 3 scorers.
- [ ] Send the Pairings · Round 3 email if there is time; it is fine to skip this one, the letters are on the phones.

### 12:40 pm: Round 3 goes live on its own

- [ ] Same as Thursday: scorers hold the pencil, paper in the carts.

### After Round 3

- [ ] Submit both cards. Mark complete.
- [ ] Watch the Cup tab. If a side reaches 5½ tonight, the celebration card appears above the strip and Saturday's line reads "Saturday is for pride and the King's Race." The finale email stays locked until Saturday is in the book; that is on purpose.

### Friday evening: sheets for Saturday

- [ ] Singles: each captain orders his four. Due 9 pm. Slots 1 and 2 go off first, 3 and 4 second.
- [ ] 9:00 pm: Send Round 4 pairings. Name Round 4 scorers. Send the Pairings · Round 4 email.
- [ ] Emails, Day recap · Fri: test, read, send.

Done when: Rounds 2 and 3 show Final, Round 4 has an order and scorers, and the Friday recap is out.

---

## Sat Oct 10: Round 4, Sedge Valley, singles, 10:10 and 10:30

### 9:00 am

- [ ] Open the app on Wi-Fi. Round 4 goes live at 9:40.
- [ ] Singles: two matches per group, one scorer keeps both. The scorer's card carries both matches, one above the other.

### After the round: the finish

- [ ] Submit both cards. Mark complete. This is the moment the finale fires on every phone with the MVP and the Medalist, and the Cup tab shows the trophy card.
- [ ] If it is 5 to 5: the Scoring tab turns into the Captains Shootout board. Three stations on the practice green, fewest total strokes. Enter each captain's strokes per station as they putt; the board says who has it. The finale fires when the shootout is entered and one captain is ahead. Sudden death if level: add a station.
- [ ] Settings, Today, Emails, The finale: Send me a test, read it, Send to everyone.
- [ ] Take the photo with the Lassie. The finale poster is designed to be screenshotted; the Share button hands out the site link.

Done when: the Cup tab shows the winner, the finale email is in eight inboxes, and thefreemancup.com reads the same.

---

## The drive home, and after

- [ ] Nothing to reset. The site stays on the final state all year; the app's Cup tab keeps the trophy card.
- [ ] Settings, Rounds: check the King's Race one last time against the cards. A correction after Submit is Reopen, fix, Submit, Mark complete, same as during the week; the finale re-derives.
- [ ] Write down what broke, what nearly broke, and what the guys asked for. That list is 2027.

---

## If something goes wrong

**A scorer's phone dies.** Anyone in his group taps a tile on the card, Take it, confirms. Needs a bar for the switch itself; scores after that queue. Paper until then.

**Your phone dies.** The paper sheet in the bag: Supabase login and the SQL that makes Griffin commissioner. He can Send, Reopen, Mark complete, and email from his phone until yours is back.

**A player has to leave.** The sheet will not build a three-man side. HANDOFF.md has the SQL that inserts a round's matches by hand with a 1-v-2. Run it from a laptop at the lodge; the app carries on from there.

**A card was submitted with a wrong score.** Settings, Rounds, that round, Reopen. Fix. Submit. Mark complete.

**The round went live too early, or a delay.** Settings, Today, set it back to Not started. It holds.

**Someone cannot sign in.** The email must match the seat exactly. Settings, Setup, Seats shows "No account" if it does not. Codes expire in an hour; the sixty-second cooldown between codes shows as an error, wait and try again.

**The site shows stale scores.** It refreshes every minute on its own. If it says "reconnecting" for more than a few minutes, Supabase is unreachable and the app's phones are queueing; scores land when it is back.

**Nothing works and it is the first tee.** Paper. Enter it all at the clubhouse. The app does not care when a score arrives, only that it does.
