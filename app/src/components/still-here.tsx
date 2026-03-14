"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
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
  Save,
  Trash2,
  Info,
  PenLine,
  Heart,
} from "lucide-react";
import { regions, getRegionById } from "@/lib/life-data";
import { calculateLifeStats } from "@/lib/calculator";

// ---------------------------------------------------------------------------

interface JournalEntry {
  id: string;
  date: string;
  dayNumber: number;
  title: string;
  body: string;
  createdAt: number;
}

interface Settings {
  birthdate: string;
  regionId: string;
  customLifeExpectancy: string;
  ageAdjusted: boolean;
}

const STORAGE_KEYS = {
  settings: "still-here-settings",
  entries: "still-here-entries",
} as const;

const DEFAULT_SETTINGS: Settings = {
  birthdate: "",
  regionId: "world",
  customLifeExpectancy: "73",
  ageAdjusted: true,
};

function fmt(n: number): string {
  return new Intl.NumberFormat().format(n);
}

// ---------------------------------------------------------------------------

export default function StillHere() {
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [entries, setEntries] = useState<JournalEntry[]>([]);
  const [journalTitle, setJournalTitle] = useState("");
  const [journalBody, setJournalBody] = useState("");
  const [mounted, setMounted] = useState(false);

  /* ---- hydrate from localStorage ---- */
  useEffect(() => {
    try {
      const s = localStorage.getItem(STORAGE_KEYS.settings);
      if (s) setSettings(JSON.parse(s));
      const e = localStorage.getItem(STORAGE_KEYS.entries);
      if (e) setEntries(JSON.parse(e));
    } catch {
      /* corrupt data – use defaults */
    }
    setMounted(true);
  }, []);

  /* ---- persist ---- */
  useEffect(() => {
    if (mounted) localStorage.setItem(STORAGE_KEYS.settings, JSON.stringify(settings));
  }, [settings, mounted]);

  useEffect(() => {
    if (mounted) localStorage.setItem(STORAGE_KEYS.entries, JSON.stringify(entries));
  }, [entries, mounted]);

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

  const saveEntry = useCallback(() => {
    if (!stats || !journalBody.trim()) return;
    setEntries((prev) => [
      {
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
        date: stats.todayLabel,
        dayNumber: stats.daysAlive,
        title: journalTitle.trim() || "Untitled",
        body: journalBody.trim(),
        createdAt: Date.now(),
      },
      ...prev,
    ]);
    setJournalTitle("");
    setJournalBody("");
  }, [stats, journalTitle, journalBody]);

  const deleteEntry = useCallback(
    (id: string) => setEntries((prev) => prev.filter((e) => e.id !== id)),
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
            <LifeGrid
              daysAlive={stats.daysAlive}
              totalDays={stats.totalDays}
              progress={stats.progress}
            />
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

          {/* ============ SETTINGS + JOURNAL ============ */}
          <div className={`mt-10 grid gap-6 ${stats ? "md:grid-cols-2" : "mx-auto max-w-md"}`}>
            {/* ---------- clock settings ---------- */}
            <Card className="rounded-2xl border-stone-200/60 shadow-sm">
              <CardHeader className="pb-4">
                <CardTitle className="text-lg font-semibold text-stone-800">Your clock</CardTitle>
              </CardHeader>
              <CardContent className="space-y-5">
                <Field label="Birth date">
                  <Input
                    type="date"
                    value={settings.birthdate}
                    onChange={(e) => set("birthdate", e.target.value)}
                    className="rounded-xl"
                  />
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
                      v={
                        `${stats.expectedLifespan} years` +
                        (settings.ageAdjusted ? " (adjusted)" : "")
                      }
                    />
                    <Row k="Estimated total days" v={fmt(stats.totalDays)} />
                  </div>
                )}
              </CardContent>
            </Card>

            {/* ---------- journal ---------- */}
            {stats && (
              <Card className="rounded-2xl border-stone-200/60 shadow-sm">
                <CardHeader className="pb-4">
                  <CardTitle className="flex items-center gap-2 text-lg font-semibold text-stone-800">
                    <PenLine className="h-4 w-4" />
                    Day {fmt(stats.daysAlive)}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <Field label="Title">
                    <Input
                      value={journalTitle}
                      onChange={(e) => setJournalTitle(e.target.value)}
                      placeholder="What matters today?"
                      className="rounded-xl"
                    />
                  </Field>
                  <Field label="Entry">
                    <Textarea
                      value={journalBody}
                      onChange={(e) => setJournalBody(e.target.value)}
                      placeholder="What will you do with this day?"
                      className="min-h-[180px] resize-none rounded-xl"
                    />
                  </Field>
                  <Button
                    onClick={saveEntry}
                    disabled={!journalBody.trim()}
                    className="rounded-xl"
                  >
                    <Save className="mr-2 h-4 w-4" />
                    Save entry
                  </Button>
                </CardContent>
              </Card>
            )}
          </div>

          {/* ============ PAST ENTRIES ============ */}
          {entries.length > 0 && (
            <section className="mt-14">
              <h2 className="text-lg font-semibold text-stone-800">Past entries</h2>
              <div className="mt-4 space-y-3">
                {entries.map((item) => (
                  <div
                    key={item.id}
                    className="group relative rounded-2xl border border-stone-100 bg-white p-5 shadow-sm transition-shadow hover:shadow-md"
                  >
                    <div className="flex items-center gap-3">
                      <Badge variant="secondary" className="rounded-full text-xs tabular-nums">
                        Day {fmt(item.dayNumber)}
                      </Badge>
                      <span className="text-sm text-stone-400">{item.date}</span>
                      <button
                        onClick={() => deleteEntry(item.id)}
                        className="ml-auto rounded-lg p-1.5 text-stone-300 opacity-0 transition-opacity hover:bg-stone-100 hover:text-stone-500 group-hover:opacity-100"
                        aria-label="Delete entry"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                    <h3 className="mt-3 font-semibold text-stone-800">{item.title}</h3>
                    <p className="mt-1.5 whitespace-pre-wrap text-sm leading-relaxed text-stone-600">
                      {item.body}
                    </p>
                  </div>
                ))}
              </div>
            </section>
          )}

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

