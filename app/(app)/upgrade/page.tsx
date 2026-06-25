import { redirect } from "next/navigation";
import { Check, Sparkles } from "lucide-react";
import type Stripe from "stripe";
import { createClient } from "@/lib/supabase/server";
import { getPlan, FREE } from "@/lib/entitlement";
import { billingEnabled, getStripe, priceIdFor, type PriceInterval } from "@/lib/stripe/server";
import { UpgradeButton, ManageBillingButton } from "@/components/paywall/UpgradeButton";

export const dynamic = "force-dynamic";

const PRO_PERKS = [
  "Every curated book — Beginner, Intermediate & Advanced",
  "Bring your own books — upload unlimited EPUBs",
  "Unlimited spaced-repetition deck",
  "Much higher daily translation & test limits",
];

async function priceLabel(interval: PriceInterval): Promise<string | null> {
  try {
    const price = (await getStripe().prices.retrieve(priceIdFor(interval))) as Stripe.Price;
    if (price.unit_amount == null) return null;
    const amount = new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: price.currency.toUpperCase(),
      minimumFractionDigits: price.unit_amount % 100 === 0 ? 0 : 2,
    }).format(price.unit_amount / 100);
    return `${amount}/${interval === "annual" ? "yr" : "mo"}`;
  } catch {
    return null;
  }
}

export default async function UpgradePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/sign-in?redirect=/upgrade");

  const plan = await getPlan(user.id, user.email);
  const enabled = billingEnabled();

  if (plan === "pro") {
    return (
      <main className="mx-auto max-w-lg px-4 pb-24 pt-16 text-center">
        <div className="rounded-3xl bg-surface p-10 shadow-card ring-1 ring-border">
          <span className="mx-auto grid h-16 w-16 place-items-center rounded-2xl bg-brand/10 text-brand">
            <Sparkles className="h-7 w-7" />
          </span>
          <h1 className="mt-4 font-serif text-2xl font-semibold">You&apos;re on Pro</h1>
          <p className="mt-2 text-fg-muted">Every book, every level, your own library. Thank you.</p>
          {enabled && (
            <div className="mt-6 inline-block">
              <ManageBillingButton className="rounded-xl border border-border bg-surface px-5 py-3 font-semibold transition hover:shadow-soft" />
            </div>
          )}
        </div>
      </main>
    );
  }

  const [monthly, annual] = enabled
    ? await Promise.all([priceLabel("monthly"), priceLabel("annual")])
    : [null, null];

  return (
    <main className="mx-auto max-w-3xl px-4 pb-24 pt-10">
      <header className="text-center">
        <span className="inline-flex items-center gap-2 rounded-full bg-brand/10 px-3 py-1 text-xs font-bold uppercase tracking-wider text-brand">
          <Sparkles className="h-3.5 w-3.5" /> Maqra Pro
        </span>
        <h1 className="font-serif mt-3 text-4xl font-semibold tracking-tight">
          Read everything. Bring your own.
        </h1>
        <p className="mx-auto mt-2 max-w-md text-fg-muted">
          The free shelf gets you reading. Pro unlocks the whole library and your own books.
        </p>
      </header>

      <div className="mt-10 grid gap-5 md:grid-cols-2">
        {/* Free */}
        <div className="rounded-3xl bg-surface p-7 shadow-card ring-1 ring-border">
          <p className="text-sm font-bold uppercase tracking-wider text-fg-muted">Free</p>
          <p className="mt-2 text-3xl font-extrabold">$0</p>
          <ul className="mt-5 space-y-2 text-sm">
            <Perk>The Beginner curated shelf</Perk>
            <Perk>Tap-to-translate ({FREE.maxSavedWords}-word deck)</Perk>
            <Perk>Daily streak & progress</Perk>
          </ul>
          <p className="mt-6 text-center text-sm font-semibold text-fg-muted">Your current plan</p>
        </div>

        {/* Pro */}
        <div className="relative rounded-3xl bg-surface p-7 shadow-lift ring-2 ring-brand">
          <span className="absolute -top-3 left-7 rounded-full bg-brand px-3 py-1 text-xs font-bold text-brand-fg">
            Most popular
          </span>
          <p className="text-sm font-bold uppercase tracking-wider text-brand">Pro</p>
          <p className="mt-2 text-3xl font-extrabold">
            {monthly ?? "Pro"}
            {annual && <span className="ml-2 text-sm font-semibold text-fg-muted">or {annual}</span>}
          </p>
          <ul className="mt-5 space-y-2 text-sm">
            {PRO_PERKS.map((p) => (
              <Perk key={p}>{p}</Perk>
            ))}
          </ul>

          {enabled ? (
            <div className="mt-6 space-y-3">
              <UpgradeButton
                interval="monthly"
                className="w-full rounded-xl bg-brand py-3 font-bold text-brand-fg shadow-glow-brand transition hover:bg-brand-dark disabled:opacity-60"
              >
                Go Pro monthly{monthly ? ` · ${monthly}` : ""}
              </UpgradeButton>
              <UpgradeButton
                interval="annual"
                className="w-full rounded-xl border border-border bg-surface py-3 font-bold transition hover:shadow-soft disabled:opacity-60"
              >
                Go annual{annual ? ` · ${annual}` : ""}
              </UpgradeButton>
            </div>
          ) : (
            <p className="mt-6 rounded-xl bg-bg-muted p-4 text-center text-sm text-fg-muted">
              Billing isn&apos;t switched on yet — check back soon.
            </p>
          )}
        </div>
      </div>
    </main>
  );
}

function Perk({ children }: { children: React.ReactNode }) {
  return (
    <li className="flex items-start gap-2">
      <Check className="mt-0.5 h-4 w-4 shrink-0 text-brand" strokeWidth={3} />
      <span>{children}</span>
    </li>
  );
}
