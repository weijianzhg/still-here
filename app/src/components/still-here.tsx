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
  Settings,
} from "lucide-react";
import { regions, getRegionById } from "@/lib/life-data";
import { calculateLifeStats } from "@/lib/calculator";

// ---------------------------------------------------------------------------

interface Settings {
  birthdate: string;
  regionId: string;
  customLifeExpectancy: string;
  ageAdjusted: boolean;
}

const STORAGE_KEY = "still-here-settings";

const DEFAULT_SETTINGS: Settings = {
  birthdate: "",
  regionId: "world",
  customLifeExpectancy: "73",
  ageAdjusted: true,
};

function fmt(n: number): string {
  return new Intl.NumberFormat().format(n);
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
          <p className="text-center text-[0.65rem] text-stone-400">Year</p>
        </div>
        <span className="pb-5 text-stone-300 select-none" aria-hidden>
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
          <p className="text-center text-[0.65rem] text-stone-400">Month</p>
        </div>
        <span className="pb-5 text-stone-300 select-none" aria-hidden>
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
          <p className="text-center text-[0.65rem] text-stone-400">Day</p>
        </div>
      </div>
      <p className="text-xs text-stone-400">
        <span className="tabular-nums">YYYY–MM–DD</span>
        <span className="text-stone-300"> · </span>
        Tab between fields
      </p>
    </div>
  );
}

// ---------------------------------------------------------------------------

export default function StillHere() {
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [showSettings, setShowSettings] = useState(false);
  const [mounted, setMounted] = useState(false);

  /* ---- hydrate from localStorage ---- */
  useEffect(() => {
    try {
      const s = localStorage.getItem(STORAGE_KEY);
      if (s) queueMicrotask(() => setSettings(JSON.parse(s)));
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

  /* ---- actions ---- */
  const set = useCallback(
    (key: keyof Settings, value: string | boolean) =>
      setSettings((prev) => ({ ...prev, [key]: value })),
    [],
  );

  /* ---- loading guard (avoids SSR/client mismatch) ---- */
  if (!mounted) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-stone-50">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-stone-300 border-t-stone-600" />
      </div>
    );
  }

  // -----------------------------------------------------------------------
  return (
    <TooltipProvider>
      <div className="min-h-screen bg-gradient-to-b from-stone-50 via-orange-50/30 to-stone-100">
        {/* ============ TOP RIGHT SETTINGS ============ */}
        {stats && (
          <div className="absolute top-4 right-4">
            <button
              onClick={() => setShowSettings((v) => !v)}
              className="flex items-center gap-1.5 text-xs text-stone-400 hover:text-stone-600 transition-colors"
            >
              <Settings className="h-4 w-4" />
            </button>
          </div>
        )}

        {/* ============ HERO ============ */}
        <header className="mx-auto max-w-4xl px-4 pt-16 text-center sm:px-6 lg:px-8">
          <p className="text-[0.65rem] font-semibold uppercase tracking-[0.35em] text-stone-400">
            Still Here
          </p>

          {stats ? (
            <>
              <h1 className="mt-5 text-7xl font-bold tabular-nums tracking-tight text-stone-900 sm:text-9xl">
                {fmt(stats.daysRemaining)}
              </h1>
              <p className="mt-2 text-base text-stone-500">
                days remaining&ensp;&middot;&ensp;{stats.todayLabel}
              </p>
            </>
          ) : (
            <>
              <h1 className="mt-6 text-5xl font-bold tracking-tight text-stone-800 sm:text-7xl">
                Hello
              </h1>
              <p className="mx-auto mt-3 max-w-md text-lg leading-relaxed text-stone-500">
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

          {/* ============ SETTINGS DIALOG ============ */}
          {!stats && (
            <div className="mt-10 mx-auto max-w-md">
              <SettingsCard settings={settings} stats={stats} set={set} />
            </div>
          )}
          <Dialog open={!!stats && showSettings} onOpenChange={setShowSettings}>
            <DialogContent className="max-w-md rounded-2xl">
              <DialogHeader>
                <DialogTitle className="text-lg font-semibold text-stone-800">Your clock</DialogTitle>
              </DialogHeader>
              <SettingsCard settings={settings} stats={stats} set={set} />
            </DialogContent>
          </Dialog>

          {/* ============ FOOTER ============ */}
          <footer className="mt-20 text-center">
            <Separator className="mb-8" />
            <p className="text-xs italic text-stone-400">
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
          <SelectTrigger className="rounded-xl">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {regions.map((r) => (
              <SelectItem key={r.id} value={r.id}>
                {r.name}
                {r.lifeExpectancy > 0 && (
                  <span className="ml-1 text-muted-foreground">{r.lifeExpectancy}y</span>
                )}
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

      <div className="flex items-center justify-between gap-3 rounded-xl bg-stone-50 px-4 py-3">
        <div className="flex items-center gap-2">
          <Label htmlFor="age-adj" className="text-sm font-medium text-stone-700">
            Age-adjusted
          </Label>
          <Tooltip>
            <TooltipTrigger className="cursor-help">
              <Info className="h-3.5 w-3.5 text-stone-400" />
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
        />
      </div>

      {stats && (
        <div className="space-y-1 rounded-xl border border-stone-100 bg-stone-50/50 p-4 text-sm">
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

function Stat({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="rounded-2xl bg-white p-4 text-center shadow-sm sm:p-5">
      <p className="text-2xl font-semibold tabular-nums text-stone-900 sm:text-3xl">{value}</p>
      <div className="mt-1.5 flex items-center justify-center gap-1.5 text-[0.7rem] text-stone-400">
        {icon}
        <span>{label}</span>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <Label className="text-sm text-stone-600">{label}</Label>
      {children}
    </div>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <p className="text-stone-600">
      <span className="text-stone-400">{k}:</span>{" "}
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
            className={`h-2 w-2 rounded-full ${i < weeksLived ? "bg-amber-400" : "bg-stone-200"}`}
          />
        ))}
      </div>
      <div className="mt-2 flex justify-between text-[10px] text-stone-400">
        <span>birth</span>
        <span className="tabular-nums">{((weeksLived / totalWeeks) * 100).toFixed(1)}% lived</span>
        <span>end</span>
      </div>
    </div>
  );
}
