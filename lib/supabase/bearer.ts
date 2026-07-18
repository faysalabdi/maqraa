import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { env } from "@/lib/env";

/**
 * Cookie-free Supabase client for API routes called by the mobile app, which
 * authenticates with `Authorization: Bearer <access_token>` instead of the
 * web's session cookies.
 */
export function createBearerClient(accessToken: string) {
  return createSupabaseClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: `Bearer ${accessToken}` } },
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
}
