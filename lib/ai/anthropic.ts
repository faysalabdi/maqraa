import Anthropic from "@anthropic-ai/sdk";
import { env } from "@/lib/env";

const globalForAnthropic = globalThis as unknown as { anthropic?: Anthropic };

export const anthropic =
  globalForAnthropic.anthropic ??
  // Trim the key: a stray newline/space (easy to paste into a CI secret) makes
  // an invalid HTTP header value, which the SDK surfaces as a bare
  // "Connection error." on every request.
  new Anthropic({ apiKey: env.ANTHROPIC_API_KEY?.trim() });

if (process.env.NODE_ENV !== "production") globalForAnthropic.anthropic = anthropic;

export const TEST_MODEL = env.ANTHROPIC_TEST_MODEL;
export const FALLBACK_MODEL = env.ANTHROPIC_FALLBACK_MODEL;
