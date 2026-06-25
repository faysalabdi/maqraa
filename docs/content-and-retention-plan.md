# Plan: content gradient (#1) + retention loop (#2)

## Problem
The on-ramp is ~5 books but not actually *graded*: one short A1 original (رحلة سامر),
then classical B1–B2 text (Nawawi 40, Hadith Qudsi, Kalila wa Dimna). A real beginner
finishes Samir and hits a cliff. BYO upload doesn't help beginners (they can't source
or judge level), and it's gated behind finishing 2 books they may find too hard →
retention cliff.

## Goal
A smooth A1 → A2 → B1 → B2 ladder of *readable* content, enough that a beginner always
has a sensible next book, and the habit (streak + words) compounds before they ever need
to bring their own.

## Approach

### 1. Fill the bottom of the ladder with original graded readers (we author these)
- **Why originals:** zero copyright risk, we control exact level, fully diacritized,
  short. Same pattern as رحلة سامر (`source: "original"`).
- **Target shape per reader:** 3–5 short chapters; A1 = present-tense daily life, very
  short sentences; A2 = simple past-tense narrative; B1-bridge = light folk tale / longer
  paragraphs with fewer harakat over time.
- **This change ships two to start** (`في الصباح` A1, `الصديق الجديد` A2) and is designed
  so more drop in by appending to `db/seed/books.ts` + `db/seed/chapters.ts` and
  re-seeding. Aim: ~3 per band (A1, A2, B1) so each band is a real shelf, not one book.
- **Upper bands** stay public-domain classical (Nawawi/Qudsi/Kalila) — those are correctly
  placed; we are only filling the *bottom*.

### 2. Smooth the difficulty signal
- `books.level` already drives the band chip (A1…C2 via `bandFor`). Keep authoring across
  levels 1–3 so the "Start here" shelf reads as a true progression, ordered by
  `level, orderInLevel` (already how the Read screen sorts).
- Consider an explicit "recommended next" = first unfinished book by (level, order) — the
  Continue hero already approximates this.

### 3. Retention loop (#2)
- **Lower the BYO gate** once there's enough curated content: unlocking uploads after
  finishing 2 books is fine when bands are full; revisit only if analytics show stalls.
- **The streak + words are the daily hook** (already credited on reading + saving). The
  Read-home Continue hero + review-due badge close the loop; keep them prominent.
- **Vocabulary as a pull (future, #3):** offer a per-book "key words" preview (top lemmas
  by frequency) so a reader can pre-learn before reading and review after — turns the SRS
  from a side-effect into a reason to come back. Not in this change; flagged as the next
  retention lever.

## Out of scope (decisions for later)
- Audio / TTS (explicitly dropped).
- Sourcing genuinely-graded *public-domain* readers vs authoring everything ourselves —
  authoring is the safe default; sourcing can supplement.
- A frequency-based "core vocabulary" track (#3) — biggest future lever, separate effort.

## Verify
Re-seed (`pnpm db:seed`), open `/path`: "Start here" shows رحلة سامر then the new A1/A2
readers then the classical set, ascending band chips; each new reader opens, paginates,
and tap-to-translate works.
