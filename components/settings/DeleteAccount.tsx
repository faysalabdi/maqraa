"use client";

import { useState } from "react";
import { Loader2, Trash2 } from "lucide-react";
import { deleteAccount } from "@/server/actions/account";

export function DeleteAccount() {
  const [open, setOpen] = useState(false);
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function run() {
    setBusy(true);
    setError(null);
    try {
      await deleteAccount();
      window.location.href = "/";
    } catch (e) {
      setBusy(false);
      setError(e instanceof Error ? e.message : "Could not delete the account.");
    }
  }

  return (
    <section className="rounded-2xl border border-red-200 bg-red-50/50 p-5 dark:border-red-500/30 dark:bg-red-500/5">
      <h2 className="text-base font-bold text-red-700 dark:text-red-300">Delete account</h2>
      <p className="mt-1 text-sm text-fg-muted">
        Permanently delete your account, your saved words and progress, and any books you uploaded.
        This cannot be undone. An active subscription is cancelled.
      </p>

      {!open ? (
        <button
          onClick={() => setOpen(true)}
          className="mt-4 inline-flex items-center gap-2 rounded-xl border border-red-300 bg-surface px-4 py-2 text-sm font-semibold text-red-700 transition hover:bg-red-50 dark:border-red-500/40 dark:text-red-300 dark:hover:bg-red-500/10"
        >
          <Trash2 className="h-4 w-4" /> Delete my account
        </button>
      ) : (
        <div className="mt-4 space-y-3">
          <label className="block text-sm font-medium">
            Type <span className="font-bold">DELETE</span> to confirm
          </label>
          <input
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            autoFocus
            className="w-full max-w-xs rounded-xl border border-border bg-surface px-3.5 py-2.5 outline-none focus:ring-2 focus:ring-red-400"
            placeholder="DELETE"
          />
          {error && <p className="text-sm font-medium text-red-600">{error}</p>}
          <div className="flex items-center gap-2">
            <button
              onClick={run}
              disabled={confirm !== "DELETE" || busy}
              className="inline-flex items-center gap-2 rounded-xl bg-red-600 px-4 py-2 text-sm font-bold text-white transition hover:bg-red-700 disabled:opacity-50"
            >
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
              Permanently delete
            </button>
            <button
              onClick={() => {
                setOpen(false);
                setConfirm("");
                setError(null);
              }}
              className="rounded-xl px-3 py-2 text-sm font-semibold text-fg-muted hover:text-fg"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
