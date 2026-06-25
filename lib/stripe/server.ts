import "server-only";
import Stripe from "stripe";
import { env } from "@/lib/env";

/** Billing is live only when Stripe is configured. UI falls back to free-only. */
export function billingEnabled(): boolean {
  return Boolean(env.STRIPE_SECRET_KEY && (env.STRIPE_PRICE_MONTHLY || env.STRIPE_PRICE_ANNUAL));
}

let cached: Stripe | null = null;

export function getStripe(): Stripe {
  if (!env.STRIPE_SECRET_KEY) throw new Error("Stripe is not configured (STRIPE_SECRET_KEY missing).");
  cached ??= new Stripe(env.STRIPE_SECRET_KEY);
  return cached;
}

export type PriceInterval = "monthly" | "annual";

export function priceIdFor(interval: PriceInterval): string {
  const id = interval === "annual" ? env.STRIPE_PRICE_ANNUAL : env.STRIPE_PRICE_MONTHLY;
  if (!id) throw new Error(`No Stripe price configured for ${interval}.`);
  return id;
}
