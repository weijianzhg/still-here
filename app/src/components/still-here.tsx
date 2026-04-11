"use client";

import { useState, useEffect, useMemo, useCallback, useId, useRef } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Separator } from "@/components/ui/separator";
import {
  CalendarDays,
  Hourglass,
  Clock,
  Info,
  Heart,
  Flag,
  Settings,
} from "lucide-react";
import { regions, getRegionById } from "@/lib/life-data";
import { calculateGoalProgress, calculateLifeStats } from "@/lib/calculator";

// ---------------------------------------------------------------------------

interface Settings {
  birthdate: string;
  regionId: string;
  customLifeExpectancy: string;
  ageAdjusted: boolean;
  goalTitle: string;
  goalStartDate: string;
  goalEndDate: string;
}

const STORAGE_KEY = "still-here-settings";

const DEFAULT_SETTINGS: Settings = {
  birthdate: "",
  regionId: "world",
  customLifeExpectancy: "73",
  ageAdjusted: true,
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

/** Returns YYYY-MM-DD or null if incomplete / invalid calendar date. */
function isoFromParts(y: string, m: string, d: string): string | null {
  if (y.length !== 4 || !/^\d{4}$/.test(y)) return null;
  if (!m || !d) return null;
  const yi = parseInt(y, 10);
  const mi = parseInt(m, 10);
  const di = parseInt(d, 10);
  if (isNaN(mi) || mi < 1 || mi > 12) return null;
  if (isNaN(di) || di < 1 || di > 31) return null;
  const dt = new Date(yi, mi - 1, di);
  if (dt.getFullYear() !== yi || dt.getMonth() !== mi - 1 || dt.getDate() !== di) return null;
  return `${y}-${String(mi).padStart(2, "0")}-${String(di).padStart(2, "0")}`;
}

function parseIsoToParts(s: string): { y: string; m: string; d: string } {
  if (!s || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return { y: "", m: "", d: "" };
  const [y, m, d] = s.split("-");
  return { y: y ?? "", m: m ?? "", d: d ?? "" };
}

function parseIsoDate(s: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return null;
  const d = new Date(`${s}T00:00:00`);
  if (isNaN(d.getTime())) return null;
  return d;
}

/** Short beat after the date is complete before committing (main UI transition). */
const BIRTHDATE_COMMIT_DELAY_MS = 420;

function BirthDateFields({
  value,
  onChange,
}: {
  value: string;
  onChange: (iso: string) => void;
}) {
  const baseId = useId();
  const ids = {
    y: `${baseId}-y`,
    m: `${baseId}-m`,
    d: `${baseId}-d`,
  };

  const [y, setY] = useState(() => parseIsoToParts(value).y);
  const [m, setM] = useState(() => parseIsoToParts(value).m);
  const [d, setD] = useState(() => parseIsoToParts(value).d);

  const [prevValue, setPrevValue] = useState(value);
  if (value !== prevValue) {
    setPrevValue(value);
    const p = parseIsoToParts(value);
    setY(p.y);
    setM(p.m);
    setD(p.d);
  }

  const commitTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearCommitTimer = useCallback(() => {
    if (commitTimerRef.current) {
      clearTimeout(commitTimerRef.current);
      commitTimerRef.current = null;
    }
  }, []);

  useEffect(() => () => clearCommitTimer(), [clearCommitTimer]);

  const flushCommit = useCallback(
    (sy: string, sm: string, sd: string) => {
      clearCommitTimer();
      const y0 = sy.trim();
      const m0 = sm.trim();
      const d0 = sd.trim();
      if (!y0 && !m0 && !d0) {
        onChange("");
        return;
      }
      const iso = isoFromParts(y0, m0, d0);
      if (iso) onChange(iso);
    },
    [onChange, clearCommitTimer],
  );

  const maybeCommit = useCallback(
    (ny: string, nm: string, nd: string) => {
      const sy = ny.trim();
      const sm = nm.trim();
      const sd = nd.trim();
      if (!sy && !sm && !sd) {
        clearCommitTimer();
        onChange("");
        return;
      }
      const iso = isoFromParts(sy, sm, sd);
      if (iso) {
        clearCommitTimer();
        commitTimerRef.current = setTimeout(() => {
          commitTimerRef.current = null;
          onChange(iso);
        }, BIRTHDATE_COMMIT_DELAY_MS);
      } else {
        clearCommitTimer();
      }
    },
    [onChange, clearCommitTimer],
  );

  const padMonth = (s: string) => {
    const n = parseInt(s, 10);
    if (isNaN(n) || n < 1 || n > 12) return s;
    return String(n).padStart(2, "0");
  };

  const padDay = (s: string) => {
    const n = parseInt(s, 10);
    if (isNaN(n) || n < 1 || n > 31) return s;
    return String(n).padStart(2, "0");
  };

  const invalid =
    !!(y || m || d) &&
    y.length === 4 &&
    m.length > 0 &&
    d.length > 0 &&
    !isoFromParts(y.trim(), m.trim(), d.trim());

  const digitField = (raw: string, maxLen: number) => raw.replace(/\D/g, "").slice(0, maxLen);

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2 sm:gap-3">
        <div className="min-w-0 flex-1 space-y-1">
          <Input
            id={ids.y}
            inputMode="numeric"
            autoComplete="bday-year"
            placeholder="YYYY"
            value={y}
            onChange={(e) => {
              const next = digitField(e.target.value, 4);
              setY(next);
              maybeCommit(next, m, d);
              if (next.length === 4) document.getElementById(ids.m)?.focus();
            }}
            onBlur={() => {
              const py = y.trim();
              if (py.length > 0 && py.length < 4) return;
              if (py.length === 4) {
                flushCommit(py, m, d);
              }
            }}
            onPaste={(e) => {
              const text = e.clipboardData.getData("text").trim();
              const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(text);
              if (match) {
                e.preventDefault();
                const [, py, pm, pd] = match;
                setY(py);
                setM(pm);
                setD(pd);
                maybeCommit(py, pm, pd);
              }
            }}
            aria-invalid={invalid}
            className="rounded-xl text-center tabular-nums tracking-wide"
          />
          <p className="text-center text-[0.65rem] text-[#6B7A8D]">Year</p>
        </div>
        <span className="pb-5 text-[#6B7A8D] select-none" aria-hidden>
          /
        </span>
        <div className="min-w-0 flex-1 space-y-1">
          <Input
            id={ids.m}
            inputMode="numeric"
            autoComplete="bday-month"
            placeholder="MM"
            value={m}
            onChange={(e) => {
              const next = digitField(e.target.value, 2);
              setM(next);
              maybeCommit(y, next, d);
              if (next.length === 2) document.getElementById(ids.d)?.focus();
            }}
            onBlur={() => {
              const pm = padMonth(m.trim());
              if (pm !== m) setM(pm);
              flushCommit(y, pm, d);
            }}
            aria-invalid={invalid}
            className="rounded-xl text-center tabular-nums tracking-wide"
          />
          <p className="text-center text-[0.65rem] text-[#6B7A8D]">Month</p>
        </div>
        <span className="pb-5 text-[#6B7A8D] select-none" aria-hidden>
          /
        </span>
        <div className="min-w-0 flex-1 space-y-1">
          <Input
            id={ids.d}
            inputMode="numeric"
            autoComplete="bday-day"
            placeholder="DD"
            value={d}
            onChange={(e) => {
              const next = digitField(e.target.value, 2);
              setD(next);
              maybeCommit(y, m, next);
            }}
            onBlur={() => {
              const pd = padDay(d.trim());
              if (pd !== d) setD(pd);
              flushCommit(y, m, pd);
            }}
            aria-invalid={invalid}
            className="rounded-xl text-center tabular-nums tracking-wide"
          />
          <p className="text-center text-[0.65rem] text-[#6B7A8D]">Day</p>
        </div>
      </div>
      <p className="text-xs text-[#6B7A8D]">
        <span className="tabular-nums">YYYY–MM–DD</span>
        <span className="text-[#6B7A8D]"> · </span>
        Tab between fields
      </p>
    </div>
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
    return calculateLifeStats(birth, lifeExpectancy, settings.ageAdjusted);
  }, [settings.birthdate, lifeExpectancy, settings.ageAdjusted]);

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
    <TooltipProvider>
      <div className="min-h-screen bg-gradient-to-b from-[#0B0D10] via-[#11151A] to-[#171C22]">
        {/* ============ TOP LEFT GOAL SETUP ============ */}
        <div className="absolute top-4 left-4">
          <button
            onClick={() => setShowGoalSetup((v) => !v)}
            className="flex items-center gap-1.5 text-xs text-[#A8B3C2] hover:text-[#EEF2FF] transition-colors"
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
              className="flex items-center gap-1.5 text-xs text-[#A8B3C2] hover:text-[#EEF2FF] transition-colors"
            >
              <Settings className="h-4 w-4" />
            </button>
          </div>
        )}

        {/* ============ HERO ============ */}
        <header className="mx-auto max-w-4xl px-4 pt-16 text-center sm:px-6 lg:px-8">
          <p className="text-[0.65rem] font-semibold uppercase tracking-[0.35em] text-[#A8B3C2]">
            Still Here
          </p>

          {stats ? (
            <>
              <h1 className="mt-5 text-7xl font-bold tabular-nums tracking-tight text-[#F3F5F7] sm:text-9xl">
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
            <LifeGrid daysAlive={stats.daysAlive} totalDays={stats.totalDays} />
          </div>
        )}

        <div className="mx-auto max-w-4xl px-4 pb-16 sm:px-6 lg:px-8">
          {/* ============ STATS GRID ============ */}
          {stats && (
            <div className="mt-12 grid grid-cols-2 gap-3 sm:grid-cols-4 sm:gap-4">
              <Stat icon={<CalendarDays className="h-3.5 w-3.5" />} label="Days lived" value={fmt(stats.daysAlive)} />
              <Stat icon={<Hourglass className="h-3.5 w-3.5" />} label="Days remaining" value={fmt(stats.daysRemaining)} />
              <Stat icon={<Clock className="h-3.5 w-3.5" />} label="Weeks remaining" value={fmt(stats.weeksRemaining)} />
              <Stat icon={<Heart className="h-3.5 w-3.5" />} label="Years remaining" value={stats.remainingYears.toFixed(1)} />
            </div>
          )}

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
                />
              ) : goalDateRangeInvalid ? (
                <p className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                  Goal timeline not shown because end date is before start date.
                </p>
              ) : (
                <p className="rounded-xl border border-[#27303A] bg-[#11151A] px-4 py-3 text-sm text-[#A8B3C2]">
                  Add a valid start and end date in the goal section to show your timeline.
                </p>
              )}
            </div>
          )}

          {/* ============ SETTINGS DIALOG ============ */}
          {!stats && (
            <div className="mt-10 mx-auto max-w-md">
              <SettingsCard settings={settings} stats={stats} set={set} />
            </div>
          )}
          <Dialog open={!!stats && showSettings} onOpenChange={setShowSettings}>
            <DialogContent className="max-w-md rounded-2xl border-[#27303A] bg-[#11151A] text-[#F3F5F7]">
              <DialogHeader>
                <DialogTitle className="text-lg font-semibold text-[#F3F5F7]">Your clock</DialogTitle>
              </DialogHeader>
              <SettingsCard settings={settings} stats={stats} set={set} />
            </DialogContent>
          </Dialog>
          <Dialog open={showGoalSetup} onOpenChange={setShowGoalSetup}>
            <DialogContent className="max-w-md rounded-2xl border-[#27303A] bg-[#11151A] text-[#F3F5F7]">
              <DialogHeader>
                <DialogTitle className="text-lg font-semibold text-[#F3F5F7]">
                  Goal timeline
                </DialogTitle>
              </DialogHeader>
              <GoalSetupCard settings={settings} set={set} />
            </DialogContent>
          </Dialog>

          {/* ============ FOOTER ============ */}
          <footer className="mt-20 text-center">
            <Separator className="mb-8" />
            <p className="text-xs italic text-[#6B7A8D]">
              This is not prophecy. It is a memento mori with better UI.
            </p>
          </footer>
        </div>
      </div>
    </TooltipProvider>
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
            className="h-11 w-full min-w-0 justify-between gap-3 rounded-xl border-[#27303A] bg-[#171C22] px-4 py-2 text-left text-sm font-medium text-[#F3F5F7] shadow-sm hover:bg-[#1E242C] data-placeholder:text-[#6B7A8D] [&_svg]:shrink-0 [&_svg]:text-[#A8B3C2]"
          >
            <SelectValue placeholder="Choose region" />
          </SelectTrigger>
          <SelectContent
            align="start"
            alignItemWithTrigger={false}
            side="bottom"
            sideOffset={6}
            className="max-h-[min(17rem,50dvh)] rounded-xl border-[#27303A] bg-[#11151A] p-1 shadow-lg ring-1 ring-[#27303A]"
          >
            {regions.map((r) => (
              <SelectItem
                key={r.id}
                value={r.id}
                className="rounded-lg py-2.5 pl-3 text-[#F3F5F7] transition-colors hover:bg-[#1E242C] hover:text-[#EEF2FF] data-[highlighted]:bg-[#1E1B4B] data-[highlighted]:text-[#EEF2FF]"
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
            className="rounded-xl"
          />
        </Field>
      )}

      <div className="flex items-center justify-between gap-3 rounded-xl border border-[#27303A] bg-[#171C22] px-4 py-3">
        <div className="flex items-center gap-2">
          <Label htmlFor="age-adj" className="text-sm font-medium text-[#F3F5F7]">
            Age-adjusted
          </Label>
          <Tooltip>
            <TooltipTrigger className="cursor-help">
              <Info className="h-3.5 w-3.5 text-[#A8B3C2]" />
            </TooltipTrigger>
            <TooltipContent side="top" className="max-w-[260px] text-xs leading-relaxed">
              Uses conditional survival: since you already survived to your current age,
              your expected remaining lifespan is slightly higher than the birth average.
            </TooltipContent>
          </Tooltip>
        </div>
        <Switch
          id="age-adj"
          checked={settings.ageAdjusted}
          onCheckedChange={(v) => set("ageAdjusted", v)}
          className="h-6 w-11 border-[#27303A] data-checked:bg-[#4F46E5] data-unchecked:bg-[#1E242C] focus-visible:ring-[#6366F1]/50"
        />
      </div>

      {stats && (
        <div className="space-y-1 rounded-xl border border-[#27303A] bg-[#171C22] p-4 text-sm">
          <Row k="Current age" v={`${stats.currentAge.toFixed(1)} years`} />
          <Row
            k="Expected lifespan"
            v={`${stats.expectedLifespan} years` + (settings.ageAdjusted ? " (adjusted)" : "")}
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
}: {
  settings: Settings;
  set: (key: keyof Settings, value: string | boolean) => void;
}) {
  const goalStart = parseIsoDate(settings.goalStartDate);
  const goalEnd = parseIsoDate(settings.goalEndDate);
  const invalidGoalRange =
    !!goalStart && !!goalEnd && goalEnd.getTime() < goalStart.getTime();

  return (
    <section className="space-y-5 rounded-2xl border border-[#27303A] bg-[#11151A] p-4 shadow-sm sm:p-5">
      <p className="text-sm font-medium text-[#F3F5F7]">Goal setup</p>

      <Field label="Goal name (optional)">
        <Input
          value={settings.goalTitle}
          onChange={(e) => set("goalTitle", e.target.value)}
          placeholder="Example: Finish project alpha"
          className="rounded-xl"
        />
      </Field>

      <Field label="Start date">
        <BirthDateFields value={settings.goalStartDate} onChange={(iso) => set("goalStartDate", iso)} />
      </Field>

      <Field label="End date">
        <BirthDateFields value={settings.goalEndDate} onChange={(iso) => set("goalEndDate", iso)} />
      </Field>

      {settings.goalStartDate && !settings.goalEndDate && (
        <p className="rounded-xl border border-[#27303A] bg-[#171C22] px-4 py-3 text-xs text-[#A8B3C2]">
          Pick an end date to start tracking daily X marks.
        </p>
      )}

      {!settings.goalStartDate && settings.goalEndDate && (
        <p className="rounded-xl border border-[#27303A] bg-[#171C22] px-4 py-3 text-xs text-[#A8B3C2]">
          Add a start date before the end date.
        </p>
      )}

      {invalidGoalRange && (
        <p className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-xs text-rose-700">
          End date must be on or after start date.
        </p>
      )}
    </section>
  );
}

function Stat({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-[#27303A] bg-[#11151A] p-4 text-center shadow-sm sm:p-5">
      <p className="text-2xl font-semibold tabular-nums text-[#F3F5F7] sm:text-3xl">{value}</p>
      <div className="mt-1.5 flex items-center justify-center gap-1.5 text-[0.7rem] text-[#A8B3C2]">
        {icon}
        <span>{label}</span>
      </div>
    </div>
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

function LifeGrid({ daysAlive, totalDays }: { daysAlive: number; totalDays: number }) {
  const totalWeeks = Math.ceil(totalDays / 7);
  const weeksLived = Math.floor(daysAlive / 7);

  return (
    <div className="mt-12">
      <div className="flex flex-wrap gap-[3px]">
        {Array.from({ length: totalWeeks }, (_, i) => (
          <div
            key={i}
            className={`h-2 w-2 rounded-full ${i < weeksLived ? "bg-[#6366F1]" : "bg-[#27303A]"}`}
          />
        ))}
      </div>
      <div className="mt-2 flex justify-between text-[10px] text-[#6B7A8D]">
        <span>birth</span>
        <span className="tabular-nums">{((weeksLived / totalWeeks) * 100).toFixed(1)}% lived</span>
        <span>end</span>
      </div>
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
}: {
  title: string;
  startDate: string;
  endDate: string;
  elapsedGoalDays: number;
  totalGoalDays: number;
  remainingGoalDays: number;
  progressPct: number;
}) {
  const todayLabel = new Date().toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });

  return (
    <section className="rounded-2xl border border-[#27303A] bg-[#11151A] p-4 shadow-sm sm:p-5">
      <div className="mb-3 flex items-center justify-between gap-3">
        <p className="truncate text-sm font-medium text-[#F3F5F7]">
          {title.trim() || "Goal timeline"}
        </p>
        <p className="shrink-0 text-xs tabular-nums text-[#A8B3C2]">
          {fmt(elapsedGoalDays)} / {fmt(totalGoalDays)} days
        </p>
      </div>

      <div className="flex flex-wrap gap-1 rounded-xl bg-[#171C22] p-2">
        {Array.from({ length: totalGoalDays }, (_, i) => (
          <span
            key={i}
            className={`flex h-4 w-4 items-center justify-center rounded text-[10px] font-semibold tabular-nums ${
              i < elapsedGoalDays ? "bg-[#1E1B4B] text-[#C7D2FE]" : "bg-[#11151A] text-[#6B7A8D]"
            }`}
          >
            {i < elapsedGoalDays ? "X" : ""}
          </span>
        ))}
      </div>

      <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-[11px] text-[#A8B3C2]">
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
