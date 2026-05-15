/**
 * Within-level rank progression. Level itself advances via books completed.
 * Rank XP needed: round(50 * r^1.5). Rank 1 = 50, Rank 5 = 559, Rank 10 = 1581.
 */

export function xpForRank(rank: number): number {
  if (rank < 1) return 0;
  return Math.round(50 * Math.pow(rank, 1.5));
}

export function rankForXp(xp: number): { rank: number; xpInRank: number; xpToNext: number } {
  let rank = 1;
  let remaining = xp;
  while (remaining >= xpForRank(rank)) {
    remaining -= xpForRank(rank);
    rank += 1;
  }
  return { rank, xpInRank: remaining, xpToNext: xpForRank(rank) };
}
