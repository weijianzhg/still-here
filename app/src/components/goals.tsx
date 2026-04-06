"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import {
  Target,
  Plus,
  Check,
  X,
  TrendingUp,
  TrendingDown,
  Minus,
  Trash2,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { useAuth } from "@/components/auth-provider";
import { createClient } from "@/lib/supabase/client";
import {
  type Goal,
  type GoalCheckin,
  goalDaysBetween,
  todayISO,
  generateDateRange,
} from "@/lib/goals";

const GOALS_STORAGE_KEY = "still-here-goals";
const CHECKINS_STORAGE_KEY = "still-here-checkins";

function loadLocal<T>(key: string): T[] {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveLocal<T>(key: string, data: T[]) {
  localStorage.setItem(key, JSON.stringify(data));
}

export default function Goals() {
  const { user } = useAuth();
  const [goals, setGoals] = useState<Goal[]>(() =>
    typeof window !== "undefined" ? loadLocal<Goal>(GOALS_STORAGE_KEY) : [],
  );
  const [checkins, setCheckins] = useState<GoalCheckin[]>(() =>
    typeof window !== "undefined"
      ? loadLocal<GoalCheckin>(CHECKINS_STORAGE_KEY)
      : [],
  );
  const [showCreate, setShowCreate] = useState(false);
  const [selectedGoal, setSelectedGoal] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);

  // Fetch from Supabase when authenticated
  useEffect(() => {
    if (user) {
      const supabase = createClient();
      Promise.all([
        supabase
          .from("goals")
          .select("*")
          .order("created_at", { ascending: false }),
        supabase
          .from("goal_checkins")
          .select("*")
          .order("check_date", { ascending: true }),
      ]).then(([goalsRes, checkinsRes]) => {
        if (goalsRes.data) setGoals(goalsRes.data);
        if (checkinsRes.data) setCheckins(checkinsRes.data);
        queueMicrotask(() => setMounted(true));
      });
    } else {
      queueMicrotask(() => setMounted(true));
    }
  }, [user]);

  // Persist to localStorage when not logged in
  useEffect(() => {
    if (mounted && !user) {
      saveLocal(GOALS_STORAGE_KEY, goals);
    }
  }, [goals, mounted, user]);

  useEffect(() => {
    if (mounted && !user) {
      saveLocal(CHECKINS_STORAGE_KEY, checkins);
    }
  }, [checkins, mounted, user]);

  const createGoal = useCallback(
    async (title: string, description: string, startDate: string, endDate: string) => {
      const now = new Date().toISOString();
      const newGoal: Goal = {
        id: crypto.randomUUID(),
        user_id: user?.id ?? "local",
        title,
        description: description || null,
        start_date: startDate,
        end_date: endDate,
        created_at: now,
        updated_at: now,
      };

      if (user) {
        const supabase = createClient();
        const { data, error } = await supabase
          .from("goals")
          .insert({
            user_id: user.id,
            title,
            description: description || null,
            start_date: startDate,
            end_date: endDate,
          })
          .select()
          .single();
        if (!error && data) {
          setGoals((prev) => [data, ...prev]);
        }
      } else {
        setGoals((prev) => [newGoal, ...prev]);
      }
      setShowCreate(false);
    },
    [user],
  );

  const deleteGoal = useCallback(
    async (goalId: string) => {
      if (user) {
        const supabase = createClient();
        await supabase.from("goal_checkins").delete().eq("goal_id", goalId);
        await supabase.from("goals").delete().eq("id", goalId);
      }
      setGoals((prev) => prev.filter((g) => g.id !== goalId));
      setCheckins((prev) => prev.filter((c) => c.goal_id !== goalId));
      if (selectedGoal === goalId) setSelectedGoal(null);
    },
    [user, selectedGoal],
  );

  const toggleCheckin = useCallback(
    async (goalId: string, date: string) => {
      const existing = checkins.find(
        (c) => c.goal_id === goalId && c.check_date === date,
      );

      if (existing) {
        if (user) {
          const supabase = createClient();
          await supabase.from("goal_checkins").delete().eq("id", existing.id);
        }
        setCheckins((prev) => prev.filter((c) => c.id !== existing.id));
      } else {
        const newCheckin: GoalCheckin = {
          id: crypto.randomUUID(),
          goal_id: goalId,
          user_id: user?.id ?? "local",
          check_date: date,
          note: null,
          created_at: new Date().toISOString(),
        };

        if (user) {
          const supabase = createClient();
          const { data, error } = await supabase
            .from("goal_checkins")
            .insert({
              goal_id: goalId,
              user_id: user.id,
              check_date: date,
            })
            .select()
            .single();
          if (!error && data) {
            setCheckins((prev) => [...prev, data]);
          }
        } else {
          setCheckins((prev) => [...prev, newCheckin]);
        }
      }
    },
    [user, checkins],
  );

  const activeGoal = useMemo(
    () => goals.find((g) => g.id === selectedGoal) ?? null,
    [goals, selectedGoal],
  );

  if (!mounted) return null;

  return (
    <div className="mt-12">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Target className="h-4 w-4 text-stone-500" />
          <h2 className="text-lg font-semibold text-stone-800">Goals</h2>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="flex items-center gap-1.5 rounded-xl bg-stone-800 px-3 py-1.5 text-xs font-medium text-white shadow-sm transition-colors hover:bg-stone-700"
        >
          <Plus className="h-3.5 w-3.5" />
          New goal
        </button>
      </div>

      {goals.length === 0 ? (
        <div className="mt-6 rounded-2xl border border-dashed border-stone-200 bg-white/50 p-8 text-center">
          <Target className="mx-auto h-8 w-8 text-stone-300" />
          <p className="mt-3 text-sm text-stone-500">
            No goals yet. Create a 30-day plan, a yearly commitment, or
            anything in between.
          </p>
          <button
            onClick={() => setShowCreate(true)}
            className="mt-4 inline-flex items-center gap-1.5 rounded-xl bg-stone-800 px-4 py-2 text-xs font-medium text-white shadow-sm transition-colors hover:bg-stone-700"
          >
            <Plus className="h-3.5 w-3.5" />
            Create your first goal
          </button>
        </div>
      ) : (
        <div className="mt-4 space-y-3">
          {goals.map((goal) => {
            const goalCheckins = checkins.filter(
              (c) => c.goal_id === goal.id,
            );
            const totalDays = goalDaysBetween(goal.start_date, goal.end_date);
            const checkedDays = goalCheckins.length;
            const today = todayISO();
            const isActive =
              today >= goal.start_date && today <= goal.end_date;
            const isCheckedToday = goalCheckins.some(
              (c) => c.check_date === today,
            );
            const pct =
              totalDays > 0
                ? Math.round((checkedDays / totalDays) * 100)
                : 0;

            const elapsed = goalDaysBetween(goal.start_date, today < goal.end_date ? today : goal.end_date);
            const expectedPct = totalDays > 0 ? Math.round((elapsed / totalDays) * 100) : 0;
            const trend = pct > expectedPct ? "up" : pct < expectedPct ? "down" : "flat";

            return (
              <div
                key={goal.id}
                className="rounded-2xl bg-white p-4 shadow-sm transition-shadow hover:shadow-md"
              >
                <div className="flex items-start justify-between gap-3">
                  <button
                    onClick={() =>
                      setSelectedGoal(
                        selectedGoal === goal.id ? null : goal.id,
                      )
                    }
                    className="min-w-0 flex-1 text-left"
                  >
                    <div className="flex items-center gap-2">
                      <h3 className="truncate text-sm font-semibold text-stone-800">
                        {goal.title}
                      </h3>
                      {trend === "up" && (
                        <TrendingUp className="h-3.5 w-3.5 shrink-0 text-emerald-500" />
                      )}
                      {trend === "down" && (
                        <TrendingDown className="h-3.5 w-3.5 shrink-0 text-red-400" />
                      )}
                      {trend === "flat" && (
                        <Minus className="h-3.5 w-3.5 shrink-0 text-stone-400" />
                      )}
                    </div>
                    <p className="mt-0.5 text-xs text-stone-400">
                      {checkedDays}/{totalDays} days &middot; {pct}%
                      {goal.description && (
                        <span className="text-stone-300"> &middot; </span>
                      )}
                      {goal.description && (
                        <span className="text-stone-400">
                          {goal.description}
                        </span>
                      )}
                    </p>
                  </button>

                  <div className="flex shrink-0 items-center gap-2">
                    {isActive && (
                      <button
                        onClick={() => toggleCheckin(goal.id, today)}
                        className={`flex h-8 w-8 items-center justify-center rounded-lg transition-colors ${
                          isCheckedToday
                            ? "bg-emerald-100 text-emerald-600"
                            : "bg-stone-100 text-stone-400 hover:bg-amber-100 hover:text-amber-600"
                        }`}
                        title={
                          isCheckedToday
                            ? "Uncheck today"
                            : "Check off today"
                        }
                      >
                        {isCheckedToday ? (
                          <Check className="h-4 w-4" />
                        ) : (
                          <X className="h-4 w-4" />
                        )}
                      </button>
                    )}
                    <button
                      onClick={() => deleteGoal(goal.id)}
                      className="flex h-8 w-8 items-center justify-center rounded-lg text-stone-300 transition-colors hover:bg-red-50 hover:text-red-400"
                      title="Delete goal"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>

                {/* Progress bar */}
                <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-stone-100">
                  <div
                    className="h-full rounded-full bg-amber-400 transition-all duration-300"
                    style={{ width: `${Math.min(100, pct)}%` }}
                  />
                </div>

                {/* Expanded check-in grid */}
                {selectedGoal === goal.id && (
                  <CheckinGrid
                    goal={goal}
                    checkins={goalCheckins}
                    onToggle={toggleCheckin}
                  />
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Create goal dialog */}
      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent className="max-w-md rounded-2xl">
          <DialogHeader>
            <DialogTitle className="text-lg font-semibold text-stone-800">
              New goal
            </DialogTitle>
          </DialogHeader>
          <CreateGoalForm
            onSubmit={createGoal}
            onCancel={() => setShowCreate(false)}
          />
        </DialogContent>
      </Dialog>

      {/* Goal detail dialog */}
      {activeGoal && (
        <Dialog
          open={!!activeGoal}
          onOpenChange={() => setSelectedGoal(null)}
        >
          <DialogContent className="max-w-lg rounded-2xl">
            <DialogHeader>
              <DialogTitle className="text-lg font-semibold text-stone-800">
                {activeGoal.title}
              </DialogTitle>
            </DialogHeader>
            <GoalDetail
              goal={activeGoal}
              checkins={checkins.filter(
                (c) => c.goal_id === activeGoal.id,
              )}
              onToggle={toggleCheckin}
            />
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------

function CreateGoalForm({
  onSubmit,
  onCancel,
}: {
  onSubmit: (
    title: string,
    description: string,
    startDate: string,
    endDate: string,
  ) => void;
  onCancel: () => void;
}) {
  const today = todayISO();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [startDate, setStartDate] = useState(today);
  const [endDate, setEndDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 29);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  });
  const [preset, setPreset] = useState<string>("30");

  const applyPreset = (days: string) => {
    setPreset(days);
    const d = new Date(startDate + "T00:00:00");
    d.setDate(d.getDate() + parseInt(days) - 1);
    setEndDate(
      `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`,
    );
  };

  const totalDays =
    startDate && endDate ? goalDaysBetween(startDate, endDate) : 0;
  const valid = title.trim() && startDate && endDate && totalDays > 0;

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label className="text-sm text-stone-600">Goal title</Label>
        <Input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="e.g. Daily meditation, Read every day"
          className="rounded-xl"
        />
      </div>

      <div className="space-y-2">
        <Label className="text-sm text-stone-600">
          Description{" "}
          <span className="text-stone-400">(optional)</span>
        </Label>
        <Input
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="What does success look like?"
          className="rounded-xl"
        />
      </div>

      <div className="space-y-2">
        <Label className="text-sm text-stone-600">Duration</Label>
        <div className="flex flex-wrap gap-2">
          {[
            { label: "7 days", value: "7" },
            { label: "30 days", value: "30" },
            { label: "90 days", value: "90" },
            { label: "365 days", value: "365" },
            { label: "Custom", value: "custom" },
          ].map((p) => (
            <button
              key={p.value}
              onClick={() => {
                if (p.value !== "custom") applyPreset(p.value);
                setPreset(p.value);
              }}
              className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
                preset === p.value
                  ? "bg-stone-800 text-white"
                  : "bg-stone-100 text-stone-600 hover:bg-stone-200"
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-2">
          <Label className="text-sm text-stone-600">Start date</Label>
          <Input
            type="date"
            value={startDate}
            onChange={(e) => {
              setStartDate(e.target.value);
              setPreset("custom");
            }}
            className="rounded-xl"
          />
        </div>
        <div className="space-y-2">
          <Label className="text-sm text-stone-600">End date</Label>
          <Input
            type="date"
            value={endDate}
            onChange={(e) => {
              setEndDate(e.target.value);
              setPreset("custom");
            }}
            className="rounded-xl"
          />
        </div>
      </div>

      {totalDays > 0 && (
        <p className="text-xs text-stone-400">
          {totalDays} day{totalDays !== 1 ? "s" : ""} total
        </p>
      )}

      <Separator />

      <div className="flex justify-end gap-2">
        <button
          onClick={onCancel}
          className="rounded-xl px-4 py-2 text-sm font-medium text-stone-600 transition-colors hover:bg-stone-100"
        >
          Cancel
        </button>
        <button
          onClick={() => {
            if (valid) onSubmit(title.trim(), description.trim(), startDate, endDate);
          }}
          disabled={!valid}
          className="rounded-xl bg-stone-800 px-4 py-2 text-sm font-medium text-white shadow-sm transition-colors hover:bg-stone-700 disabled:cursor-not-allowed disabled:opacity-40"
        >
          Create goal
        </button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------

function GoalDetail({
  goal,
  checkins,
  onToggle,
}: {
  goal: Goal;
  checkins: GoalCheckin[];
  onToggle: (goalId: string, date: string) => void;
}) {
  const totalDays = goalDaysBetween(goal.start_date, goal.end_date);
  const checkedDays = checkins.length;
  const pct = totalDays > 0 ? Math.round((checkedDays / totalDays) * 100) : 0;

  return (
    <div className="space-y-4">
      {goal.description && (
        <p className="text-sm text-stone-500">{goal.description}</p>
      )}

      <div className="grid grid-cols-3 gap-3">
        <div className="rounded-xl bg-stone-50 p-3 text-center">
          <p className="text-lg font-semibold tabular-nums text-stone-800">
            {checkedDays}
          </p>
          <p className="text-[0.65rem] text-stone-400">checked</p>
        </div>
        <div className="rounded-xl bg-stone-50 p-3 text-center">
          <p className="text-lg font-semibold tabular-nums text-stone-800">
            {totalDays - checkedDays}
          </p>
          <p className="text-[0.65rem] text-stone-400">remaining</p>
        </div>
        <div className="rounded-xl bg-stone-50 p-3 text-center">
          <p className="text-lg font-semibold tabular-nums text-stone-800">
            {pct}%
          </p>
          <p className="text-[0.65rem] text-stone-400">complete</p>
        </div>
      </div>

      <div className="h-2 overflow-hidden rounded-full bg-stone-100">
        <div
          className="h-full rounded-full bg-amber-400 transition-all duration-300"
          style={{ width: `${Math.min(100, pct)}%` }}
        />
      </div>

      <CheckinGrid goal={goal} checkins={checkins} onToggle={onToggle} />
    </div>
  );
}

// ---------------------------------------------------------------------------

function CheckinGrid({
  goal,
  checkins,
  onToggle,
}: {
  goal: Goal;
  checkins: GoalCheckin[];
  onToggle: (goalId: string, date: string) => void;
}) {
  const today = todayISO();
  const allDates = useMemo(
    () => generateDateRange(goal.start_date, goal.end_date),
    [goal.start_date, goal.end_date],
  );
  const checkedSet = useMemo(
    () => new Set(checkins.map((c) => c.check_date)),
    [checkins],
  );

  // Paginate by month
  const months = useMemo(() => {
    const map = new Map<string, string[]>();
    for (const date of allDates) {
      const monthKey = date.substring(0, 7);
      const arr = map.get(monthKey) ?? [];
      arr.push(date);
      map.set(monthKey, arr);
    }
    return Array.from(map.entries());
  }, [allDates]);

  const [monthIdx, setMonthIdx] = useState(() => {
    const todayMonth = today.substring(0, 7);
    const idx = months.findIndex(([m]) => m === todayMonth);
    return idx >= 0 ? idx : 0;
  });

  const [currentMonth, currentDates] = months[monthIdx] ?? [
    "",
    [] as string[],
  ];

  const monthLabel = currentMonth
    ? new Date(currentMonth + "-01T00:00:00").toLocaleDateString(undefined, {
        month: "long",
        year: "numeric",
      })
    : "";

  // Build calendar grid with proper day-of-week alignment
  const firstDow = new Date(currentDates[0] + "T00:00:00").getDay();
  const paddedDates: (string | null)[] = [
    ...Array(firstDow).fill(null),
    ...currentDates,
  ];

  return (
    <div className="mt-4 space-y-3">
      <div className="flex items-center justify-between">
        <button
          onClick={() => setMonthIdx((i) => Math.max(0, i - 1))}
          disabled={monthIdx === 0}
          className="rounded-lg p-1 text-stone-400 transition-colors hover:bg-stone-100 hover:text-stone-600 disabled:opacity-30"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
        <p className="text-xs font-medium text-stone-600">{monthLabel}</p>
        <button
          onClick={() =>
            setMonthIdx((i) => Math.min(months.length - 1, i + 1))
          }
          disabled={monthIdx >= months.length - 1}
          className="rounded-lg p-1 text-stone-400 transition-colors hover:bg-stone-100 hover:text-stone-600 disabled:opacity-30"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>

      {/* Day of week headers */}
      <div className="grid grid-cols-7 gap-1 text-center text-[0.6rem] text-stone-400">
        {["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"].map((d) => (
          <span key={d}>{d}</span>
        ))}
      </div>

      {/* Date cells */}
      <div className="grid grid-cols-7 gap-1">
        {paddedDates.map((date, i) => {
          if (!date) return <div key={`pad-${i}`} />;

          const checked = checkedSet.has(date);
          const isToday = date === today;
          const isFuture = date > today;
          const dayNum = new Date(date + "T00:00:00").getDate();

          return (
            <button
              key={date}
              onClick={() => {
                if (!isFuture) onToggle(goal.id, date);
              }}
              disabled={isFuture}
              className={`flex h-8 w-full items-center justify-center rounded-lg text-xs tabular-nums transition-colors ${
                checked
                  ? "bg-emerald-100 font-medium text-emerald-700"
                  : isToday
                    ? "bg-amber-50 font-medium text-amber-700 ring-1 ring-amber-300"
                    : isFuture
                      ? "text-stone-300"
                      : "text-stone-500 hover:bg-stone-100"
              }`}
              title={date}
            >
              {checked ? (
                <Check className="h-3.5 w-3.5" />
              ) : (
                dayNum
              )}
            </button>
          );
        })}
      </div>

      {/* Streak info */}
      <StreakInfo dates={allDates} checkedSet={checkedSet} today={today} />
    </div>
  );
}

// ---------------------------------------------------------------------------

function StreakInfo({
  dates,
  checkedSet,
  today,
}: {
  dates: string[];
  checkedSet: Set<string>;
  today: string;
}) {
  const { current, longest } = useMemo(() => {
    let currentStreak = 0;
    let longestStreak = 0;
    let streak = 0;

    for (const date of dates) {
      if (date > today) break;
      if (checkedSet.has(date)) {
        streak++;
        longestStreak = Math.max(longestStreak, streak);
      } else {
        streak = 0;
      }
    }
    currentStreak = streak;

    return { current: currentStreak, longest: longestStreak };
  }, [dates, checkedSet, today]);

  return (
    <div className="flex gap-4 text-xs text-stone-400">
      <span>
        Current streak:{" "}
        <span className="font-medium text-stone-600">{current} day{current !== 1 ? "s" : ""}</span>
      </span>
      <span>
        Longest:{" "}
        <span className="font-medium text-stone-600">{longest} day{longest !== 1 ? "s" : ""}</span>
      </span>
    </div>
  );
}
