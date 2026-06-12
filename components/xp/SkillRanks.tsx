import { BookOpen, Headphones, MessagesSquare, Shield } from "lucide-react";
import { cn } from "@/lib/utils";
import { SKILL_META, type Skill } from "@/lib/xp/skills";
import type { SkillRanks as SkillRanksData } from "@/lib/xp/skill-xp";

const ICONS: Record<Skill, React.ComponentType<{ className?: string }>> = {
  reading: BookOpen,
  listening: Headphones,
  speaking: MessagesSquare,
};

const TONE: Record<string, { chip: string; bar: string; icon: string }> = {
  emerald: { chip: "bg-emerald-100 ring-emerald-200", bar: "bg-emerald-500", icon: "text-emerald-600" },
  sky: { chip: "bg-sky-100 ring-sky-200", bar: "bg-sky-500", icon: "text-sky-600" },
  violet: { chip: "bg-violet-100 ring-violet-200", bar: "bg-violet-500", icon: "text-violet-600" },
};

export function SkillRanks({ data, compact = false }: { data: SkillRanksData; compact?: boolean }) {
  return (
    <section className="rounded-3xl bg-white p-5 shadow-soft ring-1 ring-border">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-bold uppercase tracking-widest text-fg-muted">
          Skill ranks
        </h2>
        <span
          className="inline-flex items-center gap-1.5 rounded-full bg-bg-muted px-3 py-1 text-xs font-bold ring-1 ring-border"
          title="Your overall rank is your lowest skill — level the weakest to raise it"
        >
          <Shield className="h-3.5 w-3.5 text-fg-muted" />
          Overall {data.overallRank}
        </span>
      </div>

      <div className={cn("grid gap-3", compact ? "grid-cols-3" : "grid-cols-1 sm:grid-cols-3")}>
        {data.skills.map((s) => {
          const meta = SKILL_META[s.skill];
          const tone = TONE[meta.tone];
          const Icon = ICONS[s.skill];
          const pct = Math.min(100, Math.round((s.xpInRank / Math.max(1, s.xpToNext)) * 100));
          return (
            <div
              key={s.skill}
              className={cn("rounded-2xl p-3 ring-1", tone.chip)}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-fg-muted">
                  <Icon className={cn("h-4 w-4", tone.icon)} />
                  {compact ? null : meta.label}
                </span>
                <span className="font-arabic text-xs text-fg-muted" dir="rtl">
                  {meta.labelAr}
                </span>
              </div>
              <p className="mt-1 text-2xl font-black">
                {s.rank}
                <span className="ml-1 text-xs font-bold text-fg-muted">rank</span>
              </p>
              <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/70">
                <div
                  className={cn("h-full rounded-full transition-all", tone.bar)}
                  style={{ width: `${pct}%` }}
                />
              </div>
              <p className="mt-1 text-[10px] font-semibold text-fg-muted">
                {s.xpInRank} / {s.xpToNext} XP to rank {s.rank + 1}
              </p>
            </div>
          );
        })}
      </div>
    </section>
  );
}
