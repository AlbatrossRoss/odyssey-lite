"use client";

import type { AccountWithStats } from "@/lib/accounts";
import type { AppBoard } from "@/lib/boards";
import type { AppPost } from "@/lib/posts";

export type ProfileBundle = {
  account: AccountWithStats | null;
  boards: AppBoard[];
  posts: AppPost[];
};

export async function fetchProfileBundle(username: string, viewerAccountId: string | null) {
  const search = new URLSearchParams();
  if (viewerAccountId) search.set("viewerId", viewerAccountId);

  const response = await fetch(`/api/profiles/${encodeURIComponent(username)}?${search.toString()}`);

  if (response.status === 501) return null;
  if (!response.ok) throw new Error("Unable to load the profile.");

  return (await response.json()) as ProfileBundle;
}
