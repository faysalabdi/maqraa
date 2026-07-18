import fs from "node:fs";
import path from "node:path";
import { NextResponse } from "next/server";
import { getApiUser } from "@/lib/api/require-user";
import { consumeAiQuota } from "@/lib/ai/quota";
import { getPlan } from "@/lib/entitlement";
import { env } from "@/lib/env";

export const dynamic = "force-dynamic";

const REALTIME_MODEL = "gpt-realtime";

// Session length caps by plan. Client enforces via its timer; the ephemeral
// secret expiry bounds how long a lost tab could reconnect.
const PRO_MAX_SECONDS = 15 * 60;
const FREE_MAX_SECONDS = 5 * 60;

const INSTRUCTIONS = fs.readFileSync(
  path.join(process.cwd(), "prompts", "conversation-system.md"),
  "utf-8",
);

/**
 * Mints a short-lived OpenAI Realtime client secret so the browser can open a
 * WebRTC session directly with OpenAI. The real API key never leaves the
 * server; the secret only authorizes the single pre-configured tutor session.
 */
export async function POST(req: Request) {
  // Web sends the session cookie; the mobile app sends a Bearer token.
  const user = await getApiUser(req);
  if (!user) {
    return NextResponse.json({ error: "You need to be signed in." }, { status: 401 });
  }

  if (!env.OPENAI_API_KEY) {
    return NextResponse.json(
      { error: "Voice practice isn't configured on this server yet." },
      { status: 503 },
    );
  }

  const plan = await getPlan(user.id, user.email);

  try {
    await consumeAiQuota(user.id, "conversation", user.email);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Daily limit reached." },
      { status: 429 },
    );
  }

  const res = await fetch("https://api.openai.com/v1/realtime/client_secrets", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${env.OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      expires_after: { anchor: "created_at", seconds: 600 },
      session: {
        type: "realtime",
        model: REALTIME_MODEL,
        instructions: INSTRUCTIONS,
        audio: {
          input: {
            transcription: { model: "whisper-1", language: "ar" },
            noise_reduction: { type: "far_field" },
            turn_detection: {
              type: "server_vad",
              threshold: 0.5,
              prefix_padding_ms: 300,
              silence_duration_ms: 500,
            },
          },
          output: { voice: "marin" },
        },
        output_modalities: ["audio"],
      },
    }),
  });

  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    console.error("[realtime] client_secrets failed:", res.status, detail.slice(0, 500));
    return NextResponse.json(
      { error: "Couldn't start a conversation session. Please try again." },
      { status: 502 },
    );
  }

  const json = (await res.json()) as { value?: string };
  if (!json.value) {
    return NextResponse.json(
      { error: "Couldn't start a conversation session. Please try again." },
      { status: 502 },
    );
  }

  return NextResponse.json({
    clientSecret: json.value,
    model: REALTIME_MODEL,
    plan,
    maxSeconds: plan === "pro" ? PRO_MAX_SECONDS : FREE_MAX_SECONDS,
  });
}
