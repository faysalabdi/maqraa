import Link from "next/link";

export default function NotFound() {
  return (
    <main className="mx-auto flex min-h-[70vh] max-w-md flex-col items-center justify-center px-4 text-center">
      <p className="font-arabic text-5xl text-brand" dir="rtl">
        ضاع الطريق
      </p>
      <h1 className="mt-4 text-2xl font-extrabold">Page not found</h1>
      <p className="mt-2 text-sm text-fg-muted">
        This page doesn&apos;t exist or has moved.
      </p>
      <Link
        href="/path"
        className="mt-6 inline-flex items-center gap-2 rounded-xl bg-brand px-5 py-3 font-semibold text-brand-fg transition hover:bg-brand-dark"
      >
        Back to reading
      </Link>
    </main>
  );
}
