"use client";

import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import {
  Flag,
  Settings,
  Trash2,
} from "lucide-react";
import { regions, getRegionById } from "@/lib/life-data";
import { calculateGoalProgress, calculateLifeStats } from "@/lib/calculator";

// ---------------------------------------------------------------------------

interface Settings {
  birthdate: string;
  regionId: string;
  customLifeExpectancy: string;
  goalTitle: string;
  goalStartDate: string;
  goalEndDate: string;
}

const STORAGE_KEY = "still-here-settings";

const DEFAULT_SETTINGS: Settings = {
  birthdate: "",
  regionId: "world",
  customLifeExpectancy: "73",
  goalTitle: "",
  goalStartDate: todayIsoDate(),
  goalEndDate: "",
};

function settingsWithGeoSuggestion(suggestedRegionId?: string | null): Settings {
  const next = { ...DEFAULT_SETTINGS };
  if (
    suggestedRegionId &&
    suggestedRegionId !== "custom" &&
    getRegionById(suggestedRegionId)
  ) {
    next.regionId = suggestedRegionId;
  }
  return next;
}

function fmt(n: number): string {
  return new Intl.NumberFormat().format(n);
}

function todayIsoDate(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function parseIsoDate(s: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return null;
  const d = new Date(`${s}T00:00:00`);
  if (isNaN(d.getTime())) return null;
  return d;
}

function isoToSlashDate(s: string): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return "";
  return s.replaceAll("-", "/");
}

