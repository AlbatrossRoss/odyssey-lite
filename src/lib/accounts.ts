"use client";

import { createSupabaseBrowserClient, isSupabaseConfigured } from "@/lib/supabase/client";

export type AppAccount = {
  id: string;
  username: string;
  password: string;
  profilePhotoUrl: string | null;
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

const SESSION_KEY = "odyssey-lite-account-id";

function mapAccount(account: {
  id: string;
  username: string;
  password: string;
  profile_photo_url: string | null;
  created_at: string;
}): AppAccount {
  return {
    id: account.id,
    username: account.username,
    password: account.password,
    profilePhotoUrl: account.profile_photo_url,
    createdAt: account.created_at,
  };
}

export function readAccountSessionId() {
  if (typeof window === "undefined") {
    return null;
  }

  return window.localStorage.getItem(SESSION_KEY);
}

export function writeAccountSessionId(accountId: string) {
  window.localStorage.setItem(SESSION_KEY, accountId);
  window.dispatchEvent(new CustomEvent("odyssey:account-session-changed", { detail: accountId }));
}

export function clearAccountSessionId() {
  window.localStorage.removeItem(SESSION_KEY);
  window.dispatchEvent(new CustomEvent("odyssey:account-session-changed"));
}

export function assertAccountsConfigured() {
  if (!isSupabaseConfigured()) {
    throw new Error("Supabase is not configured. Add NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY to use accounts.");
  }
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

export function normalizeUsername(username: string) {
  return username.trim().replace(/^@+/, "").toLowerCase();
}

export function accountDisplayName(account: Pick<AppAccount, "username">) {
  return `@${account.username}`;
}
