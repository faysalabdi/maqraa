import { describe, expect, it } from "vitest";
import { questsForDate } from "./daily";

describe("questsForDate", () => {
  it("always returns three quests with reading first", () => {
    for (let i = 0; i < 14; i++) {
      const date = new Date(Date.UTC(2026, 5, 1 + i));
      const quests = questsForDate(date);
      expect(quests).toHaveLength(3);
      expect(quests[0].id).toBe("read-sections");
      expect(new Set(quests.map((q) => q.id)).size).toBe(3);
    }
  });

  it("is deterministic for a given date", () => {
    const d = new Date(Date.UTC(2026, 5, 12, 15, 30));
    expect(questsForDate(d)).toEqual(questsForDate(new Date(Date.UTC(2026, 5, 12, 2))));
  });

  it("rotates across consecutive days", () => {
    const a = questsForDate(new Date(Date.UTC(2026, 5, 1))).map((q) => q.id);
    const b = questsForDate(new Date(Date.UTC(2026, 5, 2))).map((q) => q.id);
    expect(a).not.toEqual(b);
  });

  it("cycles every quest into rotation within a week", () => {
    const seen = new Set<string>();
    for (let i = 0; i < 7; i++) {
      for (const q of questsForDate(new Date(Date.UTC(2026, 5, 1 + i)))) seen.add(q.id);
    }
    expect(seen.size).toBe(5);
  });
});
