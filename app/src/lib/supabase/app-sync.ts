import type { SupabaseClient } from "@supabase/supabase-js";

import type { Goal } from "@/lib/goals";
import { normalizeGoal, sortGoals } from "@/lib/goals";
import type { Settings } from "@/lib/still-here-model";
import { normalizeSettings } from "@/lib/still-here-model";
import type { Database } from "@/lib/supabase/database.types";

type AppSupabaseClient = SupabaseClient<Database>;

function toSettingsRow(userId: string, settings: Settings): Database["public"]["Tables"]["user_settings"]["Insert"] {
  return {
    user_id: userId,
    birthdate: settings.birthdate || null,
    region_id: settings.regionId,
    custom_life_expectancy:
      settings.regionId === "custom" ? Number.parseFloat(settings.customLifeExpectancy) || null : null,
    age_adjusted: settings.ageAdjusted,
    updated_at: new Date().toISOString(),
  };
}

function fromSettingsRow(
  row: Database["public"]["Tables"]["user_settings"]["Row"] | null,
): Settings | null {
  if (!row) {
    return null;
  }

  return normalizeSettings({
    birthdate: row.birthdate ?? "",
    regionId: row.region_id,
    customLifeExpectancy:
      row.custom_life_expectancy === null ? "" : String(row.custom_life_expectancy),
    ageAdjusted: row.age_adjusted,
  });
}

function toGoalRow(userId: string, goal: Goal): Database["public"]["Tables"]["goals"]["Insert"] {
  return {
    id: goal.id,
    user_id: userId,
    title: goal.title,
    notes: goal.notes,
    start_date: goal.startDate,
    end_date: goal.endDate,
    check_ins: goal.checkIns,
    created_at: new Date(goal.createdAt).toISOString(),
    updated_at: new Date().toISOString(),
  };
}

function fromGoalRow(row: Database["public"]["Tables"]["goals"]["Row"]): Goal {
  return normalizeGoal({
    id: row.id,
    title: row.title,
    notes: row.notes,
    startDate: row.start_date,
    endDate: row.end_date,
    checkIns: row.check_ins ?? [],
    createdAt: new Date(row.created_at).getTime(),
  });
}

export async function fetchRemoteSnapshot(supabase: AppSupabaseClient): Promise<{
  settings: Settings | null;
  goals: Goal[];
}> {
  const [{ data: settingsRow, error: settingsError }, { data: goalRows, error: goalsError }] =
    await Promise.all([
      supabase.from("user_settings").select("*").maybeSingle(),
      supabase.from("goals").select("*").order("start_date", { ascending: true }),
    ]);

  if (settingsError) {
    throw settingsError;
  }
  if (goalsError) {
    throw goalsError;
  }

  return {
    settings: fromSettingsRow(settingsRow),
    goals: (goalRows ?? []).map(fromGoalRow).sort(sortGoals),
  };
}

export async function saveRemoteSnapshot(
  supabase: AppSupabaseClient,
  userId: string,
  settings: Settings,
  goals: Goal[],
): Promise<void> {
  const settingsRow = toSettingsRow(userId, settings);
  const goalRows = goals.map((goal) => toGoalRow(userId, goal));

  const { error: settingsError } = await supabase
    .from("user_settings")
    .upsert(settingsRow, { onConflict: "user_id" });

  if (settingsError) {
    throw settingsError;
  }

  if (goalRows.length > 0) {
    const { error: goalsError } = await supabase
      .from("goals")
      .upsert(goalRows, { onConflict: "id" });

    if (goalsError) {
      throw goalsError;
    }
  }
}

export async function deleteRemoteGoal(
  supabase: AppSupabaseClient,
  goalId: string,
): Promise<void> {
  const { error } = await supabase.from("goals").delete().eq("id", goalId);
  if (error) {
    throw error;
  }
}
