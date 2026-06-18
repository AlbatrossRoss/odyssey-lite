"use client";

import { createSupabaseBrowserClient, isSupabaseConfigured } from "@/lib/supabase/client";

export type AppPostLikeSummary = {
  count: number;
  isLikedByViewer: boolean;
};

export type AppLikeNotification = {
  accountId: string;
  createdAt: string;
  id: string;
  isRead: boolean;
  postId: string;
  postTitle: string;
  profilePhotoUrl: string | null;
  type: "like";
  username: string;
};

type AppPostLikeRow = {
  id: string;
  post_id: string;
  account_id: string;
  created_at: string;
};

type LikeAccountRow = {
  id: string;
  username?: string;
  profile_photo_url?: string | null;
};

type LikePostRow = {
  id: string;
  title: string;
};

function assertLikesConfigured() {
  if (!isSupabaseConfigured()) {
    throw new Error("Supabase is not configured. Add NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY to use likes.");
  }
}

function likesTableMissing(error: unknown) {
  if (!error || typeof error !== "object") {
    return false;
  }

  const candidate = error as { code?: unknown; message?: unknown };
  const code = typeof candidate.code === "string" ? candidate.code : "";
  const message = typeof candidate.message === "string" ? candidate.message.toLowerCase() : "";

  return code === "42P01" || code === "PGRST205" || message.includes("app_post_likes");
}

function likeReadsTableMissing(error: unknown) {
  if (!error || typeof error !== "object") {
    return false;
  }

  const candidate = error as { code?: unknown; message?: unknown };
  const code = typeof candidate.code === "string" ? candidate.code : "";
  const message = typeof candidate.message === "string" ? candidate.message.toLowerCase() : "";

  return code === "42P01" || code === "PGRST205" || message.includes("app_post_like_reads");
}

export async function fetchPostLikeSummary(postId: string, viewerId: string | null): Promise<AppPostLikeSummary> {
  assertLikesConfigured();

  const supabase = createSupabaseBrowserClient();
  const [countResponse, viewerResponse] = await Promise.all([
    supabase.from("app_post_likes").select("*", { count: "exact", head: true }).eq("post_id", postId),
    viewerId
      ? supabase.from("app_post_likes").select("id", { count: "exact", head: true }).eq("post_id", postId).eq("account_id", viewerId)
      : Promise.resolve({ count: 0, error: null }),
  ]);

  if (likesTableMissing(countResponse.error) || likesTableMissing(viewerResponse.error)) {
    return { count: 0, isLikedByViewer: false };
  }

  if (countResponse.error) throw countResponse.error;
  if (viewerResponse.error) throw viewerResponse.error;

  return {
    count: countResponse.count ?? 0,
    isLikedByViewer: (viewerResponse.count ?? 0) > 0,
  };
}

export async function setPostLike(postId: string, accountId: string, shouldLike: boolean) {
  assertLikesConfigured();

  const supabase = createSupabaseBrowserClient();

  if (shouldLike) {
    const { error } = await supabase
      .from("app_post_likes")
      .upsert({ account_id: accountId, post_id: postId } as never, { onConflict: "post_id,account_id" });

    if (likesTableMissing(error)) {
      throw new Error("Likes are not set up yet. Run the 0013_app_post_likes Supabase migration, then try again.");
    }

    if (error) throw error;
    return;
  }

  const { error } = await supabase.from("app_post_likes").delete().eq("account_id", accountId).eq("post_id", postId);

  if (likesTableMissing(error)) {
    throw new Error("Likes are not set up yet. Run the 0013_app_post_likes Supabase migration, then try again.");
  }

  if (error) throw error;
}

export async function fetchLikeNotifications(accountId: string) {
  assertLikesConfigured();

  const supabase = createSupabaseBrowserClient();
  const { data: ownedPostsData, error: postsError } = await supabase.from("app_posts").select("id, title").eq("account_id", accountId);

  if (postsError) {
    throw postsError;
  }

  const ownedPosts = (ownedPostsData ?? []) as LikePostRow[];
  const ownedPostIds = ownedPosts.map((post) => post.id);

  if (!ownedPostIds.length) {
    return [];
  }

  const { data: likes, error: likesError } = await supabase
    .from("app_post_likes")
    .select("id, post_id, account_id, created_at")
    .in("post_id", ownedPostIds)
    .neq("account_id", accountId)
    .order("created_at", { ascending: false })
    .limit(80);

  if (likesTableMissing(likesError)) {
    return [];
  }

  if (likesError) {
    throw likesError;
  }

  const likeRows = (likes ?? []) as AppPostLikeRow[];

  if (!likeRows.length) {
    return [];
  }

  const [accountsResponse, readsResponse] = await Promise.all([
    supabase.from("app_accounts").select("id, username, profile_photo_url").in("id", Array.from(new Set(likeRows.map((like) => like.account_id)))),
    supabase.from("app_post_like_reads").select("like_id").eq("account_id", accountId).in("like_id", likeRows.map((like) => like.id)),
  ]);

  if (accountsResponse.error) {
    throw accountsResponse.error;
  }

  if (readsResponse.error && !likeReadsTableMissing(readsResponse.error)) {
    throw readsResponse.error;
  }

  const accounts = new Map(((accountsResponse.data ?? []) as LikeAccountRow[]).map((account) => [account.id, account]));
  const readLikeIds = new Set(((readsResponse.data ?? []) as Array<{ like_id: string }>).map((read) => read.like_id));
  const postsById = new Map(ownedPosts.map((post) => [post.id, post]));

  return likeRows.map((like): AppLikeNotification => {
    const account = accounts.get(like.account_id);

    return {
      accountId: like.account_id,
      createdAt: like.created_at,
      id: like.id,
      isRead: readLikeIds.has(like.id),
      postId: like.post_id,
      postTitle: postsById.get(like.post_id)?.title ?? "your recommendation",
      profilePhotoUrl: account?.profile_photo_url ?? null,
      type: "like",
      username: account?.username ?? "traveler",
    };
  });
}

export async function markLikeNotificationsRead(accountId: string, likeIds: string[]) {
  assertLikesConfigured();

  if (!likeIds.length) {
    return;
  }

  const supabase = createSupabaseBrowserClient();
  const { error } = await supabase.from("app_post_like_reads").upsert(
    likeIds.map((likeId) => ({
      account_id: accountId,
      like_id: likeId,
    })) as never,
  );

  if (error && !likeReadsTableMissing(error)) {
    throw error;
  }
}
