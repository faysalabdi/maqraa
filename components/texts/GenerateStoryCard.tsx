"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Wand2 } from "lucide-react";
import { generateStoryText } from "@/server/actions/texts";

export function GenerateStoryCard({ level }: { level: number }) {
  const router = useRouter();
  const [topic, setTopic] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function generate() {
    setBusy(true);
    setError(null);
    const result = await generateStoryText(topic || undefined);
    setBusy(false);
    if ("error" in result) setError(result.error);
    else router.push(`/texts/${result.id}`);
  }

  return (
    <div className="rounded-3xl bg-gradient-to-br from-violet-50 via-white to-emerald-50 p-6 shadow-soft ring-1 ring-violet-200">
      <div className="flex items-start gap-4">
        <span className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-violet-500 text-white shadow-soft">
          <Wand2 className="h-6 w-6" />
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="text-lg font-extrabold">Story Forge</h2>
          <p className="mt-0.5 text-sm text-fg-muted">
            One tap, one fresh story — written exactly at your level ({level}), never the same
            twice. Read it with tap-to-translate, then take the comprehension check. Endless
            reading material.
          </p>
        </div>
      </div>

      <div className="mt-4 flex gap-2">
        <input
          type="text"
          placeholder="Topic (optional) — e.g. السفر، التاريخ، قصة مضحكة"
          value={topic}
          onChange={(e) => setTopic(e.target.value)}
          dir="auto"
          className="min-w-0 flex-1 rounded-xl border border-border bg-white px-4 py-3 outline-none focus:ring-2 focus:ring-violet-400"
        />
        <button
          onClick={generate}
          disabled={busy}
          className="inline-flex shrink-0 items-center gap-2 rounded-xl bg-violet-600 px-5 py-3 font-bold text-white transition hover:bg-violet-700 disabled:opacity-60"
        >
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Wand2 className="h-4 w-4" />}
          {busy ? "Writing…" : "Generate"}
        </button>
      </div>
      {busy && (
        <p className="mt-2 text-center text-xs text-fg-muted">
          Crafting an original story at your level — takes ~15 seconds…
        </p>
      )}
      {error && <p className="mt-2 text-center text-sm text-danger">{error}</p>}
    </div>
  );
}
