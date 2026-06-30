import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { env } from "@/lib/env";
import * as schema from "./schema";

const globalForDb = globalThis as unknown as { db?: ReturnType<typeof drizzle> };

// Serverless-friendly pool: keep it small, recycle idle connections so they
// don't pile up against the database's connection limit, and fail a stuck
// connect attempt instead of hanging a request forever.
const client = postgres(env.DATABASE_URL, {
  prepare: false,
  max: 5,
  idle_timeout: 20,
  connect_timeout: 15,
});

export const db =
  globalForDb.db ?? drizzle(client, { schema, logger: process.env.NODE_ENV === "development" });

if (process.env.NODE_ENV !== "production") globalForDb.db = db;

export type DB = typeof db;
export { schema };
