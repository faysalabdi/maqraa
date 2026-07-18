import "server-only";
import { eq } from "drizzle-orm";
import { db, schema } from "@/lib/db";

/** The subset of a RevenueCat webhook event this sync consumes. */
export type RevenueCatEvent = {
  type: string;
  app_user_id: string;
  product_id?: string;
  period_type?: string; // NORMAL | TRIAL | INTRO
  purchased_at_ms?: number;
  expiration_at_ms?: number | null;
  original_transaction_id?: string;
  cancel_reason?: string;
};

const HANDLED = new Set([
  "INITIAL_PURCHASE",
  "RENEWAL",
  "PRODUCT_CHANGE",
  "CANCELLATION",
  "UNCANCELLATION",
  "BILLING_ISSUE",
  "EXPIRATION",
]);

const ACTIVE = new Set(["active", "trialing"]);

function isLive(row: { status: string | null; currentPeriodEnd: Date | null }): boolean {
  if (!row.status || !ACTIVE.has(row.status)) return false;
  if (row.currentPeriodEnd && row.currentPeriodEnd.getTime() < Date.now()) return false;
  return true;
}

/**
 * Upsert the subscription row from a RevenueCat event. A row owned by the
 * other provider is only overwritten when it is no longer live, so a user
 * can't end up double-subscribed silently and an Apple event can't clobber a
 * paid Stripe sub (or vice versa).
 */
export async function syncRevenueCatEvent(event: RevenueCatEvent): Promise<boolean> {
  if (!HANDLED.has(event.type)) return false;
  const userId = event.app_user_id;
  // RevenueCat anonymous ids ($RCAnonymousID:...) can't be mapped to a user.
  if (!userId || userId.startsWith("$RCAnonymousID")) return false;

  const [existing] = await db
    .select({
      provider: schema.subscriptions.provider,
      status: schema.subscriptions.status,
      currentPeriodEnd: schema.subscriptions.currentPeriodEnd,
    })
    .from(schema.subscriptions)
    .where(eq(schema.subscriptions.userId, userId))
    .limit(1);

  if (existing && existing.provider !== "apple" && isLive(existing)) {
    console.warn("[revenuecat/sync] ignoring event for user with live", existing.provider, "sub:", userId);
    return false;
  }

  let status: (typeof schema.subscriptionStatus.enumValues)[number];
  let cancelAtPeriodEnd = false;
  switch (event.type) {
    case "EXPIRATION":
      status = "canceled";
      break;
    case "BILLING_ISSUE":
      status = "past_due";
      break;
    case "CANCELLATION":
      // Auto-renew turned off (or refund) — access runs until expiration_at_ms.
      status = event.period_type === "TRIAL" ? "trialing" : "active";
      cancelAtPeriodEnd = true;
      break;
    default:
      status = event.period_type === "TRIAL" ? "trialing" : "active";
  }

  const values = {
    provider: "apple" as const,
    status,
    priceId: event.product_id ?? null,
    cancelAtPeriodEnd,
    currentPeriodEnd: event.expiration_at_ms ? new Date(event.expiration_at_ms) : null,
    rcOriginalTransactionId: event.original_transaction_id ?? null,
    stripeCustomerId: null,
    stripeSubscriptionId: null,
    updatedAt: new Date(),
  };

  await db
    .insert(schema.subscriptions)
    .values({ userId, ...values })
    .onConflictDoUpdate({ target: schema.subscriptions.userId, set: values });
  return true;
}
