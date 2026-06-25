import Link from "next/link";
import { Lock, Sparkles } from "lucide-react";

/** Full-page gate shown when a free user hits a Pro-only surface. */
export function ProBlock({
  title,
  body,
  bullets,
}: {
  title: string;
  body: string;
  bullets?: string[];
}) {
  return (
    <main className="mx-auto max-w-xl px-4 pb-24 pt-16 text-center">
      <div className="rounded-3xl bg-surface p-10 shadow-card ring-1 ring-border">
        <span className="mx-auto grid h-16 w-16 place-items-center rounded-2xl bg-brand/10 text-brand">
          <Lock className="h-7 w-7" />
        </span>
        <h1 className="mt-4 font-serif text-2xl font-semibold tracking-tight">{title}</h1>
        <p className="mt-2 text-fg-muted">{body}</p>
        {bullets && bullets.length > 0 && (
          <ul className="mx-auto mt-5 max-w-xs space-y-2 text-left text-sm">
            {bullets.map((b) => (
              <li key={b} className="flex items-start gap-2">
                <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-brand" />
                <span>{b}</span>
              </li>
            ))}
          </ul>
        )}
        <Link
          href="/upgrade"
          className="mt-6 inline-flex items-center gap-2 rounded-xl bg-brand px-6 py-3 font-bold text-brand-fg shadow-glow-brand transition hover:bg-brand-dark"
        >
          <Sparkles className="h-4 w-4" /> Upgrade to Pro
        </Link>
      </div>
    </main>
  );
}
