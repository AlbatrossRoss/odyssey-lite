"use client";

const postNavigationContextKey = "odyssey-post-navigation-context-v1";

type PostNavigationContext = {
  ids: string[];
  source: string;
};

export function writePostNavigationContext(ids: string[], source: string) {
  if (typeof window === "undefined") {
    return;
  }

  const uniqueIds = Array.from(new Set(ids)).filter(Boolean);

  if (!uniqueIds.length) {
    return;
  }

  window.sessionStorage.setItem(postNavigationContextKey, JSON.stringify({ ids: uniqueIds, source }));
}

export function readPostNavigationContext(): PostNavigationContext | null {
  if (typeof window === "undefined") {
    return null;
  }

  try {
    const stored = window.sessionStorage.getItem(postNavigationContextKey);

    if (!stored) {
      return null;
    }

    const parsed = JSON.parse(stored) as Partial<PostNavigationContext>;

    return Array.isArray(parsed.ids) ? { ids: parsed.ids.filter(Boolean), source: parsed.source ?? "posts" } : null;
  } catch {
    return null;
  }
}
