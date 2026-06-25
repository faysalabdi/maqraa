/**
 * Reconcile our subscriptions table with Stripe — upserts every active/trialing
 * subscription. Use to recover from missed webhook deliveries.
 *
 *   pnpm tsx scripts/stripe-backfill.ts
 *
 * Maps each subscription to a user via subscription.metadata.userId (set at
 * checkout) or the customer's metadata.userId.
 */
import { config } from "dotenv";
config({ path: ".env.local" });
import Stripe from "stripe";
import postgres from "postgres";

async function main() {
  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);
  const sql = postgres(process.env.DIRECT_URL || process.env.DATABASE_URL!, { prepare: false, max: 1 });

  let count = 0;
  for (const status of ["active", "trialing"] as const) {
    const subs = await stripe.subscriptions.list({ status, limit: 100, expand: ["data.customer"] });
    for (const s of subs.data) {
      const cust = s.customer as Stripe.Customer;
      const userId = s.metadata?.userId || cust?.metadata?.userId;
      if (!userId) {
        console.warn(`skip ${s.id}: no userId in metadata`);
        continue;
      }
      const item = s.items.data[0];
      const end = item?.current_period_end ? new Date(item.current_period_end * 1000) : null;
      await sql`
        insert into subscriptions
          (user_id, stripe_customer_id, stripe_subscription_id, status, price_id, cancel_at_period_end, current_period_end, updated_at)
        values
          (${userId}, ${cust.id}, ${s.id}, ${s.status}, ${item?.price.id ?? null}, ${s.cancel_at_period_end}, ${end}, now())
        on conflict (user_id) do update set
          stripe_customer_id = excluded.stripe_customer_id,
          stripe_subscription_id = excluded.stripe_subscription_id,
          status = excluded.status,
          price_id = excluded.price_id,
          cancel_at_period_end = excluded.cancel_at_period_end,
          current_period_end = excluded.current_period_end,
          updated_at = now()
      `;
      console.log(`synced ${s.id} -> user ${userId} (${s.status})`);
      count++;
    }
  }
  console.log(`done. ${count} subscription(s) reconciled.`);
  await sql.end();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
