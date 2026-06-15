"use client";

import { createSupabaseBrowserClient, isSupabaseConfigured } from "@/lib/supabase/client";

export type AppPostComment = {
  id: string;
  postId: string;
  accountId: string;
  username: string;
  profilePhotoUrl: string | null;
  body: string;
  createdAt: string;
};

export type AppCommentNotification = AppPostComment & {
  postTitle: string;
};

type AppPostCommentRow = {
  id: string;
  post_id: string;
  account_id: string;
  body: string;
  created_at: string;
};

type CommentAccountRow = {
  id: string;
  username?: string;
  profile_photo_url?: string | null;
};

type CommentPostRow = {
  id: string;
  title: string;
};

function assertCommentsConfigured() {
  if (!isSupabaseConfigured()) {
    throw new Error("Supabase is not configured. Add NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY to use comments.");
  }
}

function commentsTableMissing(error: unknown) {
  if (!error || typeof error !== "object") {
    return false;
  }

  const candidate = error as { code?: unknown; message?: unknown };
  const code = typeof candidate.code === "string" ? candidate.code : "";
  const message = typeof candidate.message === "string" ? candidate.message.toLowerCase() : "";

  return code === "42P01" || code === "PGRST205" || message.includes("app_post_comments");
}

function commentReadsTableMissing(error: unknown) {
  if (!error || typeof error !== "object") {
    return false;
  }

  const candidate = error as { code?: unknown; message?: unknown };
  const code = typeof candidate.code === "string" ? candidate.code : "";
  const message = typeof candidate.message === "string" ? candidate.message.toLowerCase() : "";

  return code === "42P01" || code === "PGRST205" || message.includes("app_post_comment_reads");
}

function mapComment(comment: AppPostCommentRow, account?: CommentAccountRow): AppPostComment {
  return {
    id: comment.id,
    postId: comment.post_id,
    accountId: comment.account_id,
    username: account?.username ?? "traveler",
    profilePhotoUrl: account?.profile_photo_url ?? null,
    body: comment.body,
    createdAt: comment.created_at,
  };
}

async function hydrateComments(comments: AppPostCommentRow[]) {
  if (!comments.length) {
    return [];
  }

  const supabase = createSupabaseBrowserClient();
  const accountIds = Array.from(new Set(comments.map((comment) => comment.account_id)));
  const { data, error } = await supabase.from("app_accounts").select("id, username, profile_photo_url").in("id", accountIds);

  if (error) {
    throw error;
  }

  const accounts = new Map((data as CommentAccountRow[] | null)?.map((account) => [account.id, account]) ?? []);

  return comments.map((comment) => mapComment(comment, accounts.get(comment.account_id)));
}

export async function fetchPostComments(postId: string) {
  assertCommentsConfigured();

  const supabase = createSupabaseBrowserClient();
  const { data, error } = await supabase
    .from("app_post_comments")
    .select("id, post_id, account_id, body, created_at")
    .eq("post_id", postId)
    .order("created_at", { ascending: false });

  if (commentsTableMissing(error)) {
    return [];
  }

  if (error) {
    throw error;
  }

  return hydrateComments((data ?? []) as AppPostCommentRow[]);
}

export async function createPostComment({ accountId, body, postId }: { accountId: string; body: string; postId: string }) {
  assertCommentsConfigured();

  const trimmedBody = body.trim();

  if (!trimmedBody) {
    throw new Error("Add a comment before posting.");
  }

  if (trimmedBody.length > 500) {
    throw new Error("Comments must be 500 characters or fewer.");
  }

  const supabase = createSupabaseBrowserClient();
  const { data, error } = await supabase
    .from("app_post_comments")
    .insert({
      account_id: accountId,
      body: trimmedBody,
      post_id: postId,
    })
    .select("id, post_id, account_id, body, created_at")
    .single();

  if (commentsTableMissing(error)) {
    throw new Error("Comments are not set up yet. Run the 0009_app_post_comments Supabase migration, then try again.");
  }

  if (error) {
    throw error;
  }

  return (await hydrateComments([data as AppPostCommentRow]))[0];
}

export async function fetchUnreadCommentNotifications(accountId: string) {
  assertCommentsConfigured();

  const supabase = createSupabaseBrowserClient();
  const { data: posts, error: postsError } = await supabase.from("app_posts").select("id, title").eq("account_id", accountId);

  if (postsError) {
    throw postsError;
  }

  const ownedPosts = (posts ?? []) as CommentPostRow[];

  if (!ownedPosts.length) {
    return [];
  }

  const postIds = ownedPosts.map((post) => post.id);
  const { data: comments, error: commentsError } = await supabase
    .from("app_post_comments")
    .select("id, post_id, account_id, body, created_at")
    .in("post_id", postIds)
    .neq("account_id", accountId)
    .order("created_at", { ascending: false });

  if (commentsTableMissing(commentsError)) {
    return [];
  }

  if (commentsError) {
    throw commentsError;
  }

  const commentRows = (comments ?? []) as AppPostCommentRow[];

  if (!commentRows.length) {
    return [];
  }

  const { data: reads, error: readsError } = await supabase
    .from("app_post_comment_reads")
    .select("comment_id")
    .eq("account_id", accountId)
    .in(
      "comment_id",
      commentRows.map((comment) => comment.id),
    );

  if (readsError && !commentReadsTableMissing(readsError)) {
    throw readsError;
  }

  const readCommentIds = new Set(((reads ?? []) as Array<{ comment_id: string }>).map((read) => read.comment_id));
  const unreadRows = commentRows.filter((comment) => !readCommentIds.has(comment.id));
  const hydratedComments = await hydrateComments(unreadRows);
  const postsById = new Map(ownedPosts.map((post) => [post.id, post]));

  return hydratedComments.map((comment) => ({
    ...comment,
    postTitle: postsById.get(comment.postId)?.title ?? "your post",
  }));
}

export async function markCommentNotificationsRead(accountId: string, commentIds: string[]) {
  assertCommentsConfigured();

  if (!commentIds.length) {
    return;
  }

  const supabase = createSupabaseBrowserClient();
  const { error } = await supabase.from("app_post_comment_reads").upsert(
    commentIds.map((commentId) => ({
      account_id: accountId,
      comment_id: commentId,
    })),
  );

  if (error && !commentReadsTableMissing(error)) {
    throw error;
  }
}
