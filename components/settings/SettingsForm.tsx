"use client";

import { useState, useTransition } from "react";
import { LogOut, Save, Loader2, Check } from "lucide-react";
import { updateSettings, signOutAction } from "@/server/actions/settings";

type Props = {
  initial: {
    displayName: string | null;
    fontScale: number;
    prefersRtl: boolean;
    dailyXpGoal: number;
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

const GOAL_PRESETS = [20, 50, 100, 200, 400];

export default function SettingsForm({ initial, streak }: Props) {
  const [displayName, setDisplayName] = useState(initial.displayName ?? "");
  const [fontScale, setFontScale] = useState(initial.fontScale);
  const [prefersRtl, setPrefersRtl] = useState(initial.prefersRtl);
  const [dailyXpGoal, setDailyXpGoal] = useState(initial.dailyXpGoal);
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
        prefersRtl,
        dailyXpGoal,
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
          className="w-full rounded-xl border border-border bg-white px-4 py-3 outline-none transition focus:border-brand focus:ring-2 focus:ring-brand/30"
        />
      </Section>

      {/* Reading */}
      <Section title="Reading" description="Text size and layout.">
        <Label>Font scale</Label>
        <div className="flex flex-wrap gap-2">
          {FONT_SCALES.map((s) => (
            <button
              key={s.v}
              type="button"
              onClick={() => setFontScale(s.v)}
              className={
                fontScale === s.v
                  ? "rounded-xl bg-brand px-4 py-2 text-sm font-bold text-brand-fg shadow-glow-brand"
                  : "rounded-xl bg-bg-muted px-4 py-2 text-sm font-bold text-fg-muted ring-1 ring-border hover:bg-white"
              }
              style={{ fontSize: `${s.v}rem` }}
            >
              {s.label}
            </button>
          ))}
        </div>

        <div className="mt-4">
          <Label>Direction</Label>
          <button
            type="button"
            onClick={() => setPrefersRtl(!prefersRtl)}
            className={`flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-bold transition ${
              prefersRtl
                ? "bg-brand text-brand-fg shadow-glow-brand"
                : "bg-bg-muted text-fg-muted ring-1 ring-border"
            }`}
          >
            <span
              className={`inline-block h-4 w-7 rounded-full transition ${
                prefersRtl ? "bg-white/30" : "bg-zinc-300"
              }`}
            >
              <span
                className={`block h-4 w-4 rounded-full bg-white transition ${
                  prefersRtl ? "translate-x-3" : ""
                }`}
              />
            </span>
            Prefer RTL for Arabic
          </button>
        </div>
      </Section>

      {/* Goals */}
      <Section title="Goals" description="Your daily XP target.">
        <Label>Daily XP goal</Label>
        <div className="flex flex-wrap gap-2">
          {GOAL_PRESETS.map((g) => (
            <button
              key={g}
              type="button"
              onClick={() => setDailyXpGoal(g)}
              className={
                dailyXpGoal === g
                  ? "rounded-xl bg-brand px-4 py-2 text-sm font-bold text-brand-fg shadow-glow-brand"
                  : "rounded-xl bg-bg-muted px-4 py-2 text-sm font-bold text-fg-muted ring-1 ring-border hover:bg-white"
              }
            >
              {g} XP
            </button>
          ))}
        </div>
        <div className="mt-3 flex items-center gap-3">
          <input
            type="range"
            min={10}
            max={500}
            step={10}
            value={dailyXpGoal}
            onChange={(e) => setDailyXpGoal(Number(e.target.value))}
            className="flex-1 accent-[color:var(--color-brand)]"
          />
          <span className="w-16 text-right text-sm font-bold">{dailyXpGoal}</span>
        </div>
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
    <section className="rounded-2xl bg-white p-5 shadow-soft ring-1 ring-border">
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
