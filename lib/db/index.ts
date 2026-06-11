import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { env } from "@/lib/env";
import * as schema from "./schema";

const globalForDb = globalThis as unknown as { db?: ReturnType<typeof drizzle> };

// On Vercel's serverless runtime, the direct Supabase host (db.<project>.supabase.co)
// resolves only over IPv6 and is unreachable. Connections MUST go through the
// pooler hostname (.pooler.supabase.com). Fail loudly so this is obvious in logs.
function assertPooledHost(url: string) {
  if (!process.env.VERCEL) return;
  try {
    const u = new URL(url);
    if (u.hostname.startsWith("db.") && u.hostname.endsWith(".supabase.co")) {
      throw new Error(
        `DATABASE_URL on Vercel points to the direct Supabase host (${u.hostname}). ` +
          "Vercel cannot reach the IPv6-only direct host. " +
          "Use the Transaction-mode pooler URL: postgresql://postgres.<project>:PASSWORD@aws-0-<region>.pooler.supabase.com:6543/postgres",
      );
    }
  } catch {
    // ignore URL parse failures here — postgres-js will surface its own error
  }
}

assertPooledHost(env.DATABASE_URL);

const client = postgres(env.DATABASE_URL, {
  prepare: false, // required by Supabase Transaction-mode pooler
  max: 5,
  idle_timeout: 20,
  connect_timeout: 10,
});

export const db =
  globalForDb.db ?? drizzle(client, { schema, logger: process.env.NODE_ENV === "development" });

if (process.env.NODE_ENV !== "production") globalForDb.db = db;

export type DB = typeof db;
export { schema };
