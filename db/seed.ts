import "dotenv/config";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { sql } from "drizzle-orm";
import * as schema from "@/lib/db/schema";
import { LEVELS } from "./seed/levels";
import { BOOKS } from "./seed/books";
import { ACHIEVEMENTS } from "./seed/achievements";

async function main() {
  const url = process.env.DIRECT_URL || process.env.DATABASE_URL;
  if (!url) {
    console.error("DATABASE_URL (or DIRECT_URL) not set");
    process.exit(1);
  }

  const client = postgres(url, { prepare: false, max: 1 });
  const db = drizzle(client, { schema });

  console.log("seeding levels...");
  for (const l of LEVELS) {
    await db
      .insert(schema.levels)
      .values(l)
      .onConflictDoUpdate({
        target: schema.levels.level,
        set: {
          slug: l.slug,
          nameEn: l.nameEn,
          nameAr: l.nameAr,
          description: l.description,
          booksRequiredToClear: l.booksRequiredToClear,
        },
      });
  }

  console.log("seeding books...");
  for (const b of BOOKS) {
    await db
      .insert(schema.books)
      .values({
        slug: b.slug,
        level: b.level,
        orderInLevel: b.orderInLevel,
        titleAr: b.titleAr,
        titleEn: b.titleEn,
        authorAr: b.authorAr,
        authorEn: b.authorEn,
        blurb: b.blurb,
        difficulty: b.difficulty,
        genre: b.genre,
        isSelection: b.isSelection ?? false,
        recommendedPages: b.recommendedPages,
      })
      .onConflictDoUpdate({
        target: schema.books.slug,
        set: {
          level: b.level,
          orderInLevel: b.orderInLevel,
          titleAr: b.titleAr,
          titleEn: b.titleEn,
          authorAr: b.authorAr,
          authorEn: b.authorEn,
          blurb: b.blurb,
          difficulty: b.difficulty,
          genre: b.genre,
          isSelection: b.isSelection ?? false,
          recommendedPages: b.recommendedPages,
        },
      });
  }

  console.log("seeding achievements...");
  for (const a of ACHIEVEMENTS) {
    await db
      .insert(schema.achievements)
      .values({
        slug: a.slug,
        nameEn: a.nameEn,
        nameAr: a.nameAr,
        description: a.description,
        icon: a.icon,
        xpReward: a.xpReward,
        criteria: a.criteria,
      })
      .onConflictDoUpdate({
        target: schema.achievements.slug,
        set: {
          nameEn: a.nameEn,
          nameAr: a.nameAr,
          description: a.description,
          icon: a.icon,
          xpReward: a.xpReward,
          criteria: a.criteria,
        },
      });
  }

  const [{ count: bookCount }] = await db.execute(
    sql`select count(*)::int as count from books`,
  );
  console.log(`done. ${bookCount} books in DB.`);
  await client.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
