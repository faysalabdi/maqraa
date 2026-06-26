"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { KeyRound, Loader2, LogIn, UserPlus } from "lucide-react";
import { LogoMark } from "@/components/brand/Logo";

type Mode = "signin" | "signup" | "verify";
type Status = "idle" | "loading" | "error";

export default function SignInPage() {
  const [mode, setMode] = useState<Mode>("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [otp, setOtp] = useState("");
  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  // "Start reading — free" lands here as ?new=1 → open in create-account mode.
  useEffect(() => {
    if (new URLSearchParams(window.location.search).get("new")) setMode("signup");
  }, []);

  async function passwordAuth(e: React.FormEvent) {
    e.preventDefault();
    setStatus("loading");
    setError(null);
    setNotice(null);
    const supabase = createClient();

    if (mode === "signup") {
      const { data, error: err } = await supabase.auth.signUp({
        email,
        password,
        options: { emailRedirectTo: `${window.location.origin}/auth/callback` },
      });
      if (err) {
        setError(err.message);
        setStatus("error");
        return;
      }
      if (data.session) {
        window.location.href = "/path";
      } else {
        setOtp("");
        setNotice(`We sent a 6-digit code to ${email}.`);
        setMode("verify");
        setStatus("idle");
      }
      return;
    }

    const { error: err } = await supabase.auth.signInWithPassword({ email, password });
    if (err) {
      setError(
        err.message === "Invalid login credentials"
          ? "Wrong email or password. New here? Tap 'Create account'."
          : err.message,
      );
      setStatus("error");
    } else {
      window.location.href = "/path";
    }
  }

  async function verifyCode(e: React.FormEvent) {
    e.preventDefault();
    setStatus("loading");
    setError(null);
    const supabase = createClient();
    const { error: err } = await supabase.auth.verifyOtp({
      email,
      token: otp.trim(),
      type: "signup",
    });
    if (err) {
      setError(err.message);
      setStatus("error");
    } else {
      window.location.href = "/path";
    }
  }

  async function resendCode() {
    setError(null);
    setNotice(null);
    const supabase = createClient();
    const { error: err } = await supabase.auth.resend({ type: "signup", email });
    if (err) setError(err.message);
    else setNotice(`New code sent to ${email}.`);
  }

  const isPassword = mode === "signin" || mode === "signup";

  return (
    <main className="grid min-h-screen place-items-center px-6">
      <div className="absolute inset-0 -z-10 overflow-hidden">
        <div className="absolute -top-32 left-1/2 h-96 w-96 -translate-x-1/2 rounded-full bg-brand/15 blur-3xl" />
        <div className="absolute bottom-0 right-0 h-96 w-96 rounded-full bg-accent/15 blur-3xl" />
      </div>
      <div className="w-full max-w-sm rounded-3xl bg-surface p-8 shadow-lift ring-1 ring-border">
        <div className="mb-6 text-center">
          <LogoMark className="mx-auto mb-3 h-14 w-14" />
          <p className="font-arabic text-3xl text-brand" dir="rtl">
            مَقْرَأ
          </p>
          <h1 className="mt-2 text-2xl font-extrabold">
            {mode === "signup" ? "Create your account" : mode === "verify" ? "Enter your code" : "Sign in"}
          </h1>
        </div>

        {notice && (
          <p className="mb-4 rounded-xl bg-emerald-50 p-3 text-center text-sm text-emerald-800">
            {notice}
          </p>
        )}

        {isPassword && (
          <form onSubmit={passwordAuth} className="space-y-3">
            <input
              type="email"
              required
              autoFocus
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              className="w-full rounded-xl border border-border bg-surface px-4 py-3 outline-none focus:ring-2 focus:ring-brand"
            />
            <input
              type="password"
              required
              minLength={6}
              autoComplete={mode === "signup" ? "new-password" : "current-password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Password (6+ characters)"
              className="w-full rounded-xl border border-border bg-surface px-4 py-3 outline-none focus:ring-2 focus:ring-brand"
            />
            <button
              type="submit"
              disabled={status === "loading"}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-brand py-3 font-bold text-brand-fg transition hover:bg-brand-dark disabled:opacity-60"
            >
              {status === "loading" ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : mode === "signup" ? (
                <UserPlus className="h-4 w-4" />
              ) : (
                <LogIn className="h-4 w-4" />
              )}
              {mode === "signup" ? "Create account" : "Sign in"}
            </button>
            {error && <p className="text-center text-sm text-danger">{error}</p>}

            <div className="pt-1 text-center text-sm">
              <button
                type="button"
                onClick={() => {
                  setMode(mode === "signup" ? "signin" : "signup");
                  setError(null);
                  setNotice(null);
                }}
                className="font-semibold text-brand hover:underline"
              >
                {mode === "signup" ? "I already have an account" : "Create an account"}
              </button>
            </div>
          </form>
        )}

        {mode === "verify" && (
          <form onSubmit={verifyCode} className="space-y-3">
            <p className="text-center text-sm text-fg-muted">
              Enter the 6-digit code we emailed to {email} to finish creating your account.
            </p>
            <input
              type="text"
              inputMode="numeric"
              pattern="\d{6}"
              maxLength={6}
              required
              autoFocus
              autoComplete="one-time-code"
              value={otp}
              onChange={(e) => setOtp(e.target.value.replace(/\D/g, ""))}
              placeholder="000000"
              className="w-full rounded-xl border border-border bg-surface px-4 py-3 text-center text-2xl font-bold tracking-[0.4em] outline-none focus:ring-2 focus:ring-brand"
            />
            <button
              type="submit"
              disabled={status === "loading" || otp.length < 6}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-brand py-3 font-bold text-brand-fg transition hover:bg-brand-dark disabled:opacity-60"
            >
              {status === "loading" ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <KeyRound className="h-4 w-4" />
              )}
              Verify & continue
            </button>
            {error && <p className="text-center text-sm text-danger">{error}</p>}
            <div className="flex items-center justify-between pt-1 text-sm">
              <button
                type="button"
                onClick={() => {
                  setMode("signup");
                  setError(null);
                  setNotice(null);
                }}
                className="text-fg-muted hover:text-fg"
              >
                ← Back
              </button>
              <button type="button" onClick={resendCode} className="font-semibold text-brand hover:underline">
                Resend code
              </button>
            </div>
          </form>
        )}
      </div>
    </main>
  );
}
