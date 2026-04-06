"use client";

import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type FormEvent,
  type ReactNode,
} from "react";
import type { User } from "@supabase/supabase-js";
import {
  AlertCircle,
  CalendarDays,
  Check,
  Clock,
  Cloud,
  Database,
  Heart,
  Hourglass,
  Info,
  LoaderCircle,
  LogIn,
  LogOut,
  Plus,
  Settings,
  Target,
  Trash2,
  TrendingUp,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { calculateLifeStats } from "@/lib/calculator";
import {
  addDays,
  compareIsoDates,
  createGoal,
  getGoalMetrics,
  getTodayIso,
  isDateWithinRange,
  isValidIsoDate,
  normalizeGoals,
  sortGoals,
  toggleGoalCheckIn,
  type Goal,
} from "@/lib/goals";
import { getRegionById, regions } from "@/lib/life-data";
import {
  GOALS_STORAGE_KEY,
  SETTINGS_STORAGE_KEY,
  normalizeSettings,
  settingsWithGeoSuggestion,
  type Settings as SettingsModel,
} from "@/lib/still-here-model";
import { fetchRemoteSnapshot, saveRemoteSnapshot, deleteRemoteGoal } from "@/lib/supabase/app-sync";
import { getSupabaseBrowserClient, getSupabaseConfig } from "@/lib/supabase/client";

type Settings = SettingsModel;
type SyncStatus = "idle" | "loading" | "saving" | "saved" | "error";
type AuthMode = "sign-in" | "sign-up";

interface GoalDraft {
  title: string;
  notes: string;
  startDate: string;
  endDate: string;
}

const BIRTHDATE_COMMIT_DELAY_MS = 420;

function fmt(n: number): string {
  return new Intl.NumberFormat().format(n);
}

function formatShortDate(isoDate: string): string {
  return new Date(`${isoDate}T00:00:00`).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
}

function createGoalDraft(): GoalDraft {
  const today = getTodayIso();
  return {
    title: "",
    notes: "",
    startDate: today,
    endDate: addDays(today, 29),
  };
}

function serializeSnapshot(settings: Settings, goals: Goal[]): string {
  const normalizedGoals = [...goals]
    .sort(sortGoals)
    .map((goal) => ({
      ...goal,
      checkIns: [...goal.checkIns].sort(compareIsoDates),
    }));

  return JSON.stringify({ settings, goals: normalizedGoals });
}

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  return "Something went wrong. Please try again.";
}

/** Returns YYYY-MM-DD or null if incomplete / invalid calendar date. */
function isoFromParts(y: string, m: string, d: string): string | null {
  if (y.length !== 4 || !/^\d{4}$/.test(y)) return null;
  if (!m || !d) return null;
  const yi = Number.parseInt(y, 10);
  const mi = Number.parseInt(m, 10);
  const di = Number.parseInt(d, 10);
  if (Number.isNaN(mi) || mi < 1 || mi > 12) return null;
  if (Number.isNaN(di) || di < 1 || di > 31) return null;
  const dt = new Date(yi, mi - 1, di);
  if (dt.getFullYear() !== yi || dt.getMonth() !== mi - 1 || dt.getDate() !== di) return null;
  return `${y}-${String(mi).padStart(2, "0")}-${String(di).padStart(2, "0")}`;
}

