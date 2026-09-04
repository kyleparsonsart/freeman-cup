# The Freeman Cup: Sprint 3 Carryover

Written Sep 4, 2026, at the close of the Sprint 2 polish session. This document briefs a fresh working session on everything it needs. Read HANDOFF.md and SUPABASE-SETUP.md in the repo alongside it.

## Project snapshot

The Freeman Cup 2026 is an 8-man Ryder Cup style golf trip, Oct 8 to 10 at Sand Valley, Nekoosa WI. Two teams (Vikes red #C8402F, Celts blue #4C86C4), 13.5 points on the table, first to 7.5 takes the trophy ("The Lassie", a silver claret jug). A tied cup goes to a Captains Shootout. Kyle Parsons is commissioner and captain of the Celts.

The app is a React 19 + Vite + TypeScript PWA on Supabase (RLS, realtime, RPCs, email OTP auth), deployed on Vercel at freeman-cup.vercel.app. Repo: kyleparsonsart/freeman-cup, local at ~/freeman-cup. Design language: ink green #0F1E19, bone #F0EBDC, brass #D8A93F, moss #8CA79B; Young Serif display, Work Sans body, Barlow Condensed numerals; team red/blue used as data only.

Key dates: feature freeze Sun Sep 13. Invites Sep 27. One-week-out email Oct 1. Trip Oct 8 to 10.

## Where things stand

The app is feature-complete for the freeze. TypeScript builds clean under `npx tsc -b` (what Vercel runs), 73 unit tests pass (the RLS integration suite needs Supabase egress and is skipped locally). Rounds: R1 fourball style pairs, R2 The Commons is Aggregate Match Play (both partners' nets sum, hcp.aggregate=100 off the low man), R3 singles. Signed-card flow, offline write queue with blocked-row handling, commissioner acting-as toggle, moments/recap system, and the commissioner desk are all live.

Resolved this session: the iOS standalone viewport bug (nav floating high). Root cause was `apple-mobile-web-app-status-bar-style: black-translucent`; iOS granted an 812pt window on an 874pt screen. Fix: opaque `default` status bar mode, which iOS sizes correctly and paints with the theme-color ink green. Requires delete + re-add of the home screen icon after changing (style is read at install). The Settings viewport diagnostic was removed; a small build stamp remains under Settings > You as a deploy check.

## Work completed this session (all pushed)

App: recap moments system with permanent homes; scorekeeper, player, and commissioner UX audits (user stories > prototype > per-item feedback > build); Aggregate Match Play for R2 including SQL; tab scroll-to-top with smooth same-tab scroll; staggered entrance animations; pull-to-refresh with jug pulse; offline/pending sync banner; Phosphor duotone empty states; brand asset integration (claret jug body-centered, logo-glyph app icons); commissioner Settings grouped under tabs; sign-in screen redesign; six-digit squircle code entry (8px radii, paste and iOS autofill splat across boxes, backspace walks back); status bar fix above.

Auth/email infrastructure: Resend custom SMTP live (domain thefreemancup.com verified, sender no-reply@thefreemancup.com, port 465, Email OTP length 6, expiry default 1 hour).

Email design system (the big push, all committed under emails/ and public/email/):
- Six emails defined and approved as prototypes: sign-in code (live in Supabase), invitation (two team variants, ready), night-before pairings, day recap (player of the day, auto-suggested by points won, commissioner can override), cup finale, one-week-out.
- Timing rule: recap and finale are never auto-sent. They become desk buttons that unlock only when every card is signed (and the cup decided, for the finale).
- Purpose lines: "Let's Sign In", "Teams Are Set", "Another Year in the Books".

Gmail dark mode findings (four live device tests; do not relitigate):
- Gmail dark inverts dark emails to pale AND leaves light emails light. No email body ever renders dark in Gmail dark mode.
- The gradient lock (background-image:linear-gradient) holds backgrounds but Gmail still inverts text, producing mud. Safe ONLY on text-free regions.
- The 2021 blend-mode counter-inversion hack is defeated by 2026 Gmail.
- Gmail strips web fonts; stacks fall back (Young Serif > Georgia, Barlow Condensed > Helvetica on iOS). Apple Mail loads real fonts and renders colored emails as designed in both phone themes.
- Settled house style: full-width ink-green masthead with brass badge PNG, gradient-locked (safe: no text inside), over an ink-green body that inverts gracefully; mid-green jug #75897F reads on both grounds; radius styling on divs, never tds (border-collapse breaks radius clipping on cells); brand marks always as hosted PNGs (Gmail never recolors images); image URLs get ?v= bumps when replaced (Google's proxy caches per URL, including failures).
- Assets under public/email/: email-badge.png (brass, use ?v=3), email-jug-mid.png, plus beige variants from an abandoned direction.

Public scoreboard (thefreemancup.com): strategy discussed (2026 is the proving year; social is capture-only this year; sponsors deferred). Prototype iterating at high fidelity, NOT yet built. Current prototype includes: app cup strip transplanted (jug at 48px per Kyle), activity feed in the app's .ev row style, hole-by-hole scorecard per match (gross shown, brass marks stroke holes, winner row), Player sign-in button in header linking to the app, spectator explainer, rosters, MVP race, pre-trip countdown and post-trip record states. Architecture agreed in principle: same repo second Vite page, host-conditioned rewrite in vercel.json (thefreemancup.com > scoreboard, freeman-cup.vercel.app keeps the app; the app URL must never change or installed home screens break), one security-definer RPC `public_scoreboard()` returning first names + matches + hole scores, page reuses the app's derive()/standings client-side, refetch ~60s. Open questions for Kyle: feed filtered or full, hole grid gross vs net, section order.

## Sprint 3 backlog (proposed)

1. Public scoreboard build, after prototype sign-off: SQL for the RPC (given in chat to run, like all prior SQL), public page in repo sharing scoring libs, vercel.json host rewrite, Kyle adds the domain in Vercel + an A record at the registrar (Resend DNS records are separate and unaffected).
2. Email send paths: one Supabase Edge Function calling Resend's API, powering the desk "Send the recap"/finale buttons and the pairings-locked email. Invitation and week-out are Resend dashboard broadcasts, no code.
3. Invitation send prep (Sep 27): fill teammate lines in emails/invite-vikes.html and invite-celts.html (marked with EDIT comments; Celts already lists Kyle), load seven contacts with first names into a Resend audience for the {{{FIRST_NAME}}} merge tag. Fact row says "3 rounds"; confirm against shootout framing before sending.
4. Kyle's non-code checklist: seven real player emails with pre-created auth users (Seats/Unbind handles stale bindings), two-phone dress rehearsal (~Sep 19/26: airplane-mode blocked-scores drill plus aggregate holes on R2).
5. 2027 list lives in HANDOFF.md; post-freeze ideas go there, not into the app.

## Working conventions (important for the assistant in the new session)

- The device VM mounts the repo at $HOME/mnt/freeman-cup. It cannot delete files: before EVERY git operation, move stale locks aside with `for f in .git/*.lock; do mv "$f" ".git/stale-..."; done` (index.lock sometimes needs the same treatment mid-flow). "unable to unlink" warnings during commits are normal noise.
- The VM has no GitHub or Supabase egress. Kyle pushes from his own machine; deploys are verified via WebFetch of the production site. SQL is always handed to Kyle verbatim in chat to run in the Supabase dashboard.
- Verify with `npx tsc -b` (Vercel runs it with noUnusedLocals; vite build alone is not enough) plus `npx vitest run` before committing. Never rewrite calc()/derive() in src/lib/scoring.ts.
- Builds for visual checks go to a brand-new .ds-previewN each time (emptyOutDir cannot delete in the VM; stale assets have fooled verification). Last used: .ds-preview21.
- Binary files must NEVER be transferred to the repo via base64 in shell commands (it corrupted PNGs once, silently: valid header, broken pixel data). Use SendUserFile then device_commit_files, and verify with md5sum both sides.
- Commit author: Kyle Parsons <kyleparsonsart@gmail.com>, message via `git commit -F -` heredoc.
- Workflow with Kyle: audits and features go user stories > HTML prototype > per-item feedback > build. Prototypes must be JS-free (the chat preview strips JavaScript); CSS-only interactivity (checkbox :checked) works.
- Kyle's writing preference: no em-dashes in drafted copy.
- Cloud-side helpers from this session (ephemeral, do not rely on them existing): /root/skproto (prototypes), /root/brand (SVGs, rendered PNGs), /root/mprev (static preview server pattern on :4180).

## Key files

- src/lib/: scoring.ts (engine, aggregate branch), moments.ts, standings.ts, card.ts, desk.ts, view.ts (acting-as), writeQueue.ts
- src/components/: ScoringScreen, SettingsSheet (desk, tabs, build stamp), SignInScreen (squircle code entry), PullSync, SyncBanner, CupStrip (claret jug, body-centered viewBox), Moments, icons.tsx (duotone)
- emails/: signin-code.html (mirrors the live Supabase Magic Link template), invite-vikes.html, invite-celts.html
- public/email/: hosted email PNGs; public/brand/: app brand SVGs; public/icons/: logo-glyph app icons
- HANDOFF.md, SUPABASE-SETUP.md: living records, kept current through this session
- vercel.json: catch-all rewrite to index.html (static files still win; the scoreboard build adds a host-conditioned rewrite here)

## Awaiting Kyle

Scoreboard prototype feedback (feed filtering, gross vs net grid, anything structural), a decision on when to build it (it touches no app code, so freeze-safe either way), and the invitation teammate lines before Sep 27.
