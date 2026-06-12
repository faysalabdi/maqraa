import type { CookieOptions } from "@supabase/ssr";

/**
 * Persistent auth-cookie options, shared by the browser, server, and
 * middleware Supabase clients. Without an explicit maxAge the SSR client
 * writes session-scoped cookies, so users get logged out when they close the
 * tab. A long maxAge keeps them signed in; Supabase still rotates the tokens.
 * The options MUST match across all three clients or cookies won't round-trip.
 */
export const AUTH_COOKIE_OPTIONS: CookieOptions = {
  maxAge: 60 * 60 * 24 * 365, // 1 year
  sameSite: "lax",
  path: "/",
};
