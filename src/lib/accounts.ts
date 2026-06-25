"use client";

import { createSupabaseBrowserClient, isSupabaseConfigured } from "@/lib/supabase/client";

export type AppAccount = {
  id: string;
  username: string;
  password: string;
  profilePhotoUrl: string | null;
  currentCity: string | null;
  currentCityCoordinates: [number, number] | null;
  createdAt: string;
};

export type AccountStats = {
  followers: number;
  following: number;
  posts: number;
};

export type AccountWithStats = AppAccount & {
  stats: AccountStats;
  isFollowedByViewer: boolean;
};

export type AppFollowNotification = {
  accountId: string;
  createdAt: string;
  followId: string;
  id: string;
  isRead: boolean;
  profilePhotoUrl: string | null;
  type: "follow";
  username: string;
};

const SESSION_KEY = "odyssey-lite-account-id";
const sessionCookieMaxAge = 60 * 60 * 24 * 365;

function mapAccount(account: {
  id: string;
  username: string;
  password: string;
  profile_photo_url: string | null;
  current_city?: string | null;
  current_city_longitude?: number | null;
  current_city_latitude?: number | null;
  created_at: string;
}): AppAccount {
  const longitude = account.current_city_longitude;
  const latitude = account.current_city_latitude;

  return {
    id: account.id,
    username: account.username,
    password: account.password,
    profilePhotoUrl: account.profile_photo_url,
    currentCity: account.current_city ?? null,
    currentCityCoordinates:
      typeof longitude === "number" && typeof latitude === "number" && Number.isFinite(longitude) && Number.isFinite(latitude)
        ? [longitude, latitude]
        : null,
    createdAt: account.created_at,
  };
}

export function readAccountSessionId() {
  if (typeof window === "undefined") {
    return null;
  }

  try {
    const storedSessionId = window.localStorage.getItem(SESSION_KEY);

    if (storedSessionId) {
      return storedSessionId;
    }
  } catch {
    // Fall back to the cookie below if localStorage is unavailable.
  }

  return readAccountSessionCookie();
}

export function writeAccountSessionId(accountId: string) {
  try {
    window.localStorage.setItem(SESSION_KEY, accountId);
  } catch {
    // Keep the account in the database even if browser storage is unavailable.
  }

  writeAccountSessionCookie(accountId);

  window.dispatchEvent(new CustomEvent("odyssey:account-session-changed", { detail: accountId }));
}

export function clearAccountSessionId() {
  try {
    window.localStorage.removeItem(SESSION_KEY);
  } catch {
    // Nothing to clear when browser storage is unavailable.
  }

  clearAccountSessionCookie();

  window.dispatchEvent(new CustomEvent("odyssey:account-session-changed"));
}

function readAccountSessionCookie() {
  if (typeof document === "undefined") {
    return null;
  }

  const sessionCookie = document.cookie
    .split(";")
    .map((cookie) => cookie.trim())
    .find((cookie) => cookie.startsWith(`${SESSION_KEY}=`));

  return sessionCookie ? decodeURIComponent(sessionCookie.slice(SESSION_KEY.length + 1)) : null;
}

function writeAccountSessionCookie(accountId: string) {
  if (typeof document === "undefined") {
    return;
  }

  document.cookie = `${SESSION_KEY}=${encodeURIComponent(accountId)}; max-age=${sessionCookieMaxAge}; path=/; samesite=lax`;
}

function clearAccountSessionCookie() {
  if (typeof document === "undefined") {
    return;
  }

  document.cookie = `${SESSION_KEY}=; max-age=0; path=/; samesite=lax`;
}

export function assertAccountsConfigured() {
  if (!isSupabaseConfigured()) {
    throw new Error("Supabase is not configured. Add NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY to use accounts.");
  }
}

function followReadsTableMissing(error: unknown) {
  if (!error || typeof error !== "object") {
    return false;
  }

  const candidate = error as { code?: unknown; message?: unknown };
  const code = typeof candidate.code === "string" ? candidate.code : "";
  const message = typeof candidate.message === "string" ? candidate.message.toLowerCase() : "";

  return code === "42P01" || code === "PGRST205" || message.includes("account_follow_reads");
}

export async function fetchAccountById(accountId: string) {
  assertAccountsConfigured();

  const supabase = createSupabaseBrowserClient();
  const { data, error } = await supabase.from("app_accounts").select("*").eq("id", accountId).maybeSingle();

  if (error) {
    throw error;
  }

  return data ? mapAccount(data) : null;
}

export async function fetchAccountByUsername(username: string) {
  assertAccountsConfigured();

  const supabase = createSupabaseBrowserClient();
  const { data, error } = await supabase.from("app_accounts").select("*").eq("username", normalizeUsername(username)).maybeSingle();

  if (error) {
    throw error;
  }

  return data ? mapAccount(data) : null;
}

