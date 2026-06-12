import { createBrowserClient } from "@supabase/ssr";
import { env } from "@/lib/env";
import { AUTH_COOKIE_OPTIONS } from "./cookie-options";

export function createClient() {
  return createBrowserClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
    cookieOptions: AUTH_COOKIE_OPTIONS,
  });
}
