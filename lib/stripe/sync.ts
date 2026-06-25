import "server-only";
import type Stripe from "stripe";
import { eq } from "drizzle-orm";
import { db, schema } from "@/lib/db";

/** Resolve the app user for a Stripe subscription (metadata first, then customer). */
async function resolveUserId(sub: Stripe.Subscription, customerId: string): Promise<string | null> {
  const fromMeta = sub.metadata?.userId;
  if (fromMeta) return fromMeta;
  const [row] = await db
    .select({ userId: schema.subscriptions.userId })
    .from(schema.subscriptions)
    .where(eq(schema.subscriptions.stripeCustomerId, customerId))
    .limit(1);
  return row?.userId ?? null;
}

/** Upsert our subscription row from a Stripe subscription object. */
export async function syncSubscription(sub: Stripe.Subscription): Promise<string | null> {
  const customerId = typeof sub.customer === "string" ? sub.customer : sub.customer.id;
  const userId = await resolveUserId(sub, customerId);
  if (!userId) {
    console.error("[stripe/sync] no user for customer", customerId);
    return null;
  }
  const item = sub.items.data[0];
  const periodEnd = item?.current_period_end ?? null;
  const values = {
    stripeCustomerId: customerId,
    stripeSubscriptionId: sub.id,
    status: sub.status,
    priceId: item?.price.id ?? null,
    cancelAtPeriodEnd: sub.cancel_at_period_end,
    currentPeriodEnd: periodEnd ? new Date(periodEnd * 1000) : null,
    updatedAt: new Date(),
  };
  await db
    .insert(schema.subscriptions)
    .values({ userId, ...values })
    .onConflictDoUpdate({ target: schema.subscriptions.userId, set: values });
  return userId;
}
