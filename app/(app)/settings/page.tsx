import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  async function signOut() {
    "use server";
    const sb = await createClient();
    await sb.auth.signOut();
    redirect("/");
  }

  return (
    <main className="mx-auto max-w-xl px-4 pb-24 pt-8">
      <h1 className="mb-8 text-center text-3xl font-extrabold">Settings</h1>

      <div className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-border">
        <h2 className="text-lg font-bold">Account</h2>
        <p className="mt-2 text-sm text-fg-muted">Signed in as {user.email}</p>
        <form action={signOut} className="mt-4">
          <button
            type="submit"
            className="rounded-xl border border-border px-5 py-2.5 font-semibold transition hover:bg-bg-muted"
          >
            Sign out
          </button>
        </form>
      </div>

      <p className="mt-6 text-center text-sm text-fg-muted">
        Daily goals, font size, and more coming soon.
      </p>
    </main>
  );
}