function parseIsoToParts(s: string): { y: string; m: string; d: string } {
  if (!s || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return { y: "", m: "", d: "" };
  const [y, m, d] = s.split("-");
  return { y: y ?? "", m: m ?? "", d: d ?? "" };
}

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
    const parts = parseIsoToParts(value);
    setY(parts.y);
    setM(parts.m);
    setD(parts.d);
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
    [clearCommitTimer, onChange],
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
    [clearCommitTimer, onChange],
  );

  const padMonth = (raw: string) => {
    const n = Number.parseInt(raw, 10);
    if (Number.isNaN(n) || n < 1 || n > 12) return raw;
    return String(n).padStart(2, "0");
  };

  const padDay = (raw: string) => {
    const n = Number.parseInt(raw, 10);
    if (Number.isNaN(n) || n < 1 || n > 31) return raw;
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
            onChange={(event) => {
              const next = digitField(event.target.value, 4);
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
            onPaste={(event) => {
              const text = event.clipboardData.getData("text").trim();
              const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(text);
              if (match) {
                event.preventDefault();
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
        <span className="select-none pb-5 text-stone-300" aria-hidden>
          /
        </span>
        <div className="min-w-0 flex-1 space-y-1">
          <Input
            id={ids.m}
            inputMode="numeric"
            autoComplete="bday-month"
            placeholder="MM"
            value={m}
            onChange={(event) => {
              const next = digitField(event.target.value, 2);
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
        <span className="select-none pb-5 text-stone-300" aria-hidden>
          /
        </span>
        <div className="min-w-0 flex-1 space-y-1">
          <Input
            id={ids.d}
            inputMode="numeric"
            autoComplete="bday-day"
            placeholder="DD"
            value={d}
            onChange={(event) => {
              const next = digitField(event.target.value, 2);
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
        <span className="tabular-nums">YYYY-MM-DD</span>
        <span className="text-stone-300"> · </span>
        Tab between fields
      </p>
    </div>
  );
}

export default function StillHere({
  suggestedRegionId,
}: {
  suggestedRegionId?: string | null;
} = {}) {
  const [settings, setSettings] = useState<Settings>(() =>
    settingsWithGeoSuggestion(suggestedRegionId),
  );
  const [goals, setGoals] = useState<Goal[]>([]);
  const [goalDraft, setGoalDraft] = useState<GoalDraft>(() => createGoalDraft());
  const [goalError, setGoalError] = useState<string | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [mounted, setMounted] = useState(false);

  const [authMode, setAuthMode] = useState<AuthMode>("sign-in");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [authBusy, setAuthBusy] = useState(false);
  const [authReady, setAuthReady] = useState(false);
  const [authMessage, setAuthMessage] = useState<string | null>(null);
  const [authError, setAuthError] = useState<string | null>(null);
  const [user, setUser] = useState<User | null>(null);

  const [syncStatus, setSyncStatus] = useState<SyncStatus>("idle");
  const [syncMessage, setSyncMessage] = useState<string | null>(null);
  const [remoteReady, setRemoteReady] = useState(false);

  const settingsRef = useRef(settings);
  const goalsRef = useRef(goals);
  const lastSyncedSnapshotRef = useRef("");

  const supabaseConfig = useMemo(() => getSupabaseConfig(), []);
  const supabase = useMemo(() => getSupabaseBrowserClient(), []);
  const todayIso = getTodayIso();
  const snapshotKey = useMemo(() => serializeSnapshot(settings, goals), [settings, goals]);

  useEffect(() => {
    settingsRef.current = settings;
  }, [settings]);

  useEffect(() => {
    goalsRef.current = goals;
  }, [goals]);

  useEffect(() => {
    try {
      const savedSettings = localStorage.getItem(SETTINGS_STORAGE_KEY);
      if (savedSettings) {
        setSettings(normalizeSettings(JSON.parse(savedSettings), suggestedRegionId));
      }
    } catch {
      setSettings(settingsWithGeoSuggestion(suggestedRegionId));
    }

    try {
      const savedGoals = localStorage.getItem(GOALS_STORAGE_KEY);
      if (savedGoals) {
        setGoals(normalizeGoals(JSON.parse(savedGoals)));
      }
    } catch {
      setGoals([]);
    }

    setMounted(true);
  }, [suggestedRegionId]);

  useEffect(() => {
    if (!mounted) return;
    localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(settings));
  }, [mounted, settings]);

  useEffect(() => {
    if (!mounted) return;
    localStorage.setItem(GOALS_STORAGE_KEY, JSON.stringify(goals));
  }, [mounted, goals]);

  useEffect(() => {
    if (!supabase) {
      setAuthReady(true);
      return;
    }

    let active = true;

    void supabase.auth.getUser().then(({ data, error }) => {
      if (!active) return;
      if (error) {
        setAuthError(error.message);
      }
      setUser(data.user ?? null);
      setAuthReady(true);
    });

    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!active) return;
      setUser(session?.user ?? null);
      if (!session?.user) {
        setRemoteReady(false);
        setSyncStatus("idle");
        setSyncMessage("Signed out. Your latest edits still live on this device.");
      }
    });

    return () => {
      active = false;
      listener.subscription.unsubscribe();
    };
  }, [supabase]);

  useEffect(() => {
    if (!mounted || !supabase || !user) {
      return;
    }

    let cancelled = false;
    setSyncStatus("loading");
    setSyncMessage("Loading your synced data...");

    void (async () => {
      try {
        const snapshot = await fetchRemoteSnapshot(supabase);
        if (cancelled) return;

        const nextSettings = snapshot.settings ?? settingsRef.current;
        const nextGoals = snapshot.goals.length > 0 ? snapshot.goals : goalsRef.current;
        const shouldSeedSettings = !snapshot.settings;
        const shouldSeedGoals = snapshot.goals.length === 0;

        if (snapshot.settings) {
          setSettings(snapshot.settings);
        }
        if (snapshot.goals.length > 0 || goalsRef.current.length === 0) {
          setGoals(nextGoals);
        }

        if (shouldSeedSettings || shouldSeedGoals) {
          await saveRemoteSnapshot(supabase, user.id, nextSettings, nextGoals);
        }

        if (cancelled) return;
        lastSyncedSnapshotRef.current = serializeSnapshot(nextSettings, nextGoals);
        setRemoteReady(true);
        setSyncStatus("saved");
        setSyncMessage("Supabase is connected and your data is in sync.");
      } catch (error) {
        if (cancelled) return;
        setRemoteReady(true);
        setSyncStatus("error");
        setSyncMessage(getErrorMessage(error));
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [mounted, supabase, user]);

  useEffect(() => {
    if (!mounted || !remoteReady || !supabase || !user) {
      return;
    }
    if (snapshotKey === lastSyncedSnapshotRef.current) {
      return;
    }

    const timer = setTimeout(() => {
      void (async () => {
        try {
          setSyncStatus("saving");
          setSyncMessage("Saving to Supabase...");
          await saveRemoteSnapshot(supabase, user.id, settings, goals);
          lastSyncedSnapshotRef.current = snapshotKey;
          setSyncStatus("saved");
          setSyncMessage("All changes synced.");
        } catch (error) {
          setSyncStatus("error");
          setSyncMessage(getErrorMessage(error));
        }
      })();
    }, 600);

    return () => clearTimeout(timer);
  }, [goals, mounted, remoteReady, settings, snapshotKey, supabase, user]);

  const lifeExpectancy = useMemo(() => {
    if (settings.regionId === "custom") return Number.parseFloat(settings.customLifeExpectancy) || 0;
    return getRegionById(settings.regionId)?.lifeExpectancy ?? 73;
  }, [settings.customLifeExpectancy, settings.regionId]);

  const stats = useMemo(() => {
    if (!settings.birthdate) return null;
    const birth = new Date(`${settings.birthdate}T00:00:00`);
    return calculateLifeStats(birth, lifeExpectancy, settings.ageAdjusted);
  }, [lifeExpectancy, settings.ageAdjusted, settings.birthdate]);

  const setSetting = useCallback(
    (key: keyof Settings, value: string | boolean) =>
      setSettings((prev) => ({ ...prev, [key]: value })),
    [],
  );

  const handleAuthSubmit = useCallback(
    async (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      if (!supabase) {
        setAuthError("Add your Supabase environment variables to enable login.");
        return;
      }
      if (!email.trim() || !password.trim()) {
        setAuthError("Email and password are both required.");
        return;
      }

      setAuthBusy(true);
      setAuthError(null);
      setAuthMessage(null);

      try {
        if (authMode === "sign-up") {
          const { data, error } = await supabase.auth.signUp({
            email: email.trim(),
            password,
          });
          if (error) throw error;

          if (data.session) {
            setAuthMessage("Account created and signed in. Sync is starting now.");
          } else {
            setAuthMessage(
              "Account created. If email confirmation is enabled, check your inbox and then sign in.",
            );
          }
        } else {
          const { error } = await supabase.auth.signInWithPassword({
            email: email.trim(),
            password,
          });
          if (error) throw error;
          setAuthMessage("Signed in. Pulling your saved data now.");
        }

        setPassword("");
      } catch (error) {
        setAuthError(getErrorMessage(error));
      } finally {
        setAuthBusy(false);
      }
    },
    [authMode, email, password, supabase],
  );

  const handleSignOut = useCallback(async () => {
    if (!supabase) return;
    setAuthBusy(true);
    setAuthError(null);
    setAuthMessage(null);
    try {
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
      setAuthMessage("Signed out. You can keep using the planner locally.");
    } catch (error) {
      setAuthError(getErrorMessage(error));
    } finally {
      setAuthBusy(false);
    }
  }, [supabase]);

  const handleAddGoal = useCallback(
    (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      setGoalError(null);

      if (!goalDraft.title.trim()) {
        setGoalError("Give your plan a name.");
        return;
      }
      if (!isValidIsoDate(goalDraft.startDate) || !isValidIsoDate(goalDraft.endDate)) {
        setGoalError("Choose a valid start and end date.");
        return;
      }
      if (compareIsoDates(goalDraft.endDate, goalDraft.startDate) < 0) {
        setGoalError("Your end date needs to come after the start date.");
        return;
      }

      const goal = createGoal(goalDraft);
      setGoals((prev) => [...prev, goal].sort(sortGoals));
      setGoalDraft(createGoalDraft());
    },
    [goalDraft],
  );

  const handleToggleCheckIn = useCallback((goalId: string, isoDate: string) => {
    setGoals((prev) =>
      prev.map((goal) => (goal.id === goalId ? toggleGoalCheckIn(goal, isoDate) : goal)),
    );
  }, []);

  const handleDeleteGoal = useCallback(
    async (goalId: string) => {
      const goal = goals.find((item) => item.id === goalId);
      if (!goal) return;
      if (!window.confirm(`Delete "${goal.title}"?`)) return;

      try {
        if (supabase && user) {
          setSyncStatus("saving");
          setSyncMessage(`Deleting "${goal.title}"...`);
          await deleteRemoteGoal(supabase, goalId);
        }

        setGoals((prev) => prev.filter((item) => item.id !== goalId));
      } catch (error) {
        setSyncStatus("error");
        setSyncMessage(getErrorMessage(error));
      }
    },
    [goals, supabase, user],
  );

  if (!mounted) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-stone-50">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-stone-300 border-t-stone-600" />
      </div>
    );
  }

  return (
    <TooltipProvider>
      <div className="min-h-screen bg-gradient-to-b from-stone-50 via-orange-50/30 to-stone-100">
        {stats && (
          <div className="absolute top-4 right-4">
            <button
              onClick={() => setShowSettings((value) => !value)}
              className="flex items-center gap-1.5 text-xs text-stone-400 transition-colors hover:text-stone-600"
            >
              <Settings className="h-4 w-4" />
            </button>
          </div>
        )}

        <header className="mx-auto max-w-4xl px-4 pt-16 text-center sm:px-6 lg:px-8">
          <p className="text-[0.65rem] font-semibold uppercase tracking-[0.35em] text-stone-400">
            Still Here
          </p>

          {stats ? (
            <>
              <h1 className="mt-5 text-7xl font-bold tracking-tight text-stone-900 tabular-nums sm:text-9xl">
                {fmt(stats.daysRemaining)}
              </h1>
              <p className="mt-2 text-base text-stone-500">
                days remaining &middot; {stats.todayLabel}
              </p>
            </>
          ) : (
            <>
              <h1 className="mt-6 text-5xl font-bold tracking-tight text-stone-800 sm:text-7xl">
                Hello
              </h1>
              <p className="mx-auto mt-3 max-w-xl text-lg leading-relaxed text-stone-500">
                Count your days, run your own plans, and keep the checkmarks somewhere you will
                actually see them.
              </p>
            </>
          )}

          <div className="mt-6 flex flex-wrap items-center justify-center gap-2">
            <StatusPill
              icon={<Database className="h-3.5 w-3.5" />}
              label={
                supabaseConfig.configured
                  ? user?.email
                    ? `Signed in as ${user.email}`
                    : "Supabase ready for login"
                  : "Local mode"
              }
            />
            <StatusPill
              icon={<Cloud className="h-3.5 w-3.5" />}
              tone={syncStatus === "error" ? "danger" : syncStatus === "saved" ? "success" : "default"}
              label={
                syncMessage ??
                (supabaseConfig.configured
                  ? user
                    ? "Waiting for changes"
                    : "Sign in to sync across devices"
                  : "Add env vars to enable sync")
              }
            />
          </div>
        </header>

        {stats && (
          <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
            <LifeGrid daysAlive={stats.daysAlive} totalDays={stats.totalDays} />
          </div>
        )}

        <div className="mx-auto max-w-6xl px-4 pb-16 sm:px-6 lg:px-8">
          {stats && (
            <div className="mt-12 grid grid-cols-2 gap-3 sm:grid-cols-4 sm:gap-4">
              <Stat
                icon={<CalendarDays className="h-3.5 w-3.5" />}
                label="Days lived"
                value={fmt(stats.daysAlive)}
              />
              <Stat
                icon={<Hourglass className="h-3.5 w-3.5" />}
                label="Days remaining"
                value={fmt(stats.daysRemaining)}
              />
              <Stat
                icon={<Clock className="h-3.5 w-3.5" />}
                label="Weeks remaining"
                value={fmt(stats.weeksRemaining)}
              />
              <Stat
                icon={<Heart className="h-3.5 w-3.5" />}
                label="Years remaining"
                value={stats.remainingYears.toFixed(1)}
              />
            </div>
          )}

          <div className="mt-10 grid gap-6 lg:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)]">
            <div className="space-y-6">
              {!stats && (
                <Card className="rounded-3xl border-none bg-white/95 shadow-sm">
                  <CardHeader>
                    <CardTitle>Your clock</CardTitle>
                    <CardDescription>
                      Your life settings stay local until you choose to sync them.
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <SettingsCard settings={settings} stats={stats} set={setSetting} />
                  </CardContent>
                </Card>
              )}

              <AccountCard
                authBusy={authBusy}
                authError={authError}
                authMessage={authMessage}
                authMode={authMode}
                authReady={authReady}
                email={email}
                onAuthModeChange={setAuthMode}
                onEmailChange={setEmail}
                onPasswordChange={setPassword}
                onSignOut={handleSignOut}
                onSubmit={handleAuthSubmit}
                password={password}
                supabaseConfigured={supabaseConfig.configured}
                syncMessage={syncMessage}
                syncStatus={syncStatus}
                user={user}
              />
            </div>

            <GoalPlannerCard
              draft={goalDraft}
              goalError={goalError}
              goals={goals}
              onDeleteGoal={handleDeleteGoal}
              onDraftChange={setGoalDraft}
              onSubmit={handleAddGoal}
              onToggleCheckIn={handleToggleCheckIn}
              signedIn={!!user}
              todayIso={todayIso}
            />
          </div>

          <Dialog open={!!stats && showSettings} onOpenChange={setShowSettings}>
            <DialogContent className="max-w-md rounded-2xl">
              <DialogHeader>
                <DialogTitle className="text-lg font-semibold text-stone-800">Your clock</DialogTitle>
              </DialogHeader>
              <SettingsCard settings={settings} stats={stats} set={setSetting} />
            </DialogContent>
          </Dialog>

          <footer className="mt-20 text-center">
            <Separator className="mb-8" />
            <p className="text-xs italic text-stone-400">
              This is not prophecy. It is a memento mori with better habits.
            </p>
          </footer>
        </div>
      </div>
    </TooltipProvider>
  );
}

function AccountCard({
  authBusy,
  authError,
  authMessage,
  authMode,
  authReady,
  email,
  onAuthModeChange,
  onEmailChange,
  onPasswordChange,
  onSignOut,
  onSubmit,
  password,
  supabaseConfigured,
  syncMessage,
  syncStatus,
  user,
}: {
  authBusy: boolean;
  authError: string | null;
  authMessage: string | null;
  authMode: AuthMode;
  authReady: boolean;
  email: string;
  onAuthModeChange: (mode: AuthMode) => void;
  onEmailChange: (value: string) => void;
  onPasswordChange: (value: string) => void;
  onSignOut: () => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  password: string;
  supabaseConfigured: boolean;
  syncMessage: string | null;
  syncStatus: SyncStatus;
  user: User | null;
}) {
  return (
    <Card className="rounded-3xl border-none bg-white/95 shadow-sm">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Database className="h-4 w-4 text-stone-500" />
          Account & sync
        </CardTitle>
        <CardDescription>
          Use email + password login to sync your settings and plans through Supabase.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {!supabaseConfigured ? (
          <div className="space-y-3 rounded-2xl border border-amber-200 bg-amber-50/80 p-4 text-sm text-amber-900">
            <p className="font-medium">Supabase is not configured yet.</p>
            <p>
              Add <code className="rounded bg-white px-1 py-0.5">NEXT_PUBLIC_SUPABASE_URL</code> and{" "}
              <code className="rounded bg-white px-1 py-0.5">
                NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
              </code>{" "}
              in <code className="rounded bg-white px-1 py-0.5">.env.local</code>, then apply the SQL
              migration in <code className="rounded bg-white px-1 py-0.5">supabase/migrations</code>.
            </p>
            <p className="text-amber-800/80">
              Until then, the planner still works locally on this device.
            </p>
          </div>
        ) : !authReady ? (
          <div className="flex items-center gap-2 rounded-2xl bg-stone-50 px-4 py-3 text-sm text-stone-600">
            <LoaderCircle className="h-4 w-4 animate-spin" />
            Checking your session...
          </div>
        ) : user ? (
          <div className="space-y-4">
            <div className="rounded-2xl bg-stone-50 px-4 py-4">
              <p className="text-sm font-medium text-stone-800">{user.email}</p>
              <p className="mt-1 text-sm text-stone-500">
                {syncMessage ?? "Your settings and goal marks will sync automatically."}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2 text-xs text-stone-500">
              <StatusPill
                icon={<Cloud className="h-3.5 w-3.5" />}
                tone={syncStatus === "error" ? "danger" : syncStatus === "saved" ? "success" : "default"}
                label={syncStatus === "error" ? "Sync error" : syncStatus === "saving" ? "Saving..." : syncStatus === "loading" ? "Loading..." : "Synced"}
              />
            </div>
            <Button
              onClick={onSignOut}
              variant="outline"
              className="w-full rounded-xl"
              disabled={authBusy}
            >
              <LogOut className="h-4 w-4" />
              Sign out
            </Button>
          </div>
        ) : (
          <form className="space-y-4" onSubmit={onSubmit}>
            <div className="inline-flex rounded-full border border-stone-200 bg-stone-50 p-1 text-xs">
              <button
                type="button"
                onClick={() => onAuthModeChange("sign-in")}
                className={`rounded-full px-3 py-1.5 transition-colors ${
                  authMode === "sign-in" ? "bg-white text-stone-900 shadow-sm" : "text-stone-500"
                }`}
              >
                Sign in
              </button>
              <button
                type="button"
                onClick={() => onAuthModeChange("sign-up")}
                className={`rounded-full px-3 py-1.5 transition-colors ${
                  authMode === "sign-up" ? "bg-white text-stone-900 shadow-sm" : "text-stone-500"
                }`}
              >
                Create account
              </button>
            </div>

            <Field label="Email">
              <Input
                type="email"
                autoComplete="email"
                placeholder="you@example.com"
                value={email}
                onChange={(event) => onEmailChange(event.target.value)}
                className="rounded-xl"
              />
            </Field>

            <Field label="Password">
              <Input
                type="password"
                autoComplete={authMode === "sign-up" ? "new-password" : "current-password"}
                placeholder="••••••••"
                value={password}
                onChange={(event) => onPasswordChange(event.target.value)}
                className="rounded-xl"
              />
            </Field>

            {authError && (
              <p className="flex items-start gap-2 rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                <span>{authError}</span>
              </p>
            )}

            {authMessage && (
              <p className="rounded-xl bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
                {authMessage}
              </p>
            )}

            <Button type="submit" className="w-full rounded-xl" disabled={authBusy}>
              {authBusy ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <LogIn className="h-4 w-4" />}
              {authMode === "sign-up" ? "Create account" : "Sign in"}
            </Button>

            <p className="text-xs leading-relaxed text-stone-500">
              Email confirmation is controlled by your Supabase project settings. If confirmation is
              enabled, create the account first and then sign in after you verify your email.
            </p>
          </form>
        )}
      </CardContent>
    </Card>
  );
}

function GoalPlannerCard({
  draft,
  goalError,
  goals,
  onDeleteGoal,
  onDraftChange,
  onSubmit,
  onToggleCheckIn,
  signedIn,
  todayIso,
}: {
  draft: GoalDraft;
  goalError: string | null;
  goals: Goal[];
  onDeleteGoal: (goalId: string) => void;
  onDraftChange: (draft: GoalDraft | ((prev: GoalDraft) => GoalDraft)) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  onToggleCheckIn: (goalId: string, isoDate: string) => void;
  signedIn: boolean;
  todayIso: string;
}) {
  return (
    <Card className="rounded-3xl border-none bg-white/95 shadow-sm">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Target className="h-4 w-4 text-stone-500" />
          Daily goals
        </CardTitle>
        <CardDescription>
          Build a 30-day plan, a yearly system, or anything in between. Check off each day and watch
          your own line trend up or down.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <form className="space-y-4 rounded-2xl bg-stone-50/80 p-4" onSubmit={onSubmit}>
          <Field label="Plan name">
            <Input
              placeholder="Read, lift, write, ship..."
              value={draft.title}
              onChange={(event) =>
                onDraftChange((prev) => ({ ...prev, title: event.target.value }))
              }
              className="rounded-xl bg-white"
            />
          </Field>

          <Field label="What is this plan about?">
            <Textarea
              placeholder="Optional note for what counts as a daily check."
              value={draft.notes}
              onChange={(event) =>
                onDraftChange((prev) => ({ ...prev, notes: event.target.value }))
              }
              className="min-h-20 rounded-xl bg-white"
            />
          </Field>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Start date">
              <Input
                type="date"
                value={draft.startDate}
                onChange={(event) =>
                  onDraftChange((prev) => ({ ...prev, startDate: event.target.value }))
                }
                className="rounded-xl bg-white"
              />
            </Field>
            <Field label="End date">
              <Input
                type="date"
                value={draft.endDate}
                onChange={(event) =>
                  onDraftChange((prev) => ({ ...prev, endDate: event.target.value }))
                }
                className="rounded-xl bg-white"
              />
            </Field>
          </div>

          {goalError && (
            <p className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">{goalError}</p>
          )}

          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-xs text-stone-500">
              {signedIn
                ? "These plans will sync with your account."
                : "These plans are local until you sign in."}
            </p>
            <Button type="submit" className="rounded-xl">
              <Plus className="h-4 w-4" />
              Add plan
            </Button>
          </div>
        </form>

        {goals.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-stone-200 px-4 py-8 text-center text-sm text-stone-500">
            No plans yet. Add one above and start placing your Xs.
          </div>
        ) : (
          <div className="space-y-4">
            {goals.map((goal) => (
              <GoalCard
                key={goal.id}
                goal={goal}
                onDelete={() => onDeleteGoal(goal.id)}
                onToggleCheckIn={onToggleCheckIn}
                todayIso={todayIso}
              />
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function GoalCard({
  goal,
  onDelete,
  onToggleCheckIn,
  todayIso,
}: {
  goal: Goal;
  onDelete: () => void;
  onToggleCheckIn: (goalId: string, isoDate: string) => void;
  todayIso: string;
}) {
  const metrics = getGoalMetrics(goal, todayIso);
  const streakLabel = metrics.hasEnded
    ? "Plan finished"
    : metrics.canCheckToday
      ? metrics.todayComplete
        ? "Today is checked off"
        : "Today is still open"
      : metrics.hasStarted
        ? "This plan ended"
        : `Starts ${formatShortDate(goal.startDate)}`;

  return (
    <div className="rounded-2xl border border-stone-200 bg-white p-4 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <h3 className="text-base font-semibold text-stone-900">{goal.title}</h3>
          <p className="text-sm text-stone-500">
            {formatShortDate(goal.startDate)} - {formatShortDate(goal.endDate)} · {metrics.totalDays}{" "}
            days
          </p>
          {goal.notes ? <p className="text-sm leading-relaxed text-stone-600">{goal.notes}</p> : null}
        </div>
        <button
          onClick={onDelete}
          className="rounded-full p-2 text-stone-400 transition-colors hover:bg-stone-100 hover:text-stone-700"
          aria-label={`Delete ${goal.title}`}
        >
          <Trash2 className="h-4 w-4" />
        </button>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        <MiniStat
          icon={<Check className="h-3.5 w-3.5" />}
          label="Completed"
          value={`${metrics.completedCount}/${metrics.totalDays}`}
        />
        <MiniStat
          icon={<TrendingUp className="h-3.5 w-3.5" />}
          label="Hit rate"
          value={`${metrics.completionRate}%`}
        />
        <MiniStat
          icon={<CalendarDays className="h-3.5 w-3.5" />}
          label="Missed so far"
          value={String(metrics.missedCount)}
        />
      </div>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-stone-50 px-4 py-3">
        <div>
          <p className="text-sm font-medium text-stone-800">{streakLabel}</p>
          <p className="text-xs text-stone-500">
            Elapsed days: {metrics.elapsedCount} · Upcoming days: {metrics.upcomingCount}
          </p>
        </div>
        <Button
          type="button"
          variant={metrics.todayComplete ? "secondary" : "default"}
          className="rounded-xl"
          disabled={!metrics.canCheckToday}
          onClick={() => onToggleCheckIn(goal.id, todayIso)}
        >
          <Check className="h-4 w-4" />
          {metrics.todayComplete ? "Undo today" : "Mark today"}
        </Button>
      </div>

      <div className="mt-4">
        <p className="mb-2 text-xs uppercase tracking-[0.2em] text-stone-400">Daily board</p>
        <div className="grid grid-cols-7 gap-1 sm:grid-cols-10 xl:grid-cols-14">
          {metrics.dates.map((isoDate) => {
            const complete = goal.checkIns.includes(isoDate);
            const future = compareIsoDates(isoDate, todayIso) > 0;
            const today = isoDate === todayIso;
            const clickable = !future && isDateWithinRange(isoDate, goal.startDate, goal.endDate);

            return (
              <button
                key={isoDate}
                type="button"
                title={isoDate}
                disabled={!clickable}
                onClick={() => onToggleCheckIn(goal.id, isoDate)}
                className={[
                  "flex h-8 items-center justify-center rounded-lg border text-[10px] font-semibold tabular-nums transition-colors",
                  complete
                    ? "border-amber-400 bg-amber-400 text-white"
                    : future
                      ? "border-stone-200 bg-stone-100 text-stone-300"
                      : "border-stone-200 bg-white text-stone-500 hover:border-stone-300 hover:bg-stone-50",
                  today ? "ring-2 ring-stone-300 ring-offset-1" : "",
                ].join(" ")}
                aria-label={`${goal.title} on ${isoDate}`}
              >
                {complete ? "X" : new Date(`${isoDate}T00:00:00`).getDate()}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

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
        <Select value={settings.regionId} onValueChange={(value) => value && set("regionId", value)}>
          <SelectTrigger className="h-11 w-full min-w-0 justify-between gap-3 rounded-xl border-stone-200 bg-white px-4 py-2 text-left text-sm font-medium text-stone-800 shadow-sm hover:bg-stone-50/80 data-placeholder:text-stone-400 [&_svg]:shrink-0 [&_svg]:text-stone-400">
            <SelectValue placeholder="Choose region" />
          </SelectTrigger>
          <SelectContent
            align="start"
            alignItemWithTrigger={false}
            side="bottom"
            sideOffset={6}
            className="max-h-[min(17rem,50dvh)] rounded-xl border-stone-200 bg-white p-1 shadow-lg ring-1 ring-stone-900/5"
          >
            {regions.map((region) => (
              <SelectItem key={region.id} value={region.id} className="rounded-lg py-2.5 pl-3">
                <span className="min-w-0 flex-1 truncate text-stone-800">{region.name}</span>
                {region.lifeExpectancy > 0 ? (
                  <span className="shrink-0 text-xs text-stone-400 tabular-nums">
                    {region.lifeExpectancy} yr
                  </span>
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
            onChange={(event) => set("customLifeExpectancy", event.target.value)}
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
              Uses conditional survival: since you already survived to your current age, your
              expected remaining lifespan is slightly higher than the birth average.
            </TooltipContent>
          </Tooltip>
        </div>
        <Switch
          id="age-adj"
          checked={settings.ageAdjusted}
          onCheckedChange={(value) => set("ageAdjusted", value)}
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

function StatusPill({
  icon,
  label,
  tone = "default",
}: {
  icon: ReactNode;
  label: string;
  tone?: "default" | "success" | "danger";
}) {
  const toneClass =
    tone === "success"
      ? "bg-emerald-50 text-emerald-700"
      : tone === "danger"
        ? "bg-red-50 text-red-700"
        : "bg-white/80 text-stone-600";

  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs ${toneClass}`}>
      {icon}
      <span>{label}</span>
    </span>
  );
}

function Stat({ icon, label, value }: { icon: ReactNode; label: string; value: string }) {
  return (
    <div className="rounded-2xl bg-white p-4 text-center shadow-sm sm:p-5">
      <p className="text-2xl font-semibold text-stone-900 tabular-nums sm:text-3xl">{value}</p>
      <div className="mt-1.5 flex items-center justify-center gap-1.5 text-[0.7rem] text-stone-400">
        {icon}
        <span>{label}</span>
      </div>
    </div>
  );
}

function MiniStat({ icon, label, value }: { icon: ReactNode; label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-stone-200 bg-stone-50/60 px-3 py-2">
      <div className="flex items-center gap-1.5 text-[0.7rem] uppercase tracking-[0.18em] text-stone-400">
        {icon}
        <span>{label}</span>
      </div>
      <p className="mt-1 text-lg font-semibold text-stone-900 tabular-nums">{value}</p>
    </div>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
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
        {Array.from({ length: totalWeeks }, (_, index) => (
          <div
            key={index}
            className={`h-2 w-2 rounded-full ${index < weeksLived ? "bg-amber-400" : "bg-stone-200"}`}
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
