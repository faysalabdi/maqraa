"use client";

import { useState, useTransition } from "react";
import { LogOut, Save, Loader2, Check, KeyRound } from "lucide-react";
import { updateSettings, signOutAction } from "@/server/actions/settings";
import { createClient } from "@/lib/supabase/client";

type Props = {
  initial: {
    displayName: string | null;
    fontScale: number;
  };
  streak: {
    currentDays: number;
    longestDays: number;
    freezesRemaining: number;
  } | null;
};

const FONT_SCALES = [
  { v: 0.85, label: "Small" },
  { v: 1.0, label: "Normal" },
  { v: 1.15, label: "Large" },
  { v: 1.3, label: "X-Large" },
];

export default function SettingsForm({ initial, streak }: Props) {
  const [displayName, setDisplayName] = useState(initial.displayName ?? "");
  const [fontScale, setFontScale] = useState(initial.fontScale);
  const [saved, setSaved] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function save() {
    setError(null);
    setSaved(false);
    startTransition(async () => {
      const res = await updateSettings({
        displayName: displayName || null,
        fontScale,
      });
      if ("error" in res && res.error) {
        setError(res.error);
      } else {
        setSaved(true);
        setTimeout(() => setSaved(false), 2500);
      }
    });
  }

  function signOut() {
    startTransition(async () => {
      await signOutAction();
      window.location.href = "/";
    });
  }

  // Password set/change — works even for accounts created before passwords
  // existed (OTP-only). updateUser adds a password to the current session.
  const [password, setPassword] = useState("");
  const [pwState, setPwState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [pwError, setPwError] = useState<string | null>(null);

  function savePassword() {
    if (password.length < 6) {
      setPwState("error");
      setPwError("Use at least 6 characters.");
      return;
    }
    setPwState("saving");
    setPwError(null);
    const supabase = createClient();
    supabase.auth.updateUser({ password }).then(({ error }) => {
      if (error) {
        setPwState("error");
        setPwError(error.message);
      } else {
        setPwState("saved");
        setPassword("");
        setTimeout(() => setPwState("idle"), 3000);
      }
    });
  }

  return (
    <div className="space-y-5">
      {/* Profile */}
      <Section title="Profile" description="How you appear in the app.">
        <Label>Display name</Label>
        <input
          type="text"
          value={displayName}
          onChange={(e) => setDisplayName(e.target.value)}
          placeholder="e.g. Faysal"
          maxLength={80}
          className="w-full rounded-xl border border-border bg-surface px-4 py-3 outline-none transition focus:border-brand focus:ring-2 focus:ring-brand/30"
        />
      </Section>

      {/* Reading */}
      <Section title="Interface text size" description="Scales the whole app. (The reader has its own text-size and page-tint controls while you read.)">
        <div className="flex flex-wrap gap-2">
          {FONT_SCALES.map((s) => (
            <button
              key={s.v}
              type="button"
              onClick={() => setFontScale(s.v)}
              className={
                fontScale === s.v
                  ? "rounded-xl bg-brand px-4 py-2 text-sm font-bold text-brand-fg shadow-glow-brand"
                  : "rounded-xl bg-bg-muted px-4 py-2 text-sm font-bold text-fg-muted ring-1 ring-border hover:bg-surface"
              }
              style={{ fontSize: `${s.v}rem` }}
            >
              {s.label}
            </button>
          ))}
        </div>
      </Section>

      {/* Sign-in & security */}
      <Section
        title="Sign-in & security"
        description="Set or change your password. Handy if you only ever signed in with an email code."
      >
        <Label>Password</Label>
        <div className="flex flex-wrap items-center gap-2">
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="New password (6+ characters)"
            autoComplete="new-password"
            minLength={6}
            className="min-w-0 flex-1 rounded-xl border border-border bg-surface px-4 py-3 outline-none transition focus:border-brand focus:ring-2 focus:ring-brand/30"
          />
          <button
            type="button"
            onClick={savePassword}
            disabled={pwState === "saving"}
            className="inline-flex items-center gap-2 rounded-xl bg-brand px-5 py-3 font-bold text-brand-fg shadow-glow-brand transition hover:bg-brand-dark disabled:opacity-60"
          >
            {pwState === "saving" ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : pwState === "saved" ? (
              <Check className="h-4 w-4" />
            ) : (
              <KeyRound className="h-4 w-4" />
            )}
            {pwState === "saved" ? "Saved" : "Set password"}
          </button>
        </div>
        {pwState === "error" && pwError && (
          <p className="mt-2 text-sm text-danger">{pwError}</p>
        )}
        {pwState === "saved" && (
          <p className="mt-2 text-sm text-emerald-700">
            Password set. You can now sign in with your email and this password.
          </p>
        )}
      </Section>

      {/* Streak read-only */}
      {streak && (
        <Section title="Streak" description="Your activity record.">
          <div className="grid grid-cols-3 gap-3 text-center">
            <Stat label="Current" value={`${streak.currentDays}d`} />
            <Stat label="Longest" value={`${streak.longestDays}d`} />
            <Stat label="Freezes" value={streak.freezesRemaining} />
          </div>
        </Section>
      )}

      {/* Actions */}
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={save}
          disabled={isPending}
          className="inline-flex items-center gap-2 rounded-xl bg-brand px-5 py-3 font-extrabold text-brand-fg shadow-glow-brand transition hover:bg-brand-dark disabled:opacity-60"
        >
          {isPending ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : saved ? (
            <Check className="h-4 w-4" />
          ) : (
            <Save className="h-4 w-4" />
          )}
          {saved ? "Saved" : "Save changes"}
        </button>
        <button
          type="button"
          onClick={signOut}
          disabled={isPending}
          className="inline-flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-5 py-3 font-semibold text-red-700 transition hover:bg-red-100 disabled:opacity-60"
        >
          <LogOut className="h-4 w-4" /> Sign out
        </button>
        {error && <p className="text-sm text-danger">{error}</p>}
      </div>
    </div>
  );
}

function Section({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-2xl bg-surface p-5 shadow-soft ring-1 ring-border">
      <div className="mb-3">
        <h2 className="text-lg font-extrabold">{title}</h2>
        <p className="text-sm text-fg-muted">{description}</p>
      </div>
      {children}
    </section>
  );
}

function Label({ children }: { children: React.ReactNode }) {
  return (
    <p className="mb-2 text-xs font-bold uppercase tracking-widest text-fg-muted">
      {children}
    </p>
  );
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-xl bg-bg-muted p-3 ring-1 ring-border">
      <p className="text-xs font-bold uppercase tracking-widest text-fg-muted">{label}</p>
      <p className="mt-1 text-xl font-black">{value}</p>
    </div>
  );
}
