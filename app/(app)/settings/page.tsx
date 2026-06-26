import Link from "next/link";
import { redirect } from "next/navigation";
import { Sparkles } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { db, schema } from "@/lib/db";
import { eq } from "drizzle-orm";
import { getPlan } from "@/lib/entitlement";
import { billingEnabled } from "@/lib/stripe/server";
import { ManageBillingButton } from "@/components/paywall/UpgradeButton";
import SettingsForm from "@/components/settings/SettingsForm";
import { ThemeSetting } from "@/components/chrome/ThemeSetting";
import { DeleteAccount } from "@/components/settings/DeleteAccount";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/sign-in?redirect=/settings");

  const [profileRows, streakRows] = await Promise.all([
    db
      .select()
      .from(schema.profiles)
      .where(eq(schema.profiles.id, user.id))
      .limit(1),
    db
      .select()
      .from(schema.streaks)
      .where(eq(schema.streaks.userId, user.id))
      .limit(1),
  ]);

  const profile = profileRows[0];
  const streak = streakRows[0];
  const plan = await getPlan(user.id, user.email);

  if (!profile) {
    return (
      <main className="mx-auto max-w-md px-4 pt-12 text-center">
        <p>Profile not found. Try signing out and back in.</p>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-2xl px-4 pb-24 pt-6">
      <header className="mb-6">
        <h1 className="font-serif text-3xl font-semibold tracking-tight">Settings</h1>
        <p className="mt-1 text-sm text-fg-muted">
          Signed in as <span className="font-semibold">{user.email}</span>
        </p>
      </header>

      <div className="mb-6 flex items-center justify-between gap-4 rounded-2xl bg-surface p-5 shadow-card ring-1 ring-border">
        <div className="flex items-center gap-3">
          <span className="grid h-10 w-10 place-items-center rounded-xl bg-brand/10 text-brand">
            <Sparkles className="h-5 w-5" />
          </span>
          <div>
            <p className="font-bold">{plan === "pro" ? "Maqra Pro" : "Free plan"}</p>
            <p className="text-sm text-fg-muted">
              {plan === "pro" ? "Every book, your own library, unlimited deck." : "The Beginner shelf, capped deck."}
            </p>
          </div>
        </div>
        {plan === "pro" ? (
          billingEnabled() && (
            <ManageBillingButton className="shrink-0 rounded-xl border border-border bg-surface px-4 py-2 text-sm font-semibold transition hover:shadow-soft" />
          )
        ) : (
          <Link
            href="/upgrade"
            className="shrink-0 rounded-xl bg-brand px-4 py-2 text-sm font-bold text-brand-fg transition hover:bg-brand-dark"
          >
            Upgrade
          </Link>
        )}
      </div>

      <div className="mb-6">
        <ThemeSetting />
      </div>

      <SettingsForm
        initial={{
          displayName: profile.displayName,
          fontScale: Number(profile.fontScale),
        }}
        streak={
          streak
            ? {
                currentDays: streak.currentDays,
                longestDays: streak.longestDays,
                freezesRemaining: streak.freezesRemaining,
              }
            : null
        }
      />

      <div className="mt-8">
        <DeleteAccount />
      </div>
    </main>
  );
}
