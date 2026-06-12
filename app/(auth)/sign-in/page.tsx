"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { KeyRound, Loader2, LogIn, Mail, UserPlus } from "lucide-react";
import { LogoMark } from "@/components/brand/Logo";

type Mode = "signin" | "signup" | "otp" | "otp-verify";
type Status = "idle" | "loading" | "error";

export default function SignInPage() {
  const [mode, setMode] = useState<Mode>("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [otp, setOtp] = useState("");
  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  async function passwordAuth(e: React.FormEvent) {
    e.preventDefault();
    setStatus("loading");
    setError(null);
    setNotice(null);
    const supabase = createClient();

    if (mode === "signup") {
      const { data, error: err } = await supabase.auth.signUp({ email, password });
      if (err) {
        setError(err.message);
        setStatus("error");
        return;
      }
      if (data.session) {
        window.location.href = "/path";
      } else {
        setNotice("Check your inbox to confirm your email, then sign in.");
        setMode("signin");
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
      setMode("otp-verify");
      setStatus("idle");
    }
  }

  async function verifyOtp(e: React.FormEvent) {
    e.preventDefault();
    setStatus("loading");
    setError(null);
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
      window.location.href = "/path";
    }
  }

  const isPassword = mode === "signin" || mode === "signup";

  return (
    <main className="grid min-h-screen place-items-center px-6">
      <div className="absolute inset-0 -z-10 overflow-hidden">
        <div className="absolute -top-32 left-1/2 h-96 w-96 -translate-x-1/2 rounded-full bg-brand/15 blur-3xl" />
        <div className="absolute bottom-0 right-0 h-96 w-96 rounded-full bg-accent/15 blur-3xl" />
      </div>
      <div className="w-full max-w-sm rounded-3xl bg-white p-8 shadow-lift ring-1 ring-border">
        <div className="mb-6 text-center">
          <LogoMark className="mx-auto mb-3 h-14 w-14" />
          <p className="font-arabic text-3xl text-brand" dir="rtl">
            اِقْرَأْ
          </p>
          <h1 className="mt-2 text-2xl font-extrabold">
            {mode === "signup" ? "Create your account" : "Sign in"}
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
              className="w-full rounded-xl border border-border bg-white px-4 py-3 outline-none focus:ring-2 focus:ring-brand"
            />
            <input
              type="password"
              required
              minLength={6}
              autoComplete={mode === "signup" ? "new-password" : "current-password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Password (6+ characters)"
              className="w-full rounded-xl border border-border bg-white px-4 py-3 outline-none focus:ring-2 focus:ring-brand"
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

            <div className="flex items-center justify-between pt-1 text-sm">
              <button
                type="button"
                onClick={() => {
                  setMode(mode === "signup" ? "signin" : "signup");
                  setError(null);
                }}
                className="font-semibold text-brand hover:underline"
              >
                {mode === "signup" ? "I have an account" : "Create account"}
              </button>
              <button
                type="button"
                onClick={() => {
                  setMode("otp");
                  setError(null);
                }}
                className="text-fg-muted hover:text-fg"
              >
                Email me a code instead
              </button>
            </div>
          </form>
        )}

        {mode === "otp" && (
          <form onSubmit={sendOtp} className="space-y-3">
            <input
              type="email"
              required
              autoFocus
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              className="w-full rounded-xl border border-border bg-white px-4 py-3 outline-none focus:ring-2 focus:ring-brand"
            />
            <button
              type="submit"
              disabled={status === "loading"}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-brand py-3 font-bold text-brand-fg transition hover:bg-brand-dark disabled:opacity-60"
            >
              {status === "loading" ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Mail className="h-4 w-4" />
              )}
              Send code
            </button>
            {error && <p className="text-center text-sm text-danger">{error}</p>}
            <button
              type="button"
              onClick={() => setMode("signin")}
              className="w-full text-sm text-fg-muted hover:text-fg"
            >
              ← Use a password instead
            </button>
          </form>
        )}

        {mode === "otp-verify" && (
          <form onSubmit={verifyOtp} className="space-y-3">
            <p className="text-center text-sm text-fg-muted">Code sent to {email}</p>
            <input
              type="text"
              inputMode="numeric"
              pattern="\d{6,8}"
              maxLength={8}
              required
              autoFocus
              value={otp}
              onChange={(e) => setOtp(e.target.value.replace(/\D/g, ""))}
              placeholder="000000"
              className="w-full rounded-xl border border-border bg-white px-4 py-3 text-center text-2xl font-bold tracking-[0.4em] outline-none focus:ring-2 focus:ring-brand"
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
              Verify
            </button>
            {error && <p className="text-center text-sm text-danger">{error}</p>}
            <button
              type="button"
              onClick={() => setMode("signin")}
              className="w-full text-sm text-fg-muted hover:text-fg"
            >
              ← Back
            </button>
          </form>
        )}
      </div>
    </main>
  );
}
