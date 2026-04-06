export interface Goal {
  id: string;
  user_id: string;
  title: string;
  description: string | null;
  start_date: string;
  end_date: string;
  created_at: string;
  updated_at: string;
}

export interface GoalCheckin {
  id: string;
  goal_id: string;
  user_id: string;
  check_date: string;
  note: string | null;
  created_at: string;
}

export function goalDaysBetween(start: string, end: string): number {
  const s = new Date(start + "T00:00:00");
  const e = new Date(end + "T00:00:00");
  return Math.round((e.getTime() - s.getTime()) / 86_400_000) + 1;
}

export function todayISO(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function goalProgress(
  totalDays: number,
  checkedDays: number,
): { percentage: number; streak: number; status: "on-track" | "behind" | "ahead" | "completed" } {
  const percentage = totalDays > 0 ? Math.round((checkedDays / totalDays) * 100) : 0;

  let status: "on-track" | "behind" | "ahead" | "completed";
  if (percentage >= 100) {
    status = "completed";
  } else if (percentage >= 80) {
    status = "ahead";
  } else if (percentage >= 40) {
    status = "on-track";
  } else {
    status = "behind";
  }

  return { percentage, streak: checkedDays, status };
}

export function generateDateRange(start: string, end: string): string[] {
  const dates: string[] = [];
  const current = new Date(start + "T00:00:00");
  const endDate = new Date(end + "T00:00:00");

  while (current <= endDate) {
    dates.push(
      `${current.getFullYear()}-${String(current.getMonth() + 1).padStart(2, "0")}-${String(current.getDate()).padStart(2, "0")}`,
    );
    current.setDate(current.getDate() + 1);
  }

  return dates;
}
