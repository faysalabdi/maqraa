import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { env } from "@/lib/env";
import { AUTH_COOKIE_OPTIONS } from "./cookie-options";

const PUBLIC_PATHS = ["/", "/sign-in", "/auth/callback", "/preview"];

const SID_COOKIE = "axp_sid";

function ensureSessionId(request: NextRequest, response: NextResponse): string {
  const existing = request.cookies.get(SID_COOKIE)?.value;
  if (existing) return existing;
  const sid = crypto.randomUUID();
  response.cookies.set(SID_COOKIE, sid, {
    httpOnly: false,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
  });
  return sid;
}

export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookieOptions: AUTH_COOKIE_OPTIONS,
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet: { name: string; value: string; options?: CookieOptions }[]) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const pathname = request.nextUrl.pathname;
  const isPublic =
    PUBLIC_PATHS.includes(pathname) ||
    pathname.startsWith("/_next") ||
    pathname.startsWith("/api/public") ||
    // Server-to-server self-call for background PDF extraction. No session
    // cookie travels with it; the route enforces x-internal-secret itself.
    pathname === "/api/texts/extract";

  if (!user && !isPublic) {
    const url = request.nextUrl.clone();
    url.pathname = "/sign-in";
    url.searchParams.set("redirect", pathname);
    return NextResponse.redirect(url);
  }

  const sid = ensureSessionId(request, response);
  response.headers.set("x-axp-sid", sid);

  return response;
}