function isoFromDigits(digits: string): string | null {
  if (!/^\d{8}$/.test(digits)) return null;
  const y = parseInt(digits.slice(0, 4), 10);
  const m = parseInt(digits.slice(4, 6), 10);
  const d = parseInt(digits.slice(6, 8), 10);
  if (m < 1 || m > 12 || d < 1 || d > 31) return null;
  const dt = new Date(y, m - 1, d);
  if (dt.getFullYear() !== y || dt.getMonth() !== m - 1 || dt.getDate() !== d) return null;
  return `${String(y).padStart(4, "0")}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

function formatDigitsAsSlashDate(digits: string): string {
  if (digits.length <= 4) return digits;
  if (digits.length <= 6) return `${digits.slice(0, 4)}/${digits.slice(4)}`;
  return `${digits.slice(0, 4)}/${digits.slice(4, 6)}/${digits.slice(6, 8)}`;
}

function BirthDateFields({
  value,
  onChange,
}: {
  value: string;
  onChange: (iso: string) => void;
}) {
  const [draft, setDraft] = useState(() => isoToSlashDate(value));

  useEffect(() => {
    setDraft(isoToSlashDate(value));
  }, [value]);

  const digits = draft.replace(/\D/g, "");
  const invalid = digits.length === 8 && !isoFromDigits(digits);

  return (
    <Input
      type="text"
      inputMode="numeric"
      autoComplete="bday"
      placeholder="YYYY/MM/DD"
      value={draft}
      onChange={(e) => {
        const nextDigits = e.target.value.replace(/\D/g, "").slice(0, 8);
        setDraft(formatDigitsAsSlashDate(nextDigits));
        if (nextDigits.length === 0) {
          onChange("");
          return;
        }
        if (nextDigits.length === 8) {
          const iso = isoFromDigits(nextDigits);
          if (iso) onChange(iso);
        }
      }}
      aria-invalid={invalid}
      className="h-10 rounded-lg px-4 text-[#F3F5F7] tabular-nums tracking-wide text-base"
    />
  );
}

// ---------------------------------------------------------------------------

export default function StillHere({
  suggestedRegionId,
}: {
  suggestedRegionId?: string | null;
} = {}) {
  const [settings, setSettings] = useState<Settings>(() =>
    settingsWithGeoSuggestion(suggestedRegionId),
  );
  const [showGoalSetup, setShowGoalSetup] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [mounted, setMounted] = useState(false);

  /* ---- hydrate from localStorage ---- */
  useEffect(() => {
    try {
      const s = localStorage.getItem(STORAGE_KEY);
      if (s) {
        const parsed = JSON.parse(s) as Partial<Settings>;
        queueMicrotask(() =>
          setSettings((prev) => {
            const merged = { ...prev, ...parsed };
            if (!parseIsoDate(merged.goalStartDate)) {
              merged.goalStartDate = todayIsoDate();
            }
            return merged;
          }),
        );
      }
    } catch {
      /* corrupt data – use defaults */
    }
    queueMicrotask(() => setMounted(true));
  }, []);

  /* ---- persist ---- */
  useEffect(() => {
    if (mounted) localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  }, [settings, mounted]);

  /* ---- derived ---- */
  const lifeExpectancy = useMemo(() => {
    if (settings.regionId === "custom") return parseFloat(settings.customLifeExpectancy) || 0;
    return getRegionById(settings.regionId)?.lifeExpectancy ?? 73;
  }, [settings.regionId, settings.customLifeExpectancy]);

  const stats = useMemo(() => {
    if (!settings.birthdate) return null;
    const birth = new Date(`${settings.birthdate}T00:00:00`);
    return calculateLifeStats(birth, lifeExpectancy, true);
  }, [settings.birthdate, lifeExpectancy]);

  const goalDateRangeInvalid = useMemo(() => {
    const start = parseIsoDate(settings.goalStartDate);
    const end = parseIsoDate(settings.goalEndDate);
    if (!start || !end) return false;
    return end.getTime() < start.getTime();
  }, [settings.goalStartDate, settings.goalEndDate]);

  const goalProgress = useMemo(() => {
    const start = parseIsoDate(settings.goalStartDate);
    const end = parseIsoDate(settings.goalEndDate);
    if (!start || !end || end.getTime() < start.getTime()) return null;
    return calculateGoalProgress(start, end);
  }, [settings.goalStartDate, settings.goalEndDate]);

  /* ---- actions ---- */
  const set = useCallback(
    (key: keyof Settings, value: string | boolean) =>
      setSettings((prev) => ({ ...prev, [key]: value })),
    [],
  );

  const clearGoal = useCallback(() => {
    const shouldClear = window.confirm("Remove this goal timeline?");
    if (!shouldClear) return;
    setSettings((prev) => ({
      ...prev,
      goalTitle: "",
      goalStartDate: todayIsoDate(),
      goalEndDate: "",
    }));
  }, []);

  /* ---- loading guard (avoids SSR/client mismatch) ---- */
  if (!mounted) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#0B0D10]">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-[#27303A] border-t-[#6366F1]" />
      </div>
    );
  }

  // -----------------------------------------------------------------------
  return (
      <div className="min-h-screen bg-[#0B0D10]">
        {/* ============ TOP LEFT GOAL SETUP ============ */}
        <div className="absolute top-4 left-4">
          <button
            onClick={() => setShowGoalSetup((v) => !v)}
            className="flex items-center gap-1.5 text-xs font-medium text-[#A8B3C2] hover:text-[#EEF2FF] transition-colors"
          >
            <Flag className="h-4 w-4" />
            <span>Goal</span>
          </button>
        </div>

        {/* ============ TOP RIGHT SETTINGS ============ */}
        {stats && (
          <div className="absolute top-4 right-4">
            <button
              onClick={() => setShowSettings((v) => !v)}
            className="flex items-center gap-1.5 text-xs font-medium text-[#A8B3C2] hover:text-[#EEF2FF] transition-colors"
          >
            <Settings className="h-4 w-4" />
            </button>
          </div>
        )}

        {/* ============ HERO ============ */}
        <header className="mx-auto max-w-4xl px-4 pt-16 text-center sm:px-6 lg:px-8">
          <h2 className="text-base font-semibold tracking-wide text-[#F3F5F7]">
            Still Here
          </h2>

          {stats ? (
            <>
              <h1 className="mt-5 text-6xl font-bold tabular-nums tracking-tight text-[#F3F5F7] sm:text-8xl">
                {fmt(stats.daysRemaining)}
              </h1>
              <p className="mt-2 text-base text-[#A8B3C2]">
                days remaining&ensp;&middot;&ensp;{stats.todayLabel}
              </p>
            </>
          ) : (
            <>
              <h1 className="mt-6 text-5xl font-bold tracking-tight text-[#F3F5F7] sm:text-7xl">
                Hello
              </h1>
              <p className="mx-auto mt-3 max-w-md text-lg leading-relaxed text-[#A8B3C2]">
                Enter your birth date to start counting your days.
              </p>
            </>
          )}
        </header>

        {/* ============ LIFE GRID (wider container) ============ */}
        {stats && (
          <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
            <LifeGrid daysAlive={stats.daysAlive} totalDays={stats.totalDays} stats={stats} />
          </div>
        )}

        <div className="mx-auto max-w-4xl px-4 pb-16 sm:px-6 lg:px-8">
          {/* ============ GOAL TIMELINE ============ */}
          {(goalProgress || goalDateRangeInvalid || settings.goalEndDate) && (
            <div className="mt-8">
              {goalProgress ? (
                <GoalTimeline
                  title={settings.goalTitle}
                  startDate={settings.goalStartDate}
                  endDate={settings.goalEndDate}
                  elapsedGoalDays={goalProgress.elapsedGoalDays}
                  totalGoalDays={goalProgress.totalGoalDays}
                  remainingGoalDays={goalProgress.remainingGoalDays}
                  progressPct={goalProgress.progressPct}
                  onRemoveGoal={clearGoal}
                />
              ) : goalDateRangeInvalid ? (
                <p className="rounded-lg border border-[#7F1D1D] bg-[#7F1D1D]/20 px-4 py-3 text-sm text-[#F87171]">
                  Goal timeline not shown because end date is before start date.
                </p>
              ) : (
                <p className="rounded-lg border border-[#27303A] bg-[#11151A] px-4 py-3 text-sm text-[#A8B3C2]">
                  Add a valid start and end date in the goal section to show your timeline.
                </p>
              )}
            </div>
          )}

          {/* Stats are rendered inline within the life grid */}

          {/* ============ SETTINGS DIALOG ============ */}
          {!stats && (
            <div className="mt-10 mx-auto max-w-md">
              <SettingsCard settings={settings} stats={stats} set={set} />
            </div>
          )}
          <Dialog open={!!stats && showSettings} onOpenChange={setShowSettings}>
            <DialogContent className="max-w-md rounded-[16px] border-[#27303A] bg-[#11151A] text-[#F3F5F7]">
              <DialogHeader>
                <DialogTitle className="text-lg font-semibold text-[#F3F5F7]">Your clock</DialogTitle>
              </DialogHeader>
              <SettingsCard settings={settings} stats={stats} set={set} />
            </DialogContent>
          </Dialog>
          <Dialog open={showGoalSetup} onOpenChange={setShowGoalSetup}>
            <DialogContent className="max-w-md rounded-[16px] border-[#27303A] bg-[#11151A] text-[#F3F5F7]">
              <DialogHeader>
                <DialogTitle className="text-lg font-semibold text-[#F3F5F7]">
                  Goal timeline
                </DialogTitle>
              </DialogHeader>
              <GoalSetupCard settings={settings} set={set} onRemoveGoal={clearGoal} />
            </DialogContent>
          </Dialog>

          {/* ============ FOOTER ============ */}
          <footer className="mt-20 text-center">
            <Separator className="mb-8" />
            <div className="mx-auto mb-6 max-w-2xl rounded-[16px] border border-[#27303A] bg-[#11151A] p-5 text-left space-y-3">
              <p className="text-sm font-medium text-[#F3F5F7]">How it works</p>
              <p className="text-sm leading-relaxed text-[#A8B3C2]">
                <span className="font-medium text-[#F3F5F7]">Your data stays on your device.</span>{" "}
                Everything you enter is kept in your browser&apos;s local storage. Nothing is sent to a server, and
                we don&apos;t have accounts or a database with your information.
              </p>
              <p className="text-sm leading-relaxed text-[#A8B3C2]">
                <span className="font-medium text-[#F3F5F7]">The math is straightforward.</span>{" "}
                Days lived = your birth date to today. Days remaining = average lifespan for your
                region minus days lived, adjusted slightly upward because you&apos;re already here.
              </p>
            </div>
            <p className="text-xs text-[#6B7A8D]">
              This is not prophecy. It is a memento mori with better UI.
            </p>
          </footer>
        </div>
      </div>
  );
}

// ---------------------------------------------------------------------------
// Small helpers to keep the JSX tidy
// ---------------------------------------------------------------------------

function SettingsCard({
  settings,
  stats,
  set,
}: {
  settings: Settings;
  stats: ReturnType<typeof calculateLifeStats> | null;
  set: (key: keyof Settings, value: string | boolean) => void;
}) {
  return (
    <div className="space-y-5">
      <Field label="Birth date">
        <BirthDateFields value={settings.birthdate} onChange={(iso) => set("birthdate", iso)} />
      </Field>

      <Field label="Region">
        <Select value={settings.regionId} onValueChange={(v) => v && set("regionId", v)}>
          <SelectTrigger
            className="h-10 w-full min-w-0 justify-between gap-3 rounded-lg border-[#27303A] bg-[#171C22] px-4 py-2 text-left text-sm font-medium text-[#F3F5F7] hover:bg-[#1E242C] data-placeholder:text-[#6B7A8D] [&_svg]:shrink-0 [&_svg]:text-[#A8B3C2]"
          >
            <SelectValue placeholder="Choose region" />
          </SelectTrigger>
          <SelectContent
            align="start"
            alignItemWithTrigger={false}
            side="bottom"
            sideOffset={6}
            className="max-h-[min(17rem,50dvh)] rounded-lg border-[#27303A] bg-[#11151A] p-1 ring-1 ring-[#27303A]"
          >
            {regions.map((r) => (
              <SelectItem
                key={r.id}
                value={r.id}
                className="rounded-[6px] py-2.5 pl-3 text-[#F3F5F7] transition-colors hover:bg-[#1E242C] hover:text-[#EEF2FF] data-[highlighted]:bg-[#1E1B4B] data-[highlighted]:text-[#EEF2FF]"
              >
                <span className="min-w-0 flex-1 truncate text-[#F3F5F7]">{r.name}</span>
                {r.lifeExpectancy > 0 ? (
                  <span className="shrink-0 tabular-nums text-xs text-[#6B7A8D]">{r.lifeExpectancy} yr</span>
                ) : null}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Field>

      {settings.regionId === "custom" && (
        <Field label="Life expectancy (years)">
          <Input
            type="number"
            step="0.1"
            min="1"
            max="150"
            value={settings.customLifeExpectancy}
            onChange={(e) => set("customLifeExpectancy", e.target.value)}
            className="h-10 rounded-lg"
          />
        </Field>
      )}

      {stats && (
        <div className="space-y-1 rounded-lg border border-[#27303A] bg-[#171C22] p-4 text-sm">
          <Row k="Current age" v={`${stats.currentAge.toFixed(1)} years`} />
          <Row
            k="Expected lifespan"
            v={`${stats.expectedLifespan} years (adjusted)`}
          />
          <Row k="Estimated total days" v={fmt(stats.totalDays)} />
        </div>
      )}
    </div>
  );
}

function GoalSetupCard({
  settings,
  set,
  onRemoveGoal,
}: {
  settings: Settings;
  set: (key: keyof Settings, value: string | boolean) => void;
  onRemoveGoal: () => void;
}) {
  const goalStart = parseIsoDate(settings.goalStartDate);
  const goalEnd = parseIsoDate(settings.goalEndDate);
  const invalidGoalRange =
    !!goalStart && !!goalEnd && goalEnd.getTime() < goalStart.getTime();

  return (
    <section className="space-y-5 rounded-[16px] border border-[#27303A] bg-[#11151A] p-5">
      <p className="text-sm font-medium text-[#F3F5F7]">Goal setup</p>

      <Field label="Goal name (optional)">
        <Input
          value={settings.goalTitle}
          onChange={(e) => set("goalTitle", e.target.value)}
          placeholder="Example: Finish project alpha"
          className="h-10 rounded-lg"
        />
      </Field>

      <Field label="Start date">
        <BirthDateFields value={settings.goalStartDate} onChange={(iso) => set("goalStartDate", iso)} />
      </Field>

      <Field label="End date">
        <BirthDateFields value={settings.goalEndDate} onChange={(iso) => set("goalEndDate", iso)} />
      </Field>

      {settings.goalStartDate && !settings.goalEndDate && (
        <p className="rounded-lg border border-[#27303A] bg-[#171C22] px-4 py-3 text-xs text-[#A8B3C2]">
          Pick an end date to start tracking daily X marks.
        </p>
      )}

      {!settings.goalStartDate && settings.goalEndDate && (
        <p className="rounded-lg border border-[#27303A] bg-[#171C22] px-4 py-3 text-xs text-[#A8B3C2]">
          Add a start date before the end date.
        </p>
      )}

      {invalidGoalRange && (
        <p className="rounded-lg border border-[#7F1D1D] bg-[#7F1D1D]/20 px-4 py-3 text-xs text-[#F87171]">
          End date must be on or after start date.
        </p>
      )}

      {(settings.goalTitle.trim() || settings.goalEndDate) && (
        <button
          type="button"
          onClick={onRemoveGoal}
          className="inline-flex items-center gap-2 rounded-lg border border-[#7F1D1D] px-3 py-2 text-xs font-medium text-[#F87171] transition-colors hover:bg-[#7F1D1D]/20"
        >
          <Trash2 className="h-3.5 w-3.5" />
          Remove goal
        </button>
      )}
    </section>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <Label className="text-sm text-[#A8B3C2]">{label}</Label>
      {children}
    </div>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <p className="text-[#A8B3C2]">
      <span className="text-[#6B7A8D]">{k}:</span>{" "}
      <span className="font-medium">{v}</span>
    </p>
  );
}

function LifeGrid({
  daysAlive,
  totalDays,
  stats,
}: {
  daysAlive: number;
  totalDays: number;
  stats: NonNullable<ReturnType<typeof calculateLifeStats>>;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [cols, setCols] = useState(0);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const update = () => setCols(Math.floor((el.clientWidth + 3) / 11));
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const totalWeeks = Math.ceil(totalDays / 7);
  const weeksLived = Math.floor(daysAlive / 7);
  const totalRows = cols > 0 ? Math.ceil(totalWeeks / cols) : 0;

  const wide = cols >= 56;
  const boxW = wide ? Math.min(48, cols - 6) : Math.min(24, cols - 4);
  const boxH = wide ? 8 : 10;
  const holePad = 1;
  const holeW = boxW + holePad * 2;
  const holeH = boxH + holePad * 2;
  const holeC0 = Math.max(0, Math.floor((cols - holeW) / 2));
  const holeR0 = Math.max(0, Math.floor((totalRows - holeH) / 2));
  const boxC0 = holeC0 + holePad;
  const boxR0 = holeR0 + holePad;

  const canInline = cols > 0 && totalRows >= holeH + 4 && cols >= boxW + 4;

  return (
    <div className="mt-12" ref={containerRef}>
      {cols > 0 && (
        <>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: `repeat(${cols}, 8px)`,
              gap: "3px",
              justifyContent: "center",
            }}
          >
            {canInline && (
              <div
                className="z-10 flex items-center justify-center"
                style={{
                  gridColumn: `${boxC0 + 1} / ${boxC0 + boxW + 1}`,
                  gridRow: `${boxR0 + 1} / ${boxR0 + boxH + 1}`,
                }}
              >
                <div
                  className={`grid gap-y-2 ${
                    wide ? "grid-cols-4 gap-x-6" : "grid-cols-2 gap-x-4"
                  }`}
                >
                  <GridStat label="Days lived" value={fmt(stats.daysAlive)} wide={wide} />
                  <GridStat label="Days remaining" value={fmt(stats.daysRemaining)} wide={wide} />
                  <GridStat label="Weeks remaining" value={fmt(stats.weeksRemaining)} wide={wide} />
                  <GridStat label="Years remaining" value={stats.remainingYears.toFixed(1)} wide={wide} />
                </div>
              </div>
            )}
            {Array.from({ length: totalWeeks }, (_, i) => {
              const r = Math.floor(i / cols);
              const c = i % cols;
              if (
                canInline &&
                r >= holeR0 && r < holeR0 + holeH &&
                c >= holeC0 && c < holeC0 + holeW
              ) return null;
              return (
                <div
                  key={i}
                  style={{ gridRow: r + 1, gridColumn: c + 1 }}
                  className={`h-2 w-2 rounded-full ${
                    i < weeksLived ? "bg-[#6366F1]" : "bg-[#27303A]"
                  }`}
                />
              );
            })}
          </div>
          <div className="mt-2 flex justify-between text-xs text-[#6B7A8D]">
            <span>birth</span>
            <span className="tabular-nums">
              {((weeksLived / totalWeeks) * 100).toFixed(1)}% lived
            </span>
            <span>end</span>
          </div>
        </>
      )}
    </div>
  );
}

function GridStat({
  label,
  value,
  wide,
}: {
  label: string;
  value: string;
  wide: boolean;
}) {
  return (
    <div className="text-center">
      <p className={`font-semibold tabular-nums text-[#F3F5F7] ${wide ? "text-2xl" : "text-lg"}`}>
        {value}
      </p>
      <p className={`mt-0.5 text-[#A8B3C2] ${wide ? "text-xs" : "text-[10px]"}`}>
        {label}
      </p>
    </div>
  );
}

