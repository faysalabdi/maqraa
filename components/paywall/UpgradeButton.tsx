"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";
import { createCheckoutSession, createPortalSession } from "@/server/actions/billing";
import type { PriceInterval } from "@/lib/stripe/server";

export function UpgradeButton({
  interval,
  className,
  children,
}: {
  interval: PriceInterval;
  className?: string;
  children: React.ReactNode;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function go() {
    setBusy(true);
    setError(null);
    try {
      const { url } = await createCheckoutSession(interval);
      window.location.href = url;
    } catch (e) {
      setBusy(false);
      setError(e instanceof Error ? e.message : "Could not start checkout.");
    }
  }

  return (
    <span className="flex flex-col items-stretch gap-2">
      <button onClick={go} disabled={busy} className={className}>
        {busy ? <Loader2 className="mx-auto h-5 w-5 animate-spin" /> : children}
      </button>
      {error && <span className="text-center text-xs font-medium text-red-600">{error}</span>}
    </span>
  );
}

export function ManageBillingButton({ className }: { className?: string }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function go() {
    setBusy(true);
    setError(null);
    try {
      const { url } = await createPortalSession();
      window.location.href = url;
    } catch (e) {
      setBusy(false);
      setError(e instanceof Error ? e.message : "Could not open billing.");
    }
  }

  return (
    <span className="flex flex-col gap-2">
      <button onClick={go} disabled={busy} className={className}>
        {busy ? "Opening…" : "Manage billing"}
      </button>
      {error && <span className="text-xs font-medium text-red-600">{error}</span>}
    </span>
  );
}
