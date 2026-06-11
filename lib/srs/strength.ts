export type Strength = "new" | "weak" | "learning" | "strong" | "mastered";

export type StrengthInput = {
  repetitions: number;
  intervalDays: number;
  lapses: number;
  ease: number;
};

export function strengthFor(c: StrengthInput): Strength {
  if (c.repetitions === 0) return c.lapses > 0 ? "weak" : "new";
  if (c.ease <= 1.8 || c.lapses >= 3) return "weak";
  if (c.intervalDays >= 21) return "mastered";
  if (c.intervalDays >= 7) return "strong";
  return "learning";
}

export const STRENGTH_ORDER: Strength[] = ["new", "weak", "learning", "strong", "mastered"];

export const STRENGTH_META: Record<Strength, { labelEn: string; labelAr: string; color: string }> =
  {
    new: { labelEn: "New", labelAr: "جديدة", color: "bg-zinc-100 text-zinc-700 ring-zinc-200" },
    weak: { labelEn: "Weak", labelAr: "ضعيفة", color: "bg-rose-100 text-rose-800 ring-rose-200" },
    learning: {
      labelEn: "Learning",
      labelAr: "قيد التعلم",
      color: "bg-amber-100 text-amber-800 ring-amber-200",
    },
    strong: {
      labelEn: "Strong",
      labelAr: "قوية",
      color: "bg-sky-100 text-sky-800 ring-sky-200",
    },
    mastered: {
      labelEn: "Mastered",
      labelAr: "متقنة",
      color: "bg-emerald-100 text-emerald-800 ring-emerald-200",
    },
  };
