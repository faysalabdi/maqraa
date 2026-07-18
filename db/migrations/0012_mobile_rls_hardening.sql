-- Mobile clients ship the anon key inside the app binary, so anything RLS
-- allows is reachable by any signed-in user with a debugger. Tighten policies
-- that were harmless while only the web app (server-side Drizzle, bypasses RLS)
-- touched these tables.

-- Chapter quiz rows embed the answer key; the client must only ever see the
-- answer-stripped payload served by the API. Server reads use the service
-- connection and are unaffected.
DROP POLICY IF EXISTS "chapter_quizzes_public_read" ON chapter_quizzes;

-- XP is granted exclusively by the server (grantXp, with refHash idempotency
-- and daily caps). A client-side insert path would let users mint XP directly.
DROP POLICY IF EXISTS "xp_events insert own" ON public.xp_events;

-- Comprehension tests are generated server-side only; the row contains the
-- model answers, and client inserts would bypass quota metering. Reads go
-- through the API too (answer-stripped), so select-own also goes away.
DROP POLICY IF EXISTS "tests insert own" ON public.comprehension_tests;
DROP POLICY IF EXISTS "tests select own" ON public.comprehension_tests;
