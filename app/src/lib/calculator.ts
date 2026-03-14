export interface LifeStats {
  daysAlive: number;
  daysRemaining: number;
  totalDays: number;
  progress: number;
  currentAge: number;
  expectedLifespan: number;
  remainingYears: number;
  weeksRemaining: number;
  todayLabel: string;
}

function daysBetween(start: Date, end: Date): number {
  const msPerDay = 86_400_000;
  const utcStart = Date.UTC(start.getFullYear(), start.getMonth(), start.getDate());
  const utcEnd = Date.UTC(end.getFullYear(), end.getMonth(), end.getDate());
  return Math.floor((utcEnd - utcStart) / msPerDay);
}

/**
 * Conditional survival estimate: E[T | T > a] = a + e(a)
 *
 * Surviving to age `a` filters out earlier mortality probability mass,
 * so remaining life expectancy exceeds the naive (birthLE - a).
 * Uses a Gompertz-inspired linear adjustment calibrated against
 * standard life tables (see math.md §3, §7–§8).
 */
function conditionalLifeExpectancy(currentAge: number, birthLE: number): number {
  if (currentAge >= birthLE) return currentAge + 2;
  const naiveRemaining = birthLE - currentAge;
  const survivalBonus = 0.1 * (currentAge / birthLE);
  return currentAge + naiveRemaining * (1 + survivalBonus);
}

export function calculateLifeStats(
  birthdate: Date,
  lifeExpectancy: number,
  ageAdjusted: boolean,
): LifeStats | null {
  const today = new Date();
  if (isNaN(birthdate.getTime()) || lifeExpectancy <= 0) return null;

  const daysAlive = daysBetween(birthdate, today);
  if (daysAlive < 0) return null;

  const currentAge = daysAlive / 365.25;

  const expectedLifespan = ageAdjusted
    ? conditionalLifeExpectancy(currentAge, lifeExpectancy)
    : lifeExpectancy;

  const remainingYears = Math.max(0, expectedLifespan - currentAge);
  const totalDays = Math.round(expectedLifespan * 365.25);
  const daysRemaining = Math.max(0, totalDays - daysAlive);
  const weeksRemaining = Math.round(daysRemaining / 7);
  const progress = Math.max(0, Math.min(100, (daysAlive / totalDays) * 100));

  return {
    daysAlive,
    daysRemaining,
    totalDays,
    progress,
    currentAge,
    expectedLifespan: Math.round(expectedLifespan * 10) / 10,
    remainingYears: Math.round(remainingYears * 10) / 10,
    weeksRemaining,
    todayLabel: today.toLocaleDateString(undefined, {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    }),
  };
}
