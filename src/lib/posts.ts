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
  mediaUrls: string[];
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
  mediaUrls?: string[];
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
  media_urls?: string[] | null;
  latitude: number;
  longitude: number;
  date_label: string;
  visibility: string;
  created_at: string;
};

type AppPostAccountRow = {
  id: string;
  username?: string;
  profile_photo_url?: string | null;
};

const basePostSelectColumns =
  "id, account_id, type, title, location, caption, image_url, latitude, longitude, date_label, visibility, created_at";
const postSelectColumns = `${basePostSelectColumns}, media_urls`;

function assertPostsConfigured() {
  if (!isSupabaseConfigured()) {
    throw new Error("Supabase is not configured. Add NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY to use posts.");
  }
}

function safeProfilePhotoUrl(value: string | null | undefined) {
  return value?.startsWith("data:image/") ? null : value ?? null;
}

function mapPost(post: AppPostRow, account?: AppPostAccountRow): AppPost {
  return {
    id: post.id,
    accountId: post.account_id,
    username: account?.username ?? "traveler",
    profilePhotoUrl: safeProfilePhotoUrl(account?.profile_photo_url),
    type: post.type,
    title: post.title,
    location: post.location,
    caption: post.caption,
    imageUrl: post.image_url,
    mediaUrls: post.media_urls?.length ? post.media_urls : [post.image_url],
    coordinates: [post.longitude, post.latitude],
    dateLabel: post.date_label,
    visibility: post.visibility,
    createdAt: post.created_at,
  };
}

async function fetchAccountSummaries(accountIds: string[]) {
  if (!accountIds.length) {
    return new Map<string, AppPostAccountRow>();
  }

  const supabase = createSupabaseBrowserClient();
  const uniqueAccountIds = Array.from(new Set(accountIds));
  const [{ data: names, error: namesError }, { data: profilePhotos, error: profilePhotosError }] = await Promise.all([
    supabase.from("app_accounts").select("id, username").in("id", uniqueAccountIds),
    supabase
      .from("app_accounts")
      .select("id, profile_photo_url")
      .in("id", uniqueAccountIds)
      .not("profile_photo_url", "like", "data:image/%"),
  ]);

  if (namesError) {
    throw namesError;
  }

  if (profilePhotosError) {
    throw profilePhotosError;
  }

  const accounts = new Map<string, AppPostAccountRow>();

  (names as AppPostAccountRow[] | null)?.forEach((account) => {
    accounts.set(account.id, account);
  });
  (profilePhotos as AppPostAccountRow[] | null)?.forEach((account) => {
    accounts.set(account.id, { ...accounts.get(account.id), ...account });
  });

  return accounts;
}

async function hydratePosts(posts: AppPostRow[]) {
  const accounts = await fetchAccountSummaries(posts.map((post) => post.account_id));

  return posts.map((post) => mapPost(post, accounts.get(post.account_id)));
}

function isMissingMediaUrlsError(error: unknown) {
  if (!error || typeof error !== "object") {
    return false;
  }

  const candidate = error as { code?: unknown; message?: unknown };
  const code = typeof candidate.code === "string" ? candidate.code : "";
  const message = typeof candidate.message === "string" ? candidate.message.toLowerCase() : "";

  return code === "42703" || message.includes("media_urls") || message.includes("media urls");
}

type PostRowsQuery = {
  eq: (column: string, value: string) => PostRowsQuery;
  in: (column: string, values: string[]) => PostRowsQuery;
  order: (column: string, options: { ascending: boolean }) => PromiseLike<{ data: unknown; error: unknown }>;
};

type SinglePostQuery = {
  eq: (column: string, value: string) => SinglePostQuery;
  maybeSingle: () => PromiseLike<{ data: unknown; error: unknown }>;
};

async function fetchPostRows(applyQuery: (query: PostRowsQuery) => PromiseLike<{ data: unknown; error: unknown }>) {
  const supabase = createSupabaseBrowserClient();
  const { data, error } = await applyQuery(supabase.from("app_posts").select(postSelectColumns) as unknown as PostRowsQuery);

  if (!isMissingMediaUrlsError(error)) {
    if (error) {
      throw error;
    }

    return data as unknown as AppPostRow[];
  }

  const { data: fallbackData, error: fallbackError } = await applyQuery(
    supabase.from("app_posts").select(basePostSelectColumns) as unknown as PostRowsQuery,
  );

  if (fallbackError) {
    throw fallbackError;
  }

  return fallbackData as unknown as AppPostRow[];
}

export async function createAppPost(draft: AppPostDraft) {
  assertPostsConfigured();

  const supabase = createSupabaseBrowserClient();
  const postInsert = {
    account_id: draft.accountId,
    type: draft.type,
    title: draft.title,
    location: draft.location,
    caption: draft.caption,
    image_url: draft.imageUrl,
    media_urls: draft.mediaUrls?.length ? draft.mediaUrls : [draft.imageUrl],
    longitude: draft.coordinates[0],
    latitude: draft.coordinates[1],
    date_label: draft.dateLabel,
    visibility: draft.visibility,
  };
  const response = await supabase
    .from("app_posts")
    .insert(postInsert as never)
    .select(postSelectColumns)
    .single();
  let data: unknown = response.data;
  let error: unknown = response.error;

  if (isMissingMediaUrlsError(error)) {
    const basePostInsert = {
      account_id: postInsert.account_id,
      type: postInsert.type,
      title: postInsert.title,
      location: postInsert.location,
      caption: postInsert.caption,
      image_url: postInsert.image_url,
      longitude: postInsert.longitude,
      latitude: postInsert.latitude,
      date_label: postInsert.date_label,
      visibility: postInsert.visibility,
    };
    const fallbackResponse = await supabase
      .from("app_posts")
      .insert(basePostInsert as never)
      .select(basePostSelectColumns)
      .single();

    data = fallbackResponse.data;
    error = fallbackResponse.error;
  }

  if (error) {
    throw error;
  }

  return (await hydratePosts([data as unknown as AppPostRow]))[0];
}

export async function fetchAppPosts() {
  assertPostsConfigured();

  return hydratePosts(await fetchPostRows((query) => query.order("created_at", { ascending: false })));
}

export async function fetchAppPostsByAccount(accountId: string) {
  assertPostsConfigured();

  return hydratePosts(await fetchPostRows((query) =>
    query
    .eq("account_id", accountId)
    .order("created_at", { ascending: false }),
  ));
}

export async function fetchAppPostsByIds(postIds: string[]) {
  assertPostsConfigured();

  if (!postIds.length) {
    return [];
  }

  return hydratePosts(await fetchPostRows((query) =>
    query
    .in("id", postIds)
    .order("created_at", { ascending: false }),
  ));
}

export async function fetchAppPostById(postId: string) {
  assertPostsConfigured();

  const supabase = createSupabaseBrowserClient();
  const response = await (supabase.from("app_posts").select(postSelectColumns) as unknown as SinglePostQuery)
    .eq("id", postId)
    .maybeSingle();
  let data = response.data;
  let error = response.error;

  if (isMissingMediaUrlsError(error)) {
    const fallbackResponse = await (supabase.from("app_posts").select(basePostSelectColumns) as unknown as SinglePostQuery)
      .eq("id", postId)
      .maybeSingle();

    data = fallbackResponse.data;
    error = fallbackResponse.error;
  }

  if (error) {
    throw error;
  }

  return data ? (await hydratePosts([data as unknown as AppPostRow]))[0] : null;
}