export async function createAccount({
  username,
  password,
  profilePhotoUrl,
}: {
  username: string;
  password: string;
  profilePhotoUrl?: string | null;
}) {
  assertAccountsConfigured();

  const supabase = createSupabaseBrowserClient();
  const normalizedUsername = normalizeUsername(username);
  const { data, error } = await supabase
    .from("app_accounts")
    .insert({
      username: normalizedUsername,
      password,
      profile_photo_url: profilePhotoUrl ?? null,
    })
    .select("*")
    .single();

  if (error) {
    throw error;
  }

  return mapAccount(data);
}

export async function loginAccount(username: string, password: string) {
  assertAccountsConfigured();

  const supabase = createSupabaseBrowserClient();
  const { data, error } = await supabase
    .from("app_accounts")
    .select("*")
    .eq("username", normalizeUsername(username))
    .eq("password", password)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return data ? mapAccount(data) : null;
}

export async function updateAccountPhoto(accountId: string, profilePhotoUrl: string | null) {
  assertAccountsConfigured();

  const supabase = createSupabaseBrowserClient();
  const { data, error } = await supabase
    .from("app_accounts")
    .update({ profile_photo_url: profilePhotoUrl })
    .eq("id", accountId)
    .select("*")
    .single();

  if (error) {
    throw error;
  }

  return mapAccount(data);
}

export async function updateAccountCurrentCity(accountId: string, currentCity: string, coordinates?: [number, number]) {
  assertAccountsConfigured();

  const supabase = createSupabaseBrowserClient();
  const { data, error } = await supabase
    .from("app_accounts")
    .update({
      current_city: currentCity.trim() || null,
      current_city_longitude: coordinates?.[0] ?? null,
      current_city_latitude: coordinates?.[1] ?? null,
    })
    .eq("id", accountId)
    .select("*")
    .single();

  if (error) {
    throw error;
  }

  return mapAccount(data);
}

export async function fetchAccountsWithStats(viewerId: string) {
  assertAccountsConfigured();

  const supabase = createSupabaseBrowserClient();
  const [{ data: accounts, error: accountsError }, { data: follows, error: followsError }, { data: posts, error: postsError }] =
    await Promise.all([
      supabase.from("app_accounts").select("*").order("created_at", { ascending: true }),
      supabase.from("account_follows").select("follower_id, following_id"),
      supabase.from("app_posts").select("account_id"),
    ]);

  if (accountsError) {
    throw accountsError;
  }

  if (followsError) {
    throw followsError;
  }

  const accountPosts = postsError ? [] : posts;

  return accounts.map((account) => {
    const mapped = mapAccount(account);

    return {
      ...mapped,
      stats: {
        followers: follows.filter((follow) => follow.following_id === mapped.id).length,
        following: follows.filter((follow) => follow.follower_id === mapped.id).length,
        posts: accountPosts.filter((post) => post.account_id === mapped.id).length,
      },
      isFollowedByViewer: follows.some((follow) => follow.follower_id === viewerId && follow.following_id === mapped.id),
    };
  });
}

export async function fetchAccountsForSearch() {
  assertAccountsConfigured();

  const supabase = createSupabaseBrowserClient();
  const { data, error } = await supabase.from("app_accounts").select("*").order("username", { ascending: true }).limit(80);

  if (error) {
    throw error;
  }

  return (data ?? []).map(mapAccount);
}

export async function fetchAccountWithStats(accountId: string, viewerId: string | null = accountId) {
  const account = await fetchAccountById(accountId);

  if (!account) {
    return null;
  }

  return withStats(account, viewerId);
}

export async function fetchAccountByUsernameWithStats(username: string, viewerId: string | null) {
  const account = await fetchAccountByUsername(username);

  if (!account) {
    return null;
  }

  return withStats(account, viewerId);
}

async function withStats(account: AppAccount, viewerId: string | null): Promise<AccountWithStats> {
  assertAccountsConfigured();

  const supabase = createSupabaseBrowserClient();
  const [followers, following, posts, followedByViewer] = await Promise.all([
    supabase.from("account_follows").select("*", { count: "exact", head: true }).eq("following_id", account.id),
    supabase.from("account_follows").select("*", { count: "exact", head: true }).eq("follower_id", account.id),
    supabase.from("app_posts").select("*", { count: "exact", head: true }).eq("account_id", account.id),
    viewerId && viewerId !== account.id
      ? supabase
        .from("account_follows")
        .select("follower_id", { count: "exact", head: true })
        .eq("follower_id", viewerId)
        .eq("following_id", account.id)
      : Promise.resolve({ count: 0, error: null }),
  ]);

  if (followers.error) throw followers.error;
  if (following.error) throw following.error;
  if (posts.error) throw posts.error;
  if (followedByViewer.error) throw followedByViewer.error;

  return {
    ...account,
    stats: {
      followers: followers.count ?? 0,
      following: following.count ?? 0,
      posts: posts.count ?? 0,
    },
    isFollowedByViewer: (followedByViewer.count ?? 0) > 0,
  };
}

