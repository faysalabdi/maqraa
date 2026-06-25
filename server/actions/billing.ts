"use server";

import { eq } from "drizzle-orm";
import { createClient } from "@/lib/supabase/server";
import { db, schema } from "@/lib/db";
import { env } from "@/lib/env";
import { getStripe, priceIdFor, billingEnabled, type PriceInterval } from "@/lib/stripe/server";

async function requireUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("not authenticated");
  return user;
}

/** Find or create this user's Stripe customer, persisting the id. */
async function getOrCreateCustomer(userId: string, email?: string | null): Promise<string> {
  const [row] = await db
    .select({ customerId: schema.subscriptions.stripeCustomerId })
    .from(schema.subscriptions)
    .where(eq(schema.subscriptions.userId, userId))
    .limit(1);
  if (row?.customerId) return row.customerId;

  const stripe = getStripe();
  const customer = await stripe.customers.create({
    email: email ?? undefined,
    metadata: { userId },
  });
  await db
    .insert(schema.subscriptions)
    .values({ userId, stripeCustomerId: customer.id })
    .onConflictDoUpdate({
      target: schema.subscriptions.userId,
      set: { stripeCustomerId: customer.id, updatedAt: new Date() },
    });
  return customer.id;
}

/** Start a Pro checkout. Returns a Stripe Checkout URL to redirect to. */
export async function createCheckoutSession(interval: PriceInterval): Promise<{ url: string }> {
  if (!billingEnabled()) throw new Error("Billing is not configured.");
  const user = await requireUser();
  const customerId = await getOrCreateCustomer(user.id, user.email);
  const base = env.NEXT_PUBLIC_APP_URL;

  const stripe = getStripe();
  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    customer: customerId,
    line_items: [{ price: priceIdFor(interval), quantity: 1 }],
    allow_promotion_codes: true,
    success_url: `${base}/settings?checkout=success`,
    cancel_url: `${base}/upgrade?checkout=cancel`,
    subscription_data: { metadata: { userId: user.id } },
    metadata: { userId: user.id },
  });
  if (!session.url) throw new Error("Could not start checkout.");
  return { url: session.url };
}

/** Open the Stripe billing portal so a subscriber can manage/cancel. */
export async function createPortalSession(): Promise<{ url: string }> {
  if (!billingEnabled()) throw new Error("Billing is not configured.");
  const user = await requireUser();
  const [row] = await db
    .select({ customerId: schema.subscriptions.stripeCustomerId })
    .from(schema.subscriptions)
    .where(eq(schema.subscriptions.userId, user.id))
    .limit(1);
  if (!row?.customerId) throw new Error("No billing account yet.");

  const stripe = getStripe();
  const session = await stripe.billingPortal.sessions.create({
    customer: row.customerId,
    return_url: `${env.NEXT_PUBLIC_APP_URL}/settings`,
  });
  return { url: session.url };
}
