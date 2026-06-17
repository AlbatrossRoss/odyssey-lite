"use client";

import { createSupabaseBrowserClient, isSupabaseConfigured } from "@/lib/supabase/client";
import { inferPostTagFromText, normalizePostTag, type AppPostTag } from "@/lib/postTags";

export type AppPost = {
  id: string;
  accountId: string;
  username: string;
  profilePhotoUrl: string | null;
  type: "trip" | "experience";
  title: string;
  location: string;
  caption: string;
  imageUrl: string | null;
  mediaUrls: string[];
  mediaTypes: AppPostMediaType[];
  tags: AppPostTag[];
  coordinates: [number, number];
  dateLabel: string;
  visibility: string;
  createdAt: string;
};

export type AppPostMediaType = "image" | "video";

export type AppPostDraft = {
  accountId: string;
  type: "trip" | "experience";
  title: string;
  location: string;
  caption: string;
  imageUrl?: string | null;
  mediaUrls?: string[];
  mediaTypes?: AppPostMediaType[];
  tags?: AppPostTag[];
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
  image_url: string | null;
  media_urls?: string[] | null;
  media_types?: string[] | null;
  tags?: string[] | null;
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
const postSelectColumnsWithMediaUrls = `${basePostSelectColumns}, media_urls`;
const postSelectColumnsWithMediaTypes = `${postSelectColumnsWithMediaUrls}, media_types`;
const postSelectColumns = `${postSelectColumnsWithMediaTypes}, tags`;
const defaultPostFetchLimit = 80;

function assertPostsConfigured() {
  if (!isSupabaseConfigured()) {
    throw new Error("Supabase is not configured. Add NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY to use posts.");
  }
}

function safeProfilePhotoUrl(value: string | null | undefined) {
  return value ?? null;
}

const accountSummaryCache = new Map<string, AppPostAccountRow>();

function mapPost(post: AppPostRow, account?: AppPostAccountRow): AppPost {
  const mediaUrls = post.media_urls?.length ? post.media_urls : post.image_url ? [post.image_url] : [];
  const mediaTypes = mediaUrls.map((url, index) => normalizeMediaType(post.media_types?.[index], url));
  const storedTags = Array.from(new Set(post.tags?.map(normalizePostTag).filter((tag): tag is AppPostTag => Boolean(tag)) ?? []));
  const tags = storedTags.length ? storedTags : [inferPostTagFromText(post.title, post.caption, post.location)];

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
    mediaUrls,
    mediaTypes,
    tags,
    coordinates: [post.longitude, post.latitude],
    dateLabel: formatPostMonthYear(post.date_label, post.created_at),
    visibility: post.visibility,
    createdAt: post.created_at,
  };
}

function normalizeMediaType(value: string | null | undefined, url: string): AppPostMediaType {
  if (value === "video") {
    return "video";
  }

  const cleanUrl = url.split("?")[0]?.toLowerCase() ?? "";

  return /\.(mov|mp4|m4v|webm|avi)$/.test(cleanUrl) ? "video" : "image";
}

function formatPostMonthYear(dateLabel: string | null | undefined, createdAt: string) {
  const source = dateLabel?.trim();
  const parsed = source && source.toLowerCase() !== "just now" ? parsePostDate(source) : null;
  const fallback = parsePostDate(createdAt) ?? new Date();
  const date = parsed ?? fallback;

  return new Intl.DateTimeFormat("en-US", { month: "long", year: "numeric" }).format(date);
}

function parsePostDate(value: string) {
  if (!/\d{4}/.test(value)) {
    return null;
  }

  const timestamp = Date.parse(value);

  if (Number.isFinite(timestamp)) {
    return new Date(timestamp);
  }

  const monthYearMatch = value.match(/^([A-Za-z]+)\s+(\d{4})$/);

  if (monthYearMatch) {
    const timestampFromMonthYear = Date.parse(`${monthYearMatch[1]} 1, ${monthYearMatch[2]}`);

    if (Number.isFinite(timestampFromMonthYear)) {
      return new Date(timestampFromMonthYear);
    }
  }

  return null;
}

