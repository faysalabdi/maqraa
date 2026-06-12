"use server";

import { and, eq } from "drizzle-orm";
import { createClient } from "@/lib/supabase/server";
import { db, schema } from "@/lib/db";
import {
  generateOpening,
  generateTurn,
  SCENARIOS,
  type ScenarioSlug,
  type StoredMessage,
} from "@/lib/ai/conversation";
import { grantXp, recordActivity, todayXp } from "@/lib/xp/grant";
import { logEvent } from "@/lib/analytics";

const CONVERSATION_XP_PER_TURN = 3;
const CONVERSATION_XP_DAILY_CAP = 60;

async function requireUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("not authenticated");
  return user;
}

async function userLevel(userId: string): Promise<number> {
  const rows = await db
    .select({ currentLevel: schema.profiles.currentLevel })
    .from(schema.profiles)
    .where(eq(schema.profiles.id, userId))
    .limit(1);
  return rows[0]?.currentLevel ?? 1;
}

export type ConversationState = {
  id: string;
  scenario: string;
  messages: StoredMessage[];
};

export async function startConversation(scenario: ScenarioSlug): Promise<ConversationState> {
  const user = await requireUser();
  if (!SCENARIOS.some((s) => s.slug === scenario)) throw new Error("unknown scenario");

  const level = await userLevel(user.id);
  const opening = await generateOpening({ scenario, level });

  const messages: StoredMessage[] = [
    {
      role: "partner",
      content_ar: opening.reply_ar,
      translation_en: opening.reply_translation_en,
    },
  ];

  const [row] = await db
    .insert(schema.conversationSessions)
    .values({ userId: user.id, scenario, level, messages, turns: 0 })
    .returning({ id: schema.conversationSessions.id });

  await logEvent("conversation_started", { scenario });
  return { id: row.id, scenario, messages };
}

export async function sendConversationMessage(
  sessionId: string,
  text: string,
): Promise<{ messages: StoredMessage[]; xpEarned: number }> {
  const user = await requireUser();
  const clean = text.trim().slice(0, 1000);
  if (!clean) throw new Error("empty message");

  const rows = await db
    .select()
    .from(schema.conversationSessions)
    .where(
      and(
        eq(schema.conversationSessions.id, sessionId),
        eq(schema.conversationSessions.userId, user.id),
      ),
    )
    .limit(1);
  const session = rows[0];
  if (!session) throw new Error("conversation not found");

  const history = session.messages as StoredMessage[];

  const turn = await generateTurn({
    scenario: session.scenario as ScenarioSlug,
    level: session.level,
    history,
    userMessage: clean,
  });

  const messages: StoredMessage[] = [
    ...history,
    {
      role: "user",
      content_ar: clean,
      correction: turn.correction ?? null,
    },
    {
      role: "partner",
      content_ar: turn.reply_ar,
      translation_en: turn.reply_translation_en,
    },
  ];

  await db
    .update(schema.conversationSessions)
    .set({ messages, turns: session.turns + 1, updatedAt: new Date() })
    .where(eq(schema.conversationSessions.id, sessionId));

  let xpEarned = 0;
  const earnedToday = await todayXp(user.id, "conversation_turn");
  if (earnedToday < CONVERSATION_XP_DAILY_CAP) {
    xpEarned = await grantXp({
      userId: user.id,
      delta: CONVERSATION_XP_PER_TURN,
      reason: "conversation_turn",
      ref: { sessionId, turn: session.turns + 1 },
      refHash: `conv:${sessionId}:${session.turns + 1}`,
    });
    await recordActivity(user.id);
  }

  return { messages, xpEarned };
}
