import type { Settings } from "./types";

const DEFAULT_SETTINGS: Settings = {
  theme: "light",
  scanScope: "page",
  strictness: "relaxed",
  requiredStateTags: [
    "state:loading",
    "state:empty",
    "state:error",
    "state:stale",
    "state:denied"
  ],
  truthTags: [
    "truth:source",
    "truth:freshness",
    "truth:scope",
    "truth:confidence"
  ]
};

export async function getSettings(): Promise<Settings> {
  try {
    const stored = await figma.clientStorage.getAsync("settings");
    return Object.assign({}, DEFAULT_SETTINGS, stored);
  } catch {
    return DEFAULT_SETTINGS;
  }
}

export async function setSettings(settings: Partial<Settings>): Promise<void> {
  const current = await getSettings();
  await figma.clientStorage.setAsync("settings", Object.assign({}, current, settings));
}

export async function getCachedLibraries(): Promise<{ timestamp: number; libraries: any[] } | null> {
  try {
    return await figma.clientStorage.getAsync("cachedLibraries");
  } catch {
    return null;
  }
}

export async function setCachedLibraries(libraries: any[]): Promise<void> {
  await figma.clientStorage.setAsync("cachedLibraries", {
    timestamp: Date.now(),
    libraries
  });
}
