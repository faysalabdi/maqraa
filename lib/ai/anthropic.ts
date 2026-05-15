import Anthropic from "@anthropic-ai/sdk";
import { env } from "@/lib/env";

const globalForAnthropic = globalThis as unknown as { anthropic?: Anthropic };

export const anthropic =
  globalForAnthropic.anthropic ?? new Anthropic({ apiKey: env.ANTHROPIC_API_KEY });

if (process.env.NODE_ENV !== "production") globalForAnthropic.anthropic = anthropic;

export const TEST_MODEL = env.ANTHROPIC_TEST_MODEL;
export const FALLBACK_MODEL = env.ANTHROPIC_FALLBACK_MODEL;
