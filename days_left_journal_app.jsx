import React, { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { BookOpen, CalendarDays, Hourglass, Save } from "lucide-react";

function daysBetween(start: Date, end: Date) {
  const msPerDay = 1000 * 60 * 60 * 24;
  const utcStart = Date.UTC(start.getFullYear(), start.getMonth(), start.getDate());
  const utcEnd = Date.UTC(end.getFullYear(), end.getMonth(), end.getDate());
  return Math.floor((utcEnd - utcStart) / msPerDay);
}

function addYears(date: Date, years: number) {
  const d = new Date(date);
  d.setFullYear(d.getFullYear() + years);
  return d;
}

function formatDate(date: Date) {
  return date.toLocaleDateString(undefined, {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

export default function DaysLeftJournalApp() {
  const [birthdate, setBirthdate] = useState("1989-08-01");
  const [lifeExpectancy, setLifeExpectancy] = useState("81.5");
  const [title, setTitle] = useState("What I plan to do today");
  const [entry, setEntry] = useState("");
  const [savedEntries, setSavedEntries] = useState<Array<{date: string; dayNumber: number; title: string; entry: string}>>([]);

  const today = new Date();

  const stats = useMemo(() => {
    const birth = new Date(`${birthdate}T00:00:00`);
    const expectancy = Number(lifeExpectancy);

    if (Number.isNaN(birth.getTime()) || Number.isNaN(expectancy) || expectancy <= 0) {
      return null;
    }

    const daysAlive = daysBetween(birth, today);
    const estimatedEnd = addYears(birth, expectancy);
    const totalDays = daysBetween(birth, estimatedEnd);
    const daysRemaining = Math.max(0, totalDays - daysAlive);
    const progress = Math.max(0, Math.min(100, (daysAlive / totalDays) * 100));

    return {
      daysAlive,
      totalDays,
      daysRemaining,
      progress,
      todayLabel: formatDate(today),
    };
  }, [birthdate, lifeExpectancy, today]);

  const saveEntry = () => {
    if (!stats || !entry.trim()) return;
    setSavedEntries((prev) => [
      {
        date: stats.todayLabel,
        dayNumber: stats.daysAlive,
        title: title.trim() || "Daily note",
        entry: entry.trim(),
      },
      ...prev,
    ]);
    setEntry("");
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-stone-50 to-stone-100 p-6 md:p-10">
      <div className="mx-auto grid max-w-6xl gap-6 lg:grid-cols-[1.1fr_0.9fr]">
        <div className="space-y-6">
          <div>
            <p className="text-sm uppercase tracking-[0.2em] text-stone-500">Life Journal</p>
            <h1 className="mt-2 text-4xl font-semibold tracking-tight text-stone-900 md:text-5xl">
              Today is day {stats?.daysAlive ?? "—"}
            </h1>
            <p className="mt-3 max-w-2xl text-base leading-7 text-stone-600">
              A small reminder that time is real, strange, and very easy to waste on nonsense.
              So write down what matters today.
            </p>
          </div>

          <Card className="rounded-3xl border-0 shadow-lg">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-xl">
                <BookOpen className="h-5 w-5" />
                Today’s entry
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label className="mb-2 block text-sm font-medium text-stone-700">Entry title</label>
                <Input
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="What matters today?"
                  className="rounded-2xl"
                />
              </div>
              <div>
                <label className="mb-2 block text-sm font-medium text-stone-700">Journal</label>
                <Textarea
                  value={entry}
                  onChange={(e) => setEntry(e.target.value)}
                  placeholder="Today is day 13374. I want to spend it on..."
                  className="min-h-[220px] rounded-2xl"
                />
              </div>
              <Button onClick={saveEntry} className="rounded-2xl">
                <Save className="mr-2 h-4 w-4" />
                Save entry
              </Button>
            </CardContent>
          </Card>

          <Card className="rounded-3xl border-0 shadow-lg">
            <CardHeader>
              <CardTitle className="text-xl">Previous entries</CardTitle>
            </CardHeader>
            <CardContent>
              {savedEntries.length === 0 ? (
                <p className="text-stone-500">No entries yet. Start with today.</p>
              ) : (
                <div className="space-y-4">
                  {savedEntries.map((item, idx) => (
                    <div key={`${item.date}-${idx}`} className="rounded-2xl border border-stone-200 bg-white p-4">
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge variant="secondary" className="rounded-full">Day {item.dayNumber}</Badge>
                        <span className="text-sm text-stone-500">{item.date}</span>
                      </div>
                      <h3 className="mt-3 text-lg font-semibold text-stone-900">{item.title}</h3>
                      <p className="mt-2 whitespace-pre-wrap text-stone-700">{item.entry}</p>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <Card className="rounded-3xl border-0 shadow-lg">
            <CardHeader>
              <CardTitle className="text-xl">Your rough clock</CardTitle>
            </CardHeader>
            <CardContent className="space-y-5">
              <div>
                <label className="mb-2 block text-sm font-medium text-stone-700">Birth date</label>
                <Input
                  type="date"
                  value={birthdate}
                  onChange={(e) => setBirthdate(e.target.value)}
                  className="rounded-2xl"
                />
              </div>
              <div>
                <label className="mb-2 block text-sm font-medium text-stone-700">Life expectancy (years)</label>
                <Input
                  type="number"
                  step="0.1"
                  value={lifeExpectancy}
                  onChange={(e) => setLifeExpectancy(e.target.value)}
                  className="rounded-2xl"
                />
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-2xl bg-stone-50 p-4">
                  <div className="flex items-center gap-2 text-stone-500">
                    <CalendarDays className="h-4 w-4" />
                    <span className="text-sm">Days lived</span>
                  </div>
                  <p className="mt-2 text-3xl font-semibold text-stone-900">{stats?.daysAlive ?? "—"}</p>
                </div>
                <div className="rounded-2xl bg-stone-50 p-4">
                  <div className="flex items-center gap-2 text-stone-500">
                    <Hourglass className="h-4 w-4" />
                    <span className="text-sm">Days remaining</span>
                  </div>
                  <p className="mt-2 text-3xl font-semibold text-stone-900">{stats?.daysRemaining ?? "—"}</p>
                </div>
              </div>

              <div>
                <div className="mb-2 flex items-center justify-between text-sm text-stone-600">
                  <span>Estimated lifetime used</span>
                  <span>{stats ? `${stats.progress.toFixed(1)}%` : "—"}</span>
                </div>
                <div className="h-3 overflow-hidden rounded-full bg-stone-200">
                  <div
                    className="h-full rounded-full bg-stone-800 transition-all"
                    style={{ width: `${stats?.progress ?? 0}%` }}
                  />
                </div>
              </div>

              <div className="rounded-2xl border border-stone-200 bg-stone-50 p-4 text-sm leading-6 text-stone-600">
                <p><strong>Today:</strong> {stats?.todayLabel ?? "—"}</p>
                <p><strong>Estimated total days:</strong> {stats?.totalDays ?? "—"}</p>
                <p>
                  This is not prophecy. It is a memento mori with better UI.
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