async function fetchAccountSummaries(accountIds: string[]) {
  if (!accountIds.length) {
    return new Map<string, AppPostAccountRow>();
  }

  const supabase = createSupabaseBrowserClient();
  const uniqueAccountIds = Array.from(new Set(accountIds));
  const missingAccountIds = uniqueAccountIds.filter((accountId) => !accountSummaryCache.has(accountId));

  if (missingAccountIds.length) {
    const { data, error } = await supabase.from("app_accounts").select("id, username, profile_photo_url").in("id", missingAccountIds);

    if (error) {
      throw error;
    }

    (data as AppPostAccountRow[] | null)?.forEach((account) => {
      accountSummaryCache.set(account.id, account);
    });
  }

  const accounts = new Map<string, AppPostAccountRow>();

  uniqueAccountIds.forEach((accountId) => {
    const account = accountSummaryCache.get(accountId);
    if (account) {
      accounts.set(account.id, account);
    }
  });

  return accounts;
}

async function hydratePosts(posts: AppPostRow[]) {
  const accounts = await fetchAccountSummaries(posts.map((post) => post.account_id));

  return posts.map((post) => mapPost(post, accounts.get(post.account_id)));
}

function missingPostColumnName(error: unknown) {
  if (!error || typeof error !== "object") {
    return null;
  }

  const candidate = error as { code?: unknown; message?: unknown };
  const code = typeof candidate.code === "string" ? candidate.code : "";
  const message = typeof candidate.message === "string" ? candidate.message.toLowerCase() : "";

  if (code !== "42703" && !message.includes("media_") && !message.includes("media ") && !message.includes("tags")) {
    return null;
  }

  if (message.includes("tags")) {
    return "tags";
  }

  if (message.includes("media_types") || message.includes("media types")) {
    return "media_types";
  }

  if (message.includes("media_urls") || message.includes("media urls")) {
    return "media_urls";
  }

  return null;
}

type PostRowsQuery = {
  eq: (column: string, value: string) => PostRowsQuery;
  in: (column: string, values: string[]) => PostRowsQuery;
  limit: (count: number) => PostRowsQuery;
  order: (column: string, options: { ascending: boolean }) => PostRowsQuery;
  then: PromiseLike<{ data: unknown; error: unknown }>["then"];
};

type SinglePostQuery = {
  eq: (column: string, value: string) => SinglePostQuery;
  maybeSingle: () => PromiseLike<{ data: unknown; error: unknown }>;
};

