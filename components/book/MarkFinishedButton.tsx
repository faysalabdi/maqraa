"use client";

import { useTransition } from "react";
import { CheckCircle, Loader2 } from "lucide-react";
import { markReadingDone } from "@/server/actions/reading";

export default function MarkFinishedButton({
  bookId,
  bookSlug,
}: {
  bookId: string;
  bookSlug: string;
}) {
  const [isPending, startTransition] = useTransition();

  return (
    <button
      onClick={() => startTransition(async () => { await markReadingDone(bookId, bookSlug); })}
      disabled={isPending}
      className="inline-flex items-center gap-2 rounded-xl border border-border px-5 py-3 font-semibold transition hover:bg-bg-muted disabled:opacity-60"
    >
      {isPending ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : (
        <CheckCircle className="h-4 w-4" />
      )}
      Mark as finished
    </button>
  );
}