export async function setAccountFollow(viewerId: string, accountId: string, shouldFollow: boolean) {
  assertAccountsConfigured();

  const supabase = createSupabaseBrowserClient();

  if (shouldFollow) {
    const { error } = await supabase.from("account_follows").upsert({
      follower_id: viewerId,
      following_id: accountId,
    });

    if (error) {
      throw error;
    }

    return;
  }

  const { error } = await supabase
    .from("account_follows")
    .delete()
    .eq("follower_id", viewerId)
    .eq("following_id", accountId);

  if (error) {
    throw error;
  }
}

export async function fetchFollowingIds(viewerId: string) {
  assertAccountsConfigured();

  const supabase = createSupabaseBrowserClient();
  const { data, error } = await supabase.from("account_follows").select("following_id").eq("follower_id", viewerId);

  if (error) {
    throw error;
  }

  return data.map((follow) => follow.following_id);
}

export async function fetchAccountConnections(accountId: string, type: "followers" | "following") {
  assertAccountsConfigured();

  const supabase = createSupabaseBrowserClient();
  const relationColumn = type === "followers" ? "following_id" : "follower_id";
  const accountColumn = type === "followers" ? "follower_id" : "following_id";
  const { data: follows, error: followsError } = await supabase
    .from("account_follows")
    .select("follower_id, following_id")
    .eq(relationColumn, accountId);

  if (followsError) {
    throw followsError;
  }

  const accountIds = follows.map((follow) => follow[accountColumn]);

  if (!accountIds.length) {
    return [];
  }

  const { data: accounts, error: accountsError } = await supabase.from("app_accounts").select("*").in("id", accountIds);

  if (accountsError) {
    throw accountsError;
  }

  const accountsById = new Map(accounts.map((account) => [account.id, mapAccount(account)]));

  return accountIds.map((id) => accountsById.get(id)).filter((account): account is AppAccount => Boolean(account));
}

export async function fetchFollowNotifications(accountId: string) {
  assertAccountsConfigured();

  const supabase = createSupabaseBrowserClient();
  const { data: follows, error: followsError } = await supabase
    .from("account_follows")
    .select("id, follower_id, following_id, created_at")
    .eq("following_id", accountId)
    .neq("follower_id", accountId)
    .order("created_at", { ascending: false })
    .limit(80);

  if (followsError) {
    throw followsError;
  }

  const followRows = (follows ?? []) as Array<{ id: string; follower_id: string; following_id: string; created_at: string }>;

  if (!followRows.length) {
    return [];
  }

  const [accountsResponse, readsResponse] = await Promise.all([
    supabase.from("app_accounts").select("id, username, profile_photo_url").in("id", Array.from(new Set(followRows.map((follow) => follow.follower_id)))),
    supabase.from("account_follow_reads").select("follow_id").eq("account_id", accountId).in("follow_id", followRows.map((follow) => follow.id)),
  ]);

  if (accountsResponse.error) {
    throw accountsResponse.error;
  }

  if (readsResponse.error && !followReadsTableMissing(readsResponse.error)) {
    throw readsResponse.error;
  }

  const accounts = new Map(
    ((accountsResponse.data ?? []) as Array<{ id: string; username?: string; profile_photo_url?: string | null }>).map((account) => [account.id, account]),
  );
  const readFollowIds = new Set(((readsResponse.data ?? []) as Array<{ follow_id: string }>).map((read) => read.follow_id));

  return followRows.map((follow): AppFollowNotification => {
    const account = accounts.get(follow.follower_id);

    return {
      accountId: follow.follower_id,
      createdAt: follow.created_at,
      followId: follow.id,
      id: follow.id,
      isRead: readFollowIds.has(follow.id),
      profilePhotoUrl: account?.profile_photo_url ?? null,
      type: "follow",
      username: account?.username ?? "traveler",
    };
  });
}

export async function markFollowNotificationsRead(accountId: string, followIds: string[]) {
  assertAccountsConfigured();

  if (!followIds.length) {
    return;
  }

  const supabase = createSupabaseBrowserClient();
  const { error } = await supabase.from("account_follow_reads").upsert(
    followIds.map((followId) => ({
      account_id: accountId,
      follow_id: followId,
    })) as never,
  );

  if (error && !followReadsTableMissing(error)) {
    throw error;
  }
}

export function normalizeUsername(username: string) {
  return username.trim().replace(/^@+/, "").toLowerCase();
}

export function accountDisplayName(account: Pick<AppAccount, "username">) {
  return `@${account.username}`;
}
