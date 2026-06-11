import { cn } from "@/lib/utils";

export type StatTile = {
  label: string;
  value: string | number;
  sub?: string;
  icon?: React.ReactNode;
  tone?: "brand" | "amber" | "flame" | "neutral";
};

const TONE: Record<NonNullable<StatTile["tone"]>, string> = {
  brand: "from-emerald-50 to-white ring-emerald-200 text-emerald-900",
  amber: "from-amber-50 to-white ring-amber-200 text-amber-900",
  flame: "from-orange-50 to-white ring-orange-200 text-orange-900",
  neutral: "from-bg-muted to-white ring-border text-fg",
};

export function StatGrid({ tiles }: { tiles: StatTile[] }) {
  return (
    <section className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      {tiles.map((t, i) => (
        <div
          key={i}
          className={cn(
            "rounded-2xl bg-gradient-to-br p-4 shadow-soft ring-1",
            TONE[t.tone ?? "neutral"],
          )}
        >
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest opacity-80">
            {t.icon}
            {t.label}
          </div>
          <p className="mt-1 text-2xl font-black">{t.value}</p>
          {t.sub && <p className="mt-0.5 text-xs font-semibold opacity-70">{t.sub}</p>}
        </div>
      ))}
    </section>
  );
}
