import Link from "next/link";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { PreviewDemo } from "@/components/preview/PreviewDemo";

export const metadata = {
  title: "Maqraa — tap to translate",
};

export default function PreviewPage() {
  return (
    <>
      <div className="sticky top-0 z-20 border-b border-border bg-bg/80 backdrop-blur-md">
        <div className="mx-auto flex max-w-2xl items-center justify-between px-4 py-3">
          <Link
            href="/"
            className="inline-flex items-center gap-1 text-sm font-medium text-fg-muted transition hover:text-fg"
          >
            <ArrowLeft className="h-4 w-4" /> Home
          </Link>
          <Link
            href="/sign-in"
            className="inline-flex items-center gap-2 rounded-xl bg-brand px-4 py-2 text-sm font-semibold text-brand-fg shadow-glow-brand transition hover:bg-brand-dark"
          >
            Start reading <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </div>

      <main className="mx-auto max-w-2xl px-4 pb-32 pt-10">
        <section className="mb-8 text-center">
          <p className="text-xs font-bold uppercase tracking-[0.14em] text-fg-muted">Try it</p>
          <h1 className="font-serif mt-2 text-balance text-4xl font-semibold tracking-tight">
            Tap any word.
          </h1>
          <p className="mx-auto mt-2 max-w-md text-balance text-fg-muted">
            This is a real chapter. Tap a word to see its meaning — that&apos;s the whole loop.
          </p>
        </section>

        <PreviewDemo />
      </main>
    </>
  );
}
