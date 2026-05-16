import { CheckCircle2, XCircle } from "lucide-react";

export type AttemptRow = {
  id: string;
  score: number;
  passed: boolean;
  submittedAt: Date;
};

export function AttemptHistory({ attempts }: { attempts: AttemptRow[] }) {
  if (attempts.length === 0) return null;

  return (
    <div className="rounded-2xl bg-white p-5 shadow-soft ring-1 ring-border">
      <h2 className="text-base font-extrabold">Attempt history</h2>
      <ul className="mt-3 divide-y divide-border">
        {attempts.map((a) => (
          <li key={a.id} className="flex items-center gap-3 py-2.5 text-sm">
            <span
              className={
                a.passed
                  ? "grid h-8 w-8 place-items-center rounded-full bg-emerald-100 text-emerald-700"
                  : "grid h-8 w-8 place-items-center rounded-full bg-red-100 text-red-700"
              }
            >
              {a.passed ? (
                <CheckCircle2 className="h-4 w-4" />
              ) : (
                <XCircle className="h-4 w-4" />
              )}
            </span>
            <div className="flex-1">
              <p className="font-semibold">
                {a.passed ? "Passed" : "Failed"} · {Math.round(a.score)}%
              </p>
              <p className="text-xs text-fg-muted">
                {a.submittedAt.toLocaleString(undefined, {
                  dateStyle: "medium",
                  timeStyle: "short",
                })}
              </p>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
