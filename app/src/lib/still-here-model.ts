import { getRegionById } from "@/lib/life-data";

export interface Settings {
  birthdate: string;
  regionId: string;
  customLifeExpectancy: string;
  ageAdjusted: boolean;
}

export const SETTINGS_STORAGE_KEY = "still-here-settings";
export const GOALS_STORAGE_KEY = "still-here-goals";

export const DEFAULT_SETTINGS: Settings = {
  birthdate: "",
  regionId: "world",
  customLifeExpectancy: "73",
  ageAdjusted: true,
};

export function settingsWithGeoSuggestion(suggestedRegionId?: string | null): Settings {
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

export function normalizeSettings(value: unknown, suggestedRegionId?: string | null): Settings {
  const fallback = settingsWithGeoSuggestion(suggestedRegionId);
  if (!value || typeof value !== "object") {
    return fallback;
  }

  const candidate = value as Partial<Settings>;
  const regionId =
    typeof candidate.regionId === "string" &&
    (candidate.regionId === "custom" || !!getRegionById(candidate.regionId))
      ? candidate.regionId
      : fallback.regionId;

  return {
    birthdate: typeof candidate.birthdate === "string" ? candidate.birthdate : "",
    regionId,
    customLifeExpectancy:
      typeof candidate.customLifeExpectancy === "string"
        ? candidate.customLifeExpectancy
        : fallback.customLifeExpectancy,
    ageAdjusted:
      typeof candidate.ageAdjusted === "boolean"
        ? candidate.ageAdjusted
        : fallback.ageAdjusted,
  };
}
