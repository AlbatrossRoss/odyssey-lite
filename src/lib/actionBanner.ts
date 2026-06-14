"use client";

import type { AppPostMediaType } from "@/lib/posts";

export type ActionBanner = {
  href: string;
  imageUrl: string;
  mediaType?: AppPostMediaType;
  message: string;
  title: string;
  type: "post-created" | "post-saved";
};

const actionBannerStorageKey = "odyssey-action-banner-v1";

export function writeActionBanner(banner: ActionBanner) {
  try {
    window.sessionStorage.setItem(actionBannerStorageKey, JSON.stringify(banner));
  } catch {
    // Ignore storage failures; the core publish/save action already succeeded.
  }
}

export function consumeActionBanner() {
  try {
    const stored = window.sessionStorage.getItem(actionBannerStorageKey);

    if (!stored) {
      return null;
    }

    window.sessionStorage.removeItem(actionBannerStorageKey);
    return JSON.parse(stored) as ActionBanner;
  } catch {
    return null;
  }
}
