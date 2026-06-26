/**
 * Idempotently provision the Maqraa Pro product + monthly/annual prices in Stripe
 * (test or live, per STRIPE_SECRET_KEY). Safe to re-run — it reuses anything
 * already tagged with metadata.app = "maqra".
 *
 *   pnpm tsx scripts/stripe-setup.ts
 *
 * Prints the STRIPE_PRICE_* lines to drop into .env.local.
 */
import { config } from "dotenv";
config({ path: ".env.local" });
import Stripe from "stripe";

const APP_TAG = "maqra";
const MONTHLY_AMOUNT = 999; // $9.99
const ANNUAL_AMOUNT = 7900; // $79.00 (~34% off monthly)
const CURRENCY = "usd";

async function main() {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new Error("STRIPE_SECRET_KEY not set");
  const stripe = new Stripe(key);

  // Find or create the product.
  const products = await stripe.products.search({ query: `metadata['app']:'${APP_TAG}'` });
  let product = products.data[0];
  if (!product) {
    product = await stripe.products.create({
      name: "Maqraa Pro",
      description: "Every curated book at every level, bring your own books, unlimited review deck.",
      metadata: { app: APP_TAG },
    });
    console.log(`created product ${product.id}`);
  } else {
    console.log(`reusing product ${product.id}`);
  }

  async function ensurePrice(interval: "month" | "year", amount: number): Promise<string> {
    const prices = await stripe.prices.list({ product: product.id, active: true, limit: 100 });
    const found = prices.data.find(
      (p) => p.recurring?.interval === interval && p.unit_amount === amount && p.currency === CURRENCY,
    );
    if (found) {
      console.log(`reusing ${interval}ly price ${found.id}`);
      return found.id;
    }
    const created = await stripe.prices.create({
      product: product.id,
      currency: CURRENCY,
      unit_amount: amount,
      recurring: { interval },
      metadata: { app: APP_TAG },
    });
    console.log(`created ${interval}ly price ${created.id}`);
    return created.id;
  }

  const monthly = await ensurePrice("month", MONTHLY_AMOUNT);
  const annual = await ensurePrice("year", ANNUAL_AMOUNT);

  console.log("\n--- add to .env.local ---");
  console.log(`STRIPE_PRICE_MONTHLY=${monthly}`);
  console.log(`STRIPE_PRICE_ANNUAL=${annual}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