async function fetchPostRows(applyQuery: (query: PostRowsQuery) => PromiseLike<{ data: unknown; error: unknown }>) {
  const supabase = createSupabaseBrowserClient();
  const { data, error } = await applyQuery(supabase.from("app_posts").select(postSelectColumns) as unknown as PostRowsQuery);

  if (!missingPostColumnName(error)) {
    if (error) {
      throw error;
    }

    return data as unknown as AppPostRow[];
  }

  const { data: mediaTypesData, error: mediaTypesError } = await applyQuery(
    supabase.from("app_posts").select(postSelectColumnsWithMediaTypes) as unknown as PostRowsQuery,
  );

  if (!missingPostColumnName(mediaTypesError)) {
    if (mediaTypesError) {
      throw mediaTypesError;
    }

    return mediaTypesData as unknown as AppPostRow[];
  }

  const { data: mediaUrlsData, error: mediaUrlsError } = await applyQuery(
    supabase.from("app_posts").select(postSelectColumnsWithMediaUrls) as unknown as PostRowsQuery,
  );

  if (!missingPostColumnName(mediaUrlsError)) {
    if (mediaUrlsError) {
      throw mediaUrlsError;
    }

    return mediaUrlsData as unknown as AppPostRow[];
  }

  const { data: baseData, error: baseError } = await applyQuery(supabase.from("app_posts").select(basePostSelectColumns) as unknown as PostRowsQuery);

  if (baseError) {
    throw baseError;
  }

  return baseData as unknown as AppPostRow[];
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
    media_urls: draft.mediaUrls?.length ? draft.mediaUrls : [],
    media_types: draft.mediaTypes?.length ? draft.mediaTypes : [],
    tags: draft.tags?.length ? draft.tags : [inferPostTagFromText(draft.title, draft.caption, draft.location)],
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

  if (missingPostColumnName(error) === "tags") {
    const mediaTypesPostInsert = {
      account_id: postInsert.account_id,
      type: postInsert.type,
      title: postInsert.title,
      location: postInsert.location,
      caption: postInsert.caption,
      image_url: postInsert.image_url,
      media_urls: postInsert.media_urls,
      media_types: postInsert.media_types,
      longitude: postInsert.longitude,
      latitude: postInsert.latitude,
      date_label: postInsert.date_label,
      visibility: postInsert.visibility,
    };
    const fallbackResponse = await supabase
      .from("app_posts")
      .insert(mediaTypesPostInsert as never)
      .select(postSelectColumnsWithMediaTypes)
      .single();

    data = fallbackResponse.data;
    error = fallbackResponse.error;
  }

  if (missingPostColumnName(error) === "media_types") {
    const mediaUrlsPostInsert = {
      account_id: postInsert.account_id,
      type: postInsert.type,
      title: postInsert.title,
      location: postInsert.location,
      caption: postInsert.caption,
      image_url: postInsert.image_url,
      media_urls: postInsert.media_urls,
      longitude: postInsert.longitude,
      latitude: postInsert.latitude,
      date_label: postInsert.date_label,
      visibility: postInsert.visibility,
    };
    const fallbackResponse = await supabase
      .from("app_posts")
      .insert(mediaUrlsPostInsert as never)
      .select(postSelectColumnsWithMediaUrls)
      .single();

    data = fallbackResponse.data;
    error = fallbackResponse.error;
  }

  if (missingPostColumnName(error) === "media_urls") {
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
    const fallbackResponse = await supabase.from("app_posts").insert(basePostInsert as never).select(basePostSelectColumns).single();

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

  return hydratePosts(await fetchPostRows((query) => query.order("created_at", { ascending: false }).limit(defaultPostFetchLimit)));
}

export async function fetchAppPostsByAccount(accountId: string) {
  assertPostsConfigured();

  return hydratePosts(await fetchPostRows((query) =>
    query
    .eq("account_id", accountId)
    .order("created_at", { ascending: false })
    .limit(defaultPostFetchLimit),
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

  if (missingPostColumnName(error)) {
    const mediaTypesResponse = await (supabase.from("app_posts").select(postSelectColumnsWithMediaTypes) as unknown as SinglePostQuery)
      .eq("id", postId)
      .maybeSingle();

    data = mediaTypesResponse.data;
    error = mediaTypesResponse.error;
  }

  if (missingPostColumnName(error)) {
    const mediaUrlsResponse = await (supabase.from("app_posts").select(postSelectColumnsWithMediaUrls) as unknown as SinglePostQuery)
      .eq("id", postId)
      .maybeSingle();

    data = mediaUrlsResponse.data;
    error = mediaUrlsResponse.error;
  }

  if (missingPostColumnName(error)) {
    const baseResponse = await (supabase.from("app_posts").select(basePostSelectColumns) as unknown as SinglePostQuery)
      .eq("id", postId)
      .maybeSingle();

    data = baseResponse.data;
    error = baseResponse.error;
  }

  if (error) {
    throw error;
  }

  return data ? (await hydratePosts([data as unknown as AppPostRow]))[0] : null;
}

export async function deleteAppPost(postId: string, accountId: string) {
  assertPostsConfigured();

  const supabase = createSupabaseBrowserClient();
  const { error } = await supabase.from("app_posts").delete().eq("id", postId).eq("account_id", accountId);

  if (error) {
    throw error;
  }
}