function LifeGrid({
  daysAlive,
  totalDays,
  progress,
}: {
  daysAlive: number;
  totalDays: number;
  progress: number;
}) {
  const weeksLived = Math.floor(daysAlive / 7);
  const totalWeeks = Math.ceil(totalDays / 7);
  const cols = 52;
  const rows = Math.ceil(totalWeeks / cols);

  return (
    <div className="mt-12">
      <div className="space-y-[2px]">
        {Array.from({ length: rows }, (_, row) => {
          const showLabel = row % 10 === 0;
          const cellCount = Math.min(cols, totalWeeks - row * cols);
          return (
            <div key={row} className="flex items-center gap-[2px]">
              <span
                className={`w-5 shrink-0 pr-1 text-right font-mono text-[8px] tabular-nums sm:w-6 sm:text-[9px] ${
                  showLabel ? "text-stone-400" : "text-transparent select-none"
                }`}
              >
                {row}
              </span>
              <div className="flex flex-1 justify-between">
                {Array.from({ length: cellCount }, (_, col) => {
                  const idx = row * cols + col;
                  const lived = idx < weeksLived;
                  const current = idx === weeksLived;
                  return (
                    <div
                      key={col}
                      className={`aspect-square w-full max-w-[6px] rounded-full sm:max-w-[8px] ${
                        lived
                          ? "bg-amber-400"
                          : current
                            ? "bg-orange-500"
                            : "bg-stone-200"
                      }`}
                    />
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      <div className="mt-4 flex flex-wrap items-center justify-center gap-x-5 gap-y-1 text-[10px] text-stone-400">
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-2 w-2 rounded-full bg-amber-400" />
          weeks lived
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-2 w-2 rounded-full bg-orange-500" />
          this week
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-2 w-2 rounded-full bg-stone-200" />
          remaining
        </span>
        <span className="tabular-nums">{progress.toFixed(1)}%</span>
      </div>
    </div>
  );
}
