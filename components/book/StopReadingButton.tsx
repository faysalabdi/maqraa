"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { CircleStop, Loader2 } from "lucide-react";
import { setBookNotReading } from "@/server/actions/chapters";

export function StopReadingButton({ bookId, className }: { bookId: string; className?: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <button
      type="button"
      title="Stop reading this book"
      disabled={pending}
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        start(async () => {
          try {
            await setBookNotReading(bookId);
            router.refresh();
          } catch {
            /* no-op */
          }
        });
      }}
      className={className}
    >
      {pending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CircleStop className="h-3.5 w-3.5" />}
      Stop reading
    </button>
  );
}
