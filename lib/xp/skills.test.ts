import { describe, expect, it } from "vitest";
import { skillForReason, tierForWeeklyXp, xpToNextTier } from "./skills";

describe("skillForReason", () => {
  it("maps every skill-earning reason", () => {
    expect(skillForReason("page_logged")).toBe("reading");
    expect(skillForReason("book_completed")).toBe("reading");
    expect(skillForReason("test_passed")).toBe("reading");
    expect(skillForReason("srs_review")).toBe("reading");
    expect(skillForReason("vocab_learned")).toBe("reading");
    expect(skillForReason("listening_passed")).toBe("listening");
    expect(skillForReason("conversation_turn")).toBe("speaking");
  });

  it("leaves neutral reasons unmapped", () => {
    expect(skillForReason("streak_day")).toBeNull();
    expect(skillForReason("level_up")).toBeNull();
    expect(skillForReason("achievement")).toBeNull();
  });
});

describe("tierForWeeklyXp", () => {
  it("assigns tiers at thresholds", () => {
    expect(tierForWeeklyXp(0)).toBe("bronze");
    expect(tierForWeeklyXp(149)).toBe("bronze");
    expect(tierForWeeklyXp(150)).toBe("silver");
    expect(tierForWeeklyXp(400)).toBe("gold");
    expect(tierForWeeklyXp(899)).toBe("gold");
    expect(tierForWeeklyXp(900)).toBe("emerald");
    expect(tierForWeeklyXp(2000)).toBe("diamond");
    expect(tierForWeeklyXp(99999)).toBe("diamond");
  });
});

describe("xpToNextTier", () => {
  it("reports the gap to the next tier", () => {
    expect(xpToNextTier(100)).toEqual({ tier: "silver", needed: 50 });
    expect(xpToNextTier(150)).toEqual({ tier: "gold", needed: 250 });
    expect(xpToNextTier(1999)).toEqual({ tier: "diamond", needed: 1 });
  });

  it("returns null at diamond", () => {
    expect(xpToNextTier(2000)).toBeNull();
  });
});
