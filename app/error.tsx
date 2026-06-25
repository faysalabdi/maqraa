"use client";

import { useEffect } from "react";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <main className="mx-auto flex min-h-[70vh] max-w-md flex-col items-center justify-center px-4 text-center">
      <h1 className="text-2xl font-extrabold">Something went wrong</h1>
      <p className="mt-2 text-sm text-fg-muted">
        An unexpected error occurred. Try again — if it keeps happening, come back in a bit.
      </p>
      <button
        onClick={reset}
        className="mt-6 inline-flex items-center gap-2 rounded-xl bg-brand px-5 py-3 font-semibold text-brand-fg transition hover:bg-brand-dark"
      >
        Try again
      </button>
    </main>
  );
}
