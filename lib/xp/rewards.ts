export const XP_REWARDS = {
  pageLogged: 2,
  minuteLogged: 1,
  vocabGraduated: 5,
  srsReview: 1,
  testPassedBase: 50,
  testPassedDifficultyMultiplier: 25,
  perfectScoreBonus: 50,
  streakDay: 10,
  bookCompleted: 100,
  levelUp: 500,
} as const;

export const DAILY_CAPS = {
  pageLogged: 60,
  minuteLogged: 60,
  srsReview: 50,
} as const;

export function testPassedXp(difficulty: number): number {
  return XP_REWARDS.testPassedBase + difficulty * XP_REWARDS.testPassedDifficultyMultiplier;
}

export function streakDayXp(streakDay: number): number {
  const weeks = Math.floor(streakDay / 7);
  return XP_REWARDS.streakDay + Math.min(30, weeks);
}
