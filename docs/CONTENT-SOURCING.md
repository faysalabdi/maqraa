# Content sourcing — what can and can't live inside the app

## The legal line

The in-app reader (`/book/[slug]/read/[n]`) embeds full Arabic text inside the database. We can only do that for content where we're confident we have the right to host. Two categories qualify:

1. **Public domain** — author died ≥100 years ago in most jurisdictions, or text is foundational religious literature with no enforceable copyright.
2. **Original** — written by us, fully owned.

Everything else (Harry Potter, Wimpy Kid, Mahfouz, modern al-Uthaymeen commentaries, contemporary graded readers) shows up on the path as a **recommendation only**. The user reads it elsewhere and logs sessions / takes whole-book tests in the app.

## What's in the app right now

- **Public domain:**
  - الأربعون النووية (al-Nawawi, d. 1277) — 15 of 42 hadith seeded. Add the rest by appending to `db/seed/chapters.ts`.
  - كليلة ودمنة (Ibn al-Muqaffa', d. 759) — opening 2 chapters. The full text is freely available in scanned editions.
- **Original:**
  - رحلة سامر (Arabic XP Originals) — 6 chapters of fully-diacritized beginner Arabic. Add chapters here whenever you want a new beginner story.

## About arabic.ba and similar sites

You asked whether we can pull from arabic.ba ("Arabic for Beginners"). Short answer: **don't, without permission.** Even when a site looks free/educational:

- The HTML pages have their own copyright. Republishing whole chapters in our database is copyright infringement.
- "Free to read on a website" ≠ "free for anyone to redistribute."
- Some sites do license content under Creative Commons — but you must check the footer / Terms page and confirm the specific license (CC-BY is OK with attribution, CC-BY-ND blocks adaptation, CC-BY-NC blocks commercial use). I have not been able to confirm arabic.ba's license.

**If you have permission** (you're the author, or you wrote to them and they said yes in writing), I can ingest the content — just paste the chapters in our `chapters.ts` seed with `source: "licensed"` and we add a credit footer.

## Safe places to grow the public-domain library from

- **Al-Maktaba al-Shamela / shamela.ws**: thousands of classical texts, most pre-1925 author.
- **Internet Archive (archive.org)**: scanned classical Arabic books — look for editions before 1929 (US public domain) and confirm the *translation* (if any) is also in the public domain.
- **Wikisource Arabic (ar.wikisource.org)**: a curated, license-clean collection.
- **al-Mostafa / al-warraq / shia-online libraries**: variable quality but useful for cross-checking texts.

Good next additions (all clearly public domain, all classical Arabic):

| Title | Author | Difficulty | Notes |
|---|---|---|---|
| رياض الصالحين | al-Nawawi | Level 3 | Famous hadith collection, easy to chunk per chapter |
| كتاب التوحيد | Muhammad ibn Abdul-Wahhab | Level 2 | Short chapters with ayat + hadith |
| الأصول الثلاثة | Muhammad ibn Abdul-Wahhab | Level 2 | ~50 page primer |
| الأربعون النووية | rest of the matn | Level 2 | Already partially seeded; add 16-42 |
| كليلة ودمنة | Ibn al-Muqaffa' | Level 3-4 | Continue the chapter list we started |
| البخلاء | al-Jahiz | Level 5-6 | Self-contained anecdotes — great per-chapter chunks |
| رسالة الغفران | al-Ma'arri | Level 6 | Dense but iconic |
| مقامات الحريري | al-Hariri | Level 7 | Each maqama is its own chapter |
| ديوان المتنبي | al-Mutanabbi | Level 7 | One poem per chapter |
| ألف ليلة وليلة | Anonymous | Level 4-7 | The Arabic original is in the public domain everywhere; pick stand-alone stories |

## How to add a new chapter

```ts
// db/seed/chapters.ts
{
  bookSlug: "riyad-as-salihin",
  chapterNumber: 1,
  titleAr: "باب الإخلاص",
  titleEn: "The Chapter on Sincerity",
  source: "public_domain",
  contentAr: `…full Arabic text here, paragraphs separated by blank lines…`,
},
```

Then:
```bash
pnpm db:seed   # idempotent — upserts by (bookId, chapterNumber)
```

If the book doesn't exist yet, add it to `db/seed/books.ts` with `hasFullText: true`. The path UI will automatically show the "Read here" badge and the book detail page will render the chapter list.

## What the comprehension quiz expects from chapter text

The chapter quiz generator (`lib/ai/chapter-quiz.ts`) reads the full text and asks Claude to generate 4 MCQs about THAT text. So:

- Keep paragraph breaks meaningful (Claude uses structure to find question material).
- Aim for chapters of 200-1500 Arabic words. Shorter chapters give weaker quizzes; longer ones cost more Anthropic tokens.
- Add tashkeel where it disambiguates. Don't add it to common words — it's harder to read, not easier.