function GoalTimeline({
  title,
  startDate,
  endDate,
  elapsedGoalDays,
  totalGoalDays,
  remainingGoalDays,
  progressPct,
  onRemoveGoal,
}: {
  title: string;
  startDate: string;
  endDate: string;
  elapsedGoalDays: number;
  totalGoalDays: number;
  remainingGoalDays: number;
  progressPct: number;
  onRemoveGoal: () => void;
}) {
  const todayLabel = new Date().toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });

  return (
    <section className="rounded-[16px] border border-[#27303A] bg-[#11151A] p-5">
      <div className="mb-3 flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-sm font-medium text-[#F3F5F7]">
            {title.trim() || "Goal timeline"}
          </p>
          <p className="shrink-0 text-xs tabular-nums text-[#A8B3C2]">
            {fmt(elapsedGoalDays)} / {fmt(totalGoalDays)} days
          </p>
        </div>
        <button
          type="button"
          aria-label="Remove goal"
          onClick={onRemoveGoal}
          className="inline-flex items-center gap-1 rounded-lg p-1.5 text-[#F87171] transition-colors hover:bg-[#7F1D1D]/20"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </div>

      <div className="rounded-lg bg-[#171C22] p-3">
        <div className="h-2 w-full rounded-full bg-[#27303A]">
          <div
            className="h-2 rounded-full bg-[#6366F1] transition-all"
            style={{ width: `${Math.max(progressPct, 1)}%` }}
          />
        </div>
      </div>

      <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-xs text-[#A8B3C2]">
        <span>start {startDate}</span>
        <span>today {todayLabel}</span>
        <span>end {endDate}</span>
      </div>
      <div className="mt-1 flex items-center justify-between text-xs text-[#A8B3C2]">
        <span className="tabular-nums">{progressPct.toFixed(1)}% complete</span>
        <span className="tabular-nums">{fmt(remainingGoalDays)} days left</span>
      </div>
    </section>
  );
}
