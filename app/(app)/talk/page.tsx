import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getPlan } from "@/lib/entitlement";
import { TalkSession } from "@/components/talk/TalkSession";

export const dynamic = "force-dynamic";

export const metadata = { title: "Talk — conversation practice" };

export default async function TalkPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/sign-in?redirect=/talk");

  const plan = await getPlan(user.id, user.email);

  return (
    <main className="mx-auto max-w-2xl px-4 pb-24 pt-8 md:pt-12">
      <header className="mb-6 text-center">
        <p className="font-arabic text-3xl text-brand" dir="rtl">
          هيّا نتحدّث
        </p>
        <h1 className="mt-1 text-2xl font-extrabold">Conversation practice</h1>
        <p className="mx-auto mt-2 max-w-md text-sm text-fg-muted">
          Live voice conversation with a Fusha-only tutor. It corrects your grammar on the spot,
          debates you for fun, and adapts its pace whenever you ask.
        </p>
        <p className="mt-2 text-xs font-semibold text-fg-muted">
          {plan === "pro"
            ? "Pro: up to 25 conversations a day, 15 minutes each."
            : "Free: one 5-minute conversation a day."}
        </p>
      </header>
      <TalkSession />
    </main>
  );
}
