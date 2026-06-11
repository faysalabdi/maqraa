export type XpDay = { date: string; total: number };

export function XpChart({ days }: { days: XpDay[] }) {
  const max = Math.max(1, ...days.map((d) => d.total));

  return (
    <div className="rounded-3xl bg-white p-6 shadow-soft ring-1 ring-border">
      <h2 className="text-base font-extrabold">XP earned · last 14 days</h2>
      <p className="mt-1 text-xs text-fg-muted">
        Each bar is one day. Hover for the number.
      </p>
      <div className="mt-6 flex h-32 items-end gap-1.5">
        {days.map((d) => {
          const pct = (d.total / max) * 100;
          return (
            <div key={d.date} className="group relative flex flex-1 flex-col items-center gap-1">
              <span className="absolute -top-6 hidden whitespace-nowrap rounded-md bg-fg px-1.5 py-0.5 text-[10px] font-bold text-white group-hover:block">
                {d.total} XP
              </span>
              <div
                className="w-full rounded-t-md bg-gradient-to-t from-brand to-brand-dark transition-all hover:shadow-glow-brand"
                style={{ height: `${Math.max(4, pct)}%` }}
              />
              <span className="text-[9px] font-bold uppercase tracking-widest text-fg-muted">
                {labelFor(d.date)}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function labelFor(yyyyMmDd: string) {
  const d = new Date(yyyyMmDd);
  return d.toLocaleDateString(undefined, { weekday: "short" }).slice(0, 2);
}
