"use server";

import { headers } from "next/headers";
import { db, schema } from "@/lib/db";
import { createClient } from "@/lib/supabase/server";

const COOKIE = "axp_sid";

/**
 * Log a usage event. Fire-and-forget on the server. Never throws to the caller.
 */
export async function logEvent(
  event: string,
  props?: Record<string, unknown>,
  path?: string,
): Promise<void> {
  try {
    const h = await headers();
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    const sessionId = h.get("x-axp-sid") ?? h.get("cookie")?.match(`${COOKIE}=([^;]+)`)?.[1];

    await db.insert(schema.usageEvents).values({
      userId: user?.id ?? null,
      sessionId: sessionId ?? null,
      event: event.slice(0, 64),
      path: path?.slice(0, 256) ?? null,
      props: props ?? null,
      userAgent: h.get("user-agent")?.slice(0, 256) ?? null,
    });
  } catch {
    // analytics must never break the app
  }
}
