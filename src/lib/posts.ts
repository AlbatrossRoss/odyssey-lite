"use client";

import { createSupabaseBrowserClient, isSupabaseConfigured } from "@/lib/supabase/client";

export type AppPost = {
  id: string;
  accountId: string;
  username: string;
  profilePhotoUrl: string | null;
  type: "trip" | "experience";
  title: string;
  location: string;
  caption: string;
  imageUrl: string;
  coordinates: [number, number];
  dateLabel: string;
  visibility: string;
  createdAt: string;
};

export type AppPostDraft = {
  accountId: string;
  type: "trip" | "experience";
  title: string;
  location: string;
  caption: string;
  imageUrl: string;
  coordinates: [number, number];
  dateLabel: string;
  visibility: string;
};

type AppPostRow = {
  id: string;
  account_id: string;
  type: "trip" | "experience";
  title: string;
  location: string;
  caption: string;
  image_url: string;
  latitude: number;
  longitude: number;
  date_label: string;
  visibility: string;
  created_at: string;
  app_accounts?: {
    username: string;
    profile_photo_url: string | null;
  } | null;
};

function assertPostsConfigured() {
  if (!isSupabaseConfigured()) {
    throw new Error("Supabase is not configured. Add NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY to use posts.");
  }
}

function mapPost(post: AppPostRow): AppPost {
  return {
    id: post.id,
    accountId: post.account_id,
    username: post.app_accounts?.username ?? "traveler",
    profilePhotoUrl: post.app_accounts?.profile_photo_url ?? null,
    type: post.type,
    title: post.title,
    location: post.location,
    caption: post.caption,
    imageUrl: post.image_url,
    coordinates: [post.longitude, post.latitude],
    dateLabel: post.date_label,
    visibility: post.visibility,
    createdAt: post.created_at,
  };
}

export async function createAppPost(draft: AppPostDraft) {
  assertPostsConfigured();

  const supabase = createSupabaseBrowserClient();
  const { data, error } = await supabase
    .from("app_posts")
    .insert({
      account_id: draft.accountId,
      type: draft.type,
      title: draft.title,
      location: draft.location,
      caption: draft.caption,
      image_url: draft.imageUrl,
      longitude: draft.coordinates[0],
      latitude: draft.coordinates[1],
      date_label: draft.dateLabel,
      visibility: draft.visibility,
    })
    .select("*, app_accounts(username, profile_photo_url)")
    .single();

  if (error) {
    throw error;
  }

  return mapPost(data as AppPostRow);
}

export async function fetchAppPosts() {
  assertPostsConfigured();

  const supabase = createSupabaseBrowserClient();
  const { data, error } = await supabase
    .from("app_posts")
    .select("*, app_accounts(username, profile_photo_url)")
    .order("created_at", { ascending: false });

  if (error) {
    throw error;
  }

  return (data as AppPostRow[]).map(mapPost);
}

export async function fetchAppPostsByAccount(accountId: string) {
  assertPostsConfigured();

  const supabase = createSupabaseBrowserClient();
  const { data, error } = await supabase
    .from("app_posts")
    .select("*, app_accounts(username, profile_photo_url)")
    .eq("account_id", accountId)
    .order("created_at", { ascending: false });

  if (error) {
    throw error;
  }

  return (data as AppPostRow[]).map(mapPost);
}

export async function fetchAppPostsByIds(postIds: string[]) {
  assertPostsConfigured();

  if (!postIds.length) {
    return [];
  }

  const supabase = createSupabaseBrowserClient();
  const { data, error } = await supabase
    .from("app_posts")
    .select("*, app_accounts(username, profile_photo_url)")
    .in("id", postIds)
    .order("created_at", { ascending: false });

  if (error) {
    throw error;
  }

  return (data as AppPostRow[]).map(mapPost);
}

export async function fetchAppPostById(postId: string) {
  assertPostsConfigured();

  const supabase = createSupabaseBrowserClient();
  const { data, error } = await supabase
    .from("app_posts")
    .select("*, app_accounts(username, profile_photo_url)")
    .eq("id", postId)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return data ? mapPost(data as AppPostRow) : null;
}
