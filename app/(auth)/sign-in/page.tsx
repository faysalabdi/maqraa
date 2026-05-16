"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Mail, Loader2, KeyRound } from "lucide-react";

type Step = "email" | "otp";
type Status = "idle" | "loading" | "error";

export default function SignInPage() {
  const [step, setStep] = useState<Step>("email");
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState<string | null>(null);

  async function sendOtp(e: React.FormEvent) {
    e.preventDefault();
    setStatus("loading");
    setError(null);

    const supabase = createClient();
    const { error: err } = await supabase.auth.signInWithOtp({
      email,
      options: { shouldCreateUser: true },
    });

    if (err) {
      setError(err.message);
      setStatus("error");
    } else {
      setStep("otp");
      setStatus("idle");
    }
  }

  async function verifyOtp(e: React.FormEvent) {
    e.preventDefault();
    setStatus("loading");
    setError(null);

    try {
      const supabase = createClient();
      const { error: err } = await supabase.auth.verifyOtp({
        email,
        token: otp.trim(),
        type: "email",
      });

      if (err) {
        setError(err.message);
        setStatus("error");
      } else {
        // Full navigation so middleware reads the new session cookie cleanly.
        window.location.href = "/path";
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Verification failed");
      setStatus("error");
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
            {step === "email" ? "No password. We'll email you a code." : `Code sent to ${email}`}
          </p>
        </div>

        {step === "email" ? (
          <form onSubmit={sendOtp} className="space-y-4">
            <label className="block">
              <span className="mb-1 block text-sm font-medium">Email</span>
              <input
                type="email"
                required
                autoFocus
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                className="w-full rounded-xl border border-border bg-white px-4 py-3 outline-none focus:ring-2 focus:ring-brand"
              />
            </label>
            <button
              type="submit"
              disabled={status === "loading"}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-brand py-3 font-semibold text-brand-fg transition hover:bg-brand-dark disabled:opacity-60"
            >
              {status === "loading" ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Mail className="h-4 w-4" />
              )}
              Send code
            </button>
            {error && <p className="text-center text-sm text-danger">{error}</p>}
          </form>
        ) : (
          <form onSubmit={verifyOtp} className="space-y-4">
            <label className="block">
              <span className="mb-1 block text-sm font-medium">8-digit code</span>
              <input
                type="text"
                inputMode="numeric"
                pattern="\d{8}"
                maxLength={8}
                required
                autoFocus
                value={otp}
                onChange={(e) => setOtp(e.target.value.replace(/\D/g, ""))}
                placeholder="00000000"
                className="w-full rounded-xl border border-border bg-white px-4 py-3 text-center text-2xl font-bold tracking-[0.5em] outline-none focus:ring-2 focus:ring-brand"
              />
            </label>
            <button
              type="submit"
              disabled={status === "loading" || otp.length < 8}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-brand py-3 font-semibold text-brand-fg transition hover:bg-brand-dark disabled:opacity-60"
            >
              {status === "loading" ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <KeyRound className="h-4 w-4" />
              )}
              Verify
            </button>
            <button
              type="button"
              onClick={() => { setStep("email"); setOtp(""); setError(null); }}
              className="w-full text-sm text-fg-muted hover:text-fg"
            >
              ← Use different email
            </button>
            {error && <p className="text-center text-sm text-danger">{error}</p>}
          </form>
        )}
      </div>
    </main>
  );
}
