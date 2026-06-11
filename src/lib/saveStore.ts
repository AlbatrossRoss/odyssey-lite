const savedKey = "odyssey:saved-experiences";

export function readSavedSlugs(fallback: string[] = []) {
  if (typeof window === "undefined") {
    return fallback;
  }

  try {
    const stored = window.localStorage.getItem(savedKey);
    return stored ? (JSON.parse(stored) as string[]) : fallback;
  } catch {
    return fallback;
  }
}

export function writeSavedSlugs(slugs: string[]) {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(savedKey, JSON.stringify(Array.from(new Set(slugs))));
}
