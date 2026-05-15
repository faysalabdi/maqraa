import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { env } from "@/lib/env";
import * as schema from "./schema";

const globalForDb = globalThis as unknown as { db?: ReturnType<typeof drizzle> };

const client = postgres(env.DATABASE_URL, { prepare: false, max: 5 });

export const db =
  globalForDb.db ?? drizzle(client, { schema, logger: process.env.NODE_ENV === "development" });

if (process.env.NODE_ENV !== "production") globalForDb.db = db;

export type DB = typeof db;
export { schema };
