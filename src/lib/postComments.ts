"use client";

import { createSupabaseBrowserClient, isSupabaseConfigured } from "@/lib/supabase/client";

export type AppPostComment = {
  id: string;
  postId: string;
  accountId: string;
  username: string;
  profilePhotoUrl: string | null;
  body: string;
  replyToCommentId: string | null;
  createdAt: string;
};

export type AppCommentNotification = AppPostComment & {
  isRead: boolean;
  postTitle: string;
};

type AppPostCommentRow = {
  id: string;
  post_id: string;
  account_id: string;
  body: string;
  reply_to_comment_id?: string | null;
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

function commentReplyColumnMissing(error: unknown) {
  if (!error || typeof error !== "object") {
    return false;
  }

  const candidate = error as { code?: unknown; message?: unknown };
  const code = typeof candidate.code === "string" ? candidate.code : "";
  const message = typeof candidate.message === "string" ? candidate.message.toLowerCase() : "";

  return code === "42703" || message.includes("reply_to_comment_id");
}

function mapComment(comment: AppPostCommentRow, account?: CommentAccountRow): AppPostComment {
  return {
    id: comment.id,
    postId: comment.post_id,
    accountId: comment.account_id,
    username: account?.username ?? "traveler",
    profilePhotoUrl: account?.profile_photo_url ?? null,
    body: comment.body,
    replyToCommentId: comment.reply_to_comment_id ?? null,
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

async function addReplyTargets(comments: AppPostCommentRow[]) {
  if (!comments.length) {
    return comments;
  }

  const supabase = createSupabaseBrowserClient();
  const commentIds = comments.map((comment) => comment.id);
  const { data, error } = await supabase.from("app_post_comments").select("id, reply_to_comment_id").in("id", commentIds);

  if (error) {
    if (commentReplyColumnMissing(error) || commentsTableMissing(error)) {
      return comments;
    }

    throw error;
  }

  const replyTargetsById = new Map(((data ?? []) as Array<{ id: string; reply_to_comment_id: string | null }>).map((comment) => [comment.id, comment.reply_to_comment_id]));

  return comments.map((comment) => ({
    ...comment,
    reply_to_comment_id: replyTargetsById.get(comment.id) ?? null,
  }));
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

  return hydrateComments(await addReplyTargets((data ?? []) as AppPostCommentRow[]));
}

export async function createPostComment({
  accountId,
  body,
  postId,
  replyToCommentId = null,
}: {
  accountId: string;
  body: string;
  postId: string;
  replyToCommentId?: string | null;
}) {
  assertCommentsConfigured();

  const trimmedBody = body.trim();

  if (!trimmedBody) {
    throw new Error("Add a comment before posting.");
  }

  if (trimmedBody.length > 500) {
    throw new Error("Comments must be 500 characters or fewer.");
  }

  const supabase = createSupabaseBrowserClient();
  const insertComment = (includeReplyColumn: boolean) =>
    supabase
      .from("app_post_comments")
      .insert({
        account_id: accountId,
        body: trimmedBody,
        post_id: postId,
        ...(includeReplyColumn ? { reply_to_comment_id: replyToCommentId } : {}),
      })
      .select(includeReplyColumn ? "id, post_id, account_id, body, reply_to_comment_id, created_at" : "id, post_id, account_id, body, created_at")
      .single();
  let { data, error } = await insertComment(true);

  if (commentReplyColumnMissing(error)) {
    const fallback = await insertComment(false);
    data = fallback.data;
    error = fallback.error;
  }

  if (commentsTableMissing(error)) {
    throw new Error("Comments are not set up yet. Run the 0009_app_post_comments Supabase migration, then try again.");
  }

  if (error) {
    throw error;
  }

  const createdRow = data as unknown as AppPostCommentRow;

  return (await hydrateComments([{ ...createdRow, reply_to_comment_id: createdRow.reply_to_comment_id ?? replyToCommentId }]))[0];
}

export async function fetchUnreadCommentNotifications(accountId: string) {
  return (await fetchCommentNotifications(accountId)).filter((notification) => !notification.isRead);
}

export async function fetchCommentNotifications(accountId: string) {
  assertCommentsConfigured();

  const supabase = createSupabaseBrowserClient();
  const { data: account, error: accountError } = await supabase.from("app_accounts").select("username").eq("id", accountId).maybeSingle();

  if (accountError) {
    throw accountError;
  }

  const username = typeof account?.username === "string" ? account.username : "";
  const mention = username ? `@${username.toLowerCase()}` : "";
  const { data: ownedPostsData, error: postsError } = await supabase.from("app_posts").select("id, title").eq("account_id", accountId);

  if (postsError) {
    throw postsError;
  }

  const ownedPosts = (ownedPostsData ?? []) as CommentPostRow[];
  const ownedPostIds = new Set(ownedPosts.map((post) => post.id));
  const { data: comments, error: commentsError } = await supabase
    .from("app_post_comments")
    .select("id, post_id, account_id, body, created_at")
    .neq("account_id", accountId)
    .order("created_at", { ascending: false })
    .limit(80);

  if (commentsTableMissing(commentsError)) {
    return [];
  }

  if (commentsError) {
    throw commentsError;
  }

  const allCommentRows = await addReplyTargets((comments ?? []) as AppPostCommentRow[]);
  const replyParentIds = Array.from(new Set(allCommentRows.map((comment) => comment.reply_to_comment_id).filter((id): id is string => Boolean(id))));
  let repliedToCommentIds = new Set<string>();

  if (replyParentIds.length) {
    const { data: replyParents, error: replyParentsError } = await supabase
      .from("app_post_comments")
      .select("id")
      .eq("account_id", accountId)
      .in("id", replyParentIds);

    if (replyParentsError && !commentsTableMissing(replyParentsError)) {
      throw replyParentsError;
    }

    repliedToCommentIds = new Set(((replyParents ?? []) as Array<{ id: string }>).map((comment) => comment.id));
  }

  const commentRows = allCommentRows.filter(
    (comment) =>
      ownedPostIds.has(comment.post_id) ||
      (mention ? comment.body.toLowerCase().includes(mention) : false) ||
      (comment.reply_to_comment_id ? repliedToCommentIds.has(comment.reply_to_comment_id) : false),
  );

  if (!commentRows.length) {
    return [];
  }

  const allPostIds = Array.from(new Set(commentRows.map((comment) => comment.post_id)));
  const missingPostIds = allPostIds.filter((postId) => !ownedPostIds.has(postId));
  let mentionedPosts: CommentPostRow[] = [];

  if (missingPostIds.length) {
    const { data: posts, error: mentionedPostsError } = await supabase.from("app_posts").select("id, title").in("id", missingPostIds);

    if (mentionedPostsError) {
      throw mentionedPostsError;
    }

    mentionedPosts = (posts ?? []) as CommentPostRow[];
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
  const hydratedComments = await hydrateComments(commentRows);
  const postsById = new Map([...ownedPosts, ...mentionedPosts].map((post) => [post.id, post]));

  return hydratedComments.map((comment) => ({
    ...comment,
    isRead: readCommentIds.has(comment.id),
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
