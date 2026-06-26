import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { env } from "@/lib/env";

const PUBLIC_PATHS = [
  "/",
  "/sign-in",
  "/auth/callback",
  "/preview",
  "/privacy",
  "/terms",
  "/sitemap.xml",
  "/robots.txt",
];

// Metadata routes (no file extension, so not caught by the matcher's image filter)
// that must be crawlable / fetchable without auth.
const PUBLIC_PREFIXES = ["/_next", "/api/", "/opengraph-image", "/icon", "/apple-icon"];

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

  // Signed-in users skip the marketing/sign-in pages — landing there after
  // reopening the browser made live sessions look like logouts.
  if (user && (pathname === "/" || pathname === "/sign-in")) {
    const url = request.nextUrl.clone();
    url.pathname = "/path";
    url.search = "";
    const redirect = NextResponse.redirect(url);
    // Carry over any auth cookies refreshed during this request.
    for (const c of response.cookies.getAll()) redirect.cookies.set(c);
    return redirect;
  }

  const isPublic =
    PUBLIC_PATHS.includes(pathname) ||
    // API routes (e.g. the Stripe webhook) authenticate themselves and must
    // never be redirected to sign-in — Stripe won't follow a redirect.
    PUBLIC_PREFIXES.some((p) => pathname.startsWith(p));

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
