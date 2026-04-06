export interface Goal {
  id: string;
  title: string;
  notes: string;
  startDate: string;
  endDate: string;
  checkIns: string[];
  createdAt: number;
}

const MS_PER_DAY = 86_400_000;

function dateFromIso(value: string): Date {
  return new Date(`${value}T00:00:00`);
}

function toUtcStamp(value: string): number {
  const date = dateFromIso(value);
  return Date.UTC(date.getFullYear(), date.getMonth(), date.getDate());
}

export function getTodayIso(): string {
  const today = new Date();
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, "0");
  const day = String(today.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function addDays(isoDate: string, days: number): string {
  const date = dateFromIso(isoDate);
  date.setDate(date.getDate() + days);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function isValidIsoDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false;
  }

  const [year, month, day] = value.split("-").map((part) => Number.parseInt(part, 10));
  if (
    Number.isNaN(year) ||
    Number.isNaN(month) ||
    Number.isNaN(day) ||
    month < 1 ||
    month > 12 ||
    day < 1 ||
    day > 31
  ) {
    return false;
  }

  const date = new Date(year, month - 1, day);
  return (
    date.getFullYear() === year &&
    date.getMonth() === month - 1 &&
    date.getDate() === day
  );
}

export function compareIsoDates(a: string, b: string): number {
  return toUtcStamp(a) - toUtcStamp(b);
}

export function isDateWithinRange(value: string, startDate: string, endDate: string): boolean {
  return compareIsoDates(value, startDate) >= 0 && compareIsoDates(value, endDate) <= 0;
}

export function enumerateGoalDates(startDate: string, endDate: string): string[] {
  if (!isValidIsoDate(startDate) || !isValidIsoDate(endDate) || compareIsoDates(endDate, startDate) < 0) {
    return [];
  }

  const startStamp = toUtcStamp(startDate);
  const endStamp = toUtcStamp(endDate);
  const totalDays = Math.floor((endStamp - startStamp) / MS_PER_DAY) + 1;

  return Array.from({ length: totalDays }, (_, index) => addDays(startDate, index));
}

export function normalizeGoal(goal: Goal): Goal {
  const checkIns = Array.from(
    new Set(
      goal.checkIns.filter(
        (value) =>
          isValidIsoDate(value) && isDateWithinRange(value, goal.startDate, goal.endDate),
      ),
    ),
  ).sort(compareIsoDates);

  return {
    ...goal,
    title: goal.title.trim(),
    notes: goal.notes.trim(),
    checkIns,
  };
}

export function normalizeGoals(value: unknown): Goal[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .filter((item): item is Goal => {
      return (
        !!item &&
        typeof item === "object" &&
        typeof item.id === "string" &&
        typeof item.title === "string" &&
        typeof item.notes === "string" &&
        typeof item.startDate === "string" &&
        typeof item.endDate === "string" &&
        Array.isArray((item as Goal).checkIns) &&
        typeof (item as Goal).createdAt === "number"
      );
    })
    .filter((goal) => {
      return (
        goal.title.trim().length > 0 &&
        isValidIsoDate(goal.startDate) &&
        isValidIsoDate(goal.endDate) &&
        compareIsoDates(goal.endDate, goal.startDate) >= 0
      );
    })
    .map((goal) =>
      normalizeGoal({
        ...goal,
        checkIns: goal.checkIns.filter((entry): entry is string => typeof entry === "string"),
      }),
    )
    .sort(sortGoals);
}

export function createGoal(input: {
  title: string;
  notes?: string;
  startDate: string;
  endDate: string;
}): Goal {
  return normalizeGoal({
    id: crypto.randomUUID(),
    title: input.title,
    notes: input.notes ?? "",
    startDate: input.startDate,
    endDate: input.endDate,
    checkIns: [],
    createdAt: Date.now(),
  });
}

export function toggleGoalCheckIn(goal: Goal, isoDate: string): Goal {
  const nextCheckIns = goal.checkIns.includes(isoDate)
    ? goal.checkIns.filter((value) => value !== isoDate)
    : [...goal.checkIns, isoDate];

  return normalizeGoal({
    ...goal,
    checkIns: nextCheckIns,
  });
}

export function sortGoals(a: Goal, b: Goal): number {
  const startDelta = compareIsoDates(a.startDate, b.startDate);
  if (startDelta !== 0) {
    return startDelta;
  }
  return a.createdAt - b.createdAt;
}

export function getGoalMetrics(goal: Goal, todayIso = getTodayIso()) {
  const dates = enumerateGoalDates(goal.startDate, goal.endDate);
  const elapsedDates = dates.filter((value) => compareIsoDates(value, todayIso) <= 0);
  const completedElapsedCount = goal.checkIns.filter(
    (value) => compareIsoDates(value, todayIso) <= 0,
  ).length;
  const completedCount = goal.checkIns.length;
  const elapsedCount = elapsedDates.length;
  const missedCount = Math.max(0, elapsedCount - completedElapsedCount);
  const totalDays = dates.length;
  const completionRate =
    elapsedCount > 0 ? Math.round((completedElapsedCount / elapsedCount) * 100) : 0;

  return {
    dates,
    totalDays,
    elapsedCount,
    completedCount,
    missedCount,
    upcomingCount: Math.max(0, totalDays - elapsedCount),
    canCheckToday: isDateWithinRange(todayIso, goal.startDate, goal.endDate),
    todayComplete: goal.checkIns.includes(todayIso),
    hasStarted: compareIsoDates(todayIso, goal.startDate) >= 0,
    hasEnded: compareIsoDates(todayIso, goal.endDate) > 0,
    completionRate,
  };
}
