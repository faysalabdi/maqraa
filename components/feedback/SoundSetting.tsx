"use client";

import { Volume2, VolumeX } from "lucide-react";
import { cn } from "@/lib/utils";
import { useCelebration } from "./CelebrationProvider";

export function SoundSetting() {
  const { muted, setMuted, celebrate } = useCelebration();

  return (
    <div className="rounded-3xl bg-surface p-6 shadow-card ring-1 ring-border">
      <h2 className="text-lg font-bold">Sound</h2>
      <p className="mt-1 text-sm text-fg-muted">
        Short cues when you get a word right, finish a session, or extend a streak. Remembered on
        this device only.
      </p>
      <div className="mt-4 grid grid-cols-2 gap-2">
        <button
          type="button"
          // Play the cue on the way in, so the choice is audible rather than abstract.
          onClick={() => {
            setMuted(false);
            celebrate("answer-correct");
          }}
          className={cn(
            "flex flex-col items-center gap-1.5 rounded-2xl border-2 px-3 py-3 text-sm font-semibold transition",
            muted
              ? "border-border text-fg-muted hover:border-fg-muted"
              : "border-brand bg-brand/5 text-fg",
          )}
        >
          <Volume2 className="h-5 w-5" /> On
        </button>
        <button
          type="button"
          onClick={() => setMuted(true)}
          className={cn(
            "flex flex-col items-center gap-1.5 rounded-2xl border-2 px-3 py-3 text-sm font-semibold transition",
            muted
              ? "border-brand bg-brand/5 text-fg"
              : "border-border text-fg-muted hover:border-fg-muted",
          )}
        >
          <VolumeX className="h-5 w-5" /> Off
        </button>
      </div>
    </div>
  );
}
