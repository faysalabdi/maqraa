import { createEnv } from "@t3-oss/env-nextjs";
import { z } from "zod";

export const env = createEnv({
  server: {
    SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),
    DATABASE_URL: z.string().url(),
    DIRECT_URL: z.string().url().optional(),
    ANTHROPIC_API_KEY: z.string().min(1),
    ANTHROPIC_TEST_MODEL: z.string().default("claude-sonnet-4-6"),
    ANTHROPIC_FALLBACK_MODEL: z.string().default("claude-haiku-4-5-20251001"),
    ADMIN_EMAILS: z.string().optional(), // comma-separated allowlist for /admin
  },
  client: {
    NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
    NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1),
    NEXT_PUBLIC_APP_URL: z.string().url().default("http://localhost:3000"),
  },
  runtimeEnv: {
    SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
    DATABASE_URL: process.env.DATABASE_URL,
    DIRECT_URL: process.env.DIRECT_URL,
    ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY,
    ANTHROPIC_TEST_MODEL: process.env.ANTHROPIC_TEST_MODEL,
    ANTHROPIC_FALLBACK_MODEL: process.env.ANTHROPIC_FALLBACK_MODEL,
    ADMIN_EMAILS: process.env.ADMIN_EMAILS,
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
  },
  skipValidation: process.env.SKIP_ENV_VALIDATION === "true",
});
