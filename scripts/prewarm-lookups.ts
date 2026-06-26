/**
 * Pre-generate word lookups for every curated book so taps are instant from the
 * first read. Idempotent: skips words already in the global cache and the common
 * words served locally. Safe to re-run after seeding new books.
 *
 *   pnpm tsx scripts/prewarm-lookups.ts
 */
import { config } from "dotenv";
config({ path: ".env.local" });
import postgres from "postgres";
import Anthropic from "@anthropic-ai/sdk";
import { runLookup } from "@/lib/ai/lookup-core";
import { paragraphs, tokenizeParagraph, isArabicWord, vocalizedKey, lookupKey } from "@/lib/arabic";
import { COMMON_WORDS } from "@/lib/arabic/common-words";

const CONCURRENCY = 6;

async function main() {
  const dburl = process.env.DIRECT_URL || process.env.DATABASE_URL;
  const apiKey = process.env.ANTHROPIC_API_KEY;
  const model = process.env.ANTHROPIC_FALLBACK_MODEL;
  if (!dburl || !apiKey || !model) {
    console.error("Missing env: need DATABASE_URL/DIRECT_URL, ANTHROPIC_API_KEY, ANTHROPIC_FALLBACK_MODEL");
    process.exit(1);
  }
  const sql = postgres(dburl, { prepare: false, max: 1 });
  const client = new Anthropic({ apiKey });

  const rows = await sql<{ content: string }[]>`
    select bc.content_ar as content
    from book_chapters bc join books b on b.id = bc.book_id
    where b.owner_id is null and b.has_full_text = true
    order by b.level, bc.chapter_number`;

  // Unique words across all curated chapters, keyed by vocalized form.
  const words = new Map<string, { surface: string; context: string }>();
  for (const r of rows) {
    for (const p of paragraphs(r.content)) {
      for (const w of tokenizeParagraph(p)) {
        if (!isArabicWord(w)) continue;
        const k = lookupKey(w);
        if (!k || COMMON_WORDS[k]) continue;
        const vk = vocalizedKey(w);
        if (!words.has(vk)) words.set(vk, { surface: w, context: p });
      }
    }
  }

  const keys = [...words.keys()];
  const cached = new Set<string>();
  for (let i = 0; i < keys.length; i += 500) {
    const chunk = keys.slice(i, i + 500);
    const ex = await sql<{ key: string }[]>`select key from word_lookups where key = any(${chunk})`;
    for (const e of ex) cached.add(e.key);
  }

  const todo = [...words.entries()].filter(([vk]) => !cached.has(vk)).map(([, v]) => v);
  console.log(`curated words: ${words.size} | already cached: ${cached.size} | to generate: ${todo.length}`);

  let done = 0;
  let failed = 0;
  const queue = [...todo];
  const worker = async () => {
    while (queue.length) {
      const it = queue.shift()!;
      try {
        const r = await runLookup(client, model, it.surface, it.context);
        await sql`
          insert into word_lookups (key, surface, lemma_ar, gloss_en, pos, example_ar)
          values (${vocalizedKey(it.surface)}, ${it.surface}, ${r.lemma_ar}, ${r.gloss_en}, ${r.pos ?? null}, ${r.example_ar ?? null})
          on conflict (key) do nothing`;
        done++;
      } catch {
        failed++;
      }
      if ((done + failed) % 25 === 0) console.log(`  ${done + failed}/${todo.length} (failed ${failed})`);
    }
  };
  await Promise.all(Array.from({ length: CONCURRENCY }, () => worker()));

  console.log(`done. generated ${done}, failed ${failed}.`);
  await sql.end();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
