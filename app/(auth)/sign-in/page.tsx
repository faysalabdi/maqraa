"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Mail, Loader2 } from "lucide-react";

export default function SignInPage() {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setStatus("sending");
    setError(null);

    const supabase = createClient();
    const { error: err } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback`,
      },
    });

    if (err) {
      setError(err.message);
      setStatus("error");
    } else {
      setStatus("sent");
    }
  }

  return (
    <main className="grid min-h-screen place-items-center bg-bg px-6">
      <div className="w-full max-w-sm rounded-3xl border border-border bg-white p-8 shadow-sm">
        <div className="mb-6 text-center">
          <p className="font-arabic text-4xl text-brand" dir="rtl">
            اِقْرَأْ
          </p>
          <h1 className="mt-2 text-2xl font-extrabold">Sign in</h1>
          <p className="mt-1 text-sm text-fg-muted">
            We&apos;ll email you a magic link. No password.
          </p>
        </div>

        {status === "sent" ? (
          <div className="rounded-2xl bg-emerald-50 p-4 text-center text-sm text-emerald-900">
            <Mail className="mx-auto mb-2 h-6 w-6" />
            Check your inbox for a link from arabic-xp.
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <label className="block">
              <span className="mb-1 block text-sm font-medium">Email</span>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                className="w-full rounded-xl border border-border bg-white px-4 py-3 outline-none focus:ring-2 focus:ring-brand"
              />
            </label>
            <button
              type="submit"
              disabled={status === "sending"}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-brand py-3 font-semibold text-brand-fg transition hover:bg-brand-dark disabled:opacity-60"
            >
              {status === "sending" ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Mail className="h-4 w-4" />
              )}
              Send magic link
            </button>
            {error && <p className="text-center text-sm text-danger">{error}</p>}
          </form>
        )}
      </div>
    </main>
  );
}
