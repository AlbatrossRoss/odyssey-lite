"use client";

import { createSupabaseBrowserClient, isSupabaseConfigured } from "@/lib/supabase/client";

export type AppBoard = {
  id: string;
  accountId: string;
  slug: string;
  title: string;
  subtitle: string;
  coverImageUrl: string;
  previewImageUrls: string[];
  postIds: string[];
  createdAt: string;
};

export type AppBoardDraft = {
  accountId: string;
  title: string;
  subtitle?: string;
  coverImageUrl?: string;
};

type AppBoardRow = {
  id: string;
  account_id: string;
  slug: string;
  title: string;
  subtitle: string;
  cover_image_url: string;
  created_at: string;
};

type AppBoardPostRow = {
  board_id: string;
  post_id: string;
};

type BoardPreviewPostRow = {
  id: string;
  image_url: string | null;
};

const defaultBoardCover = "/hawaii-reference-map.png";

function assertBoardsConfigured() {
  if (!isSupabaseConfigured()) {
    throw new Error("Supabase is not configured. Add NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY to use boards.");
  }
}

function mapBoard(board: AppBoardRow, boardPosts: AppBoardPostRow[] = [], previewPosts: BoardPreviewPostRow[] = []): AppBoard {
  const postIds = boardPosts.filter((item) => item.board_id === board.id).map((item) => item.post_id);
  const previewImageUrls = postIds
    .map((postId) => previewPosts.find((post) => post.id === postId)?.image_url)
    .filter((imageUrl): imageUrl is string => Boolean(imageUrl))
    .slice(0, 3);

  return {
    id: board.id,
    accountId: board.account_id,
    slug: board.slug,
    title: board.title,
    subtitle: board.subtitle,
    coverImageUrl: board.cover_image_url,
    previewImageUrls,
    postIds,
    createdAt: board.created_at,
  };
}

export function boardSlugFromTitle(title: string) {
  return (
    title
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || `board-${Date.now()}`
  );
}

async function uniqueBoardSlug(accountId: string, title: string) {
  const baseSlug = boardSlugFromTitle(title);
  const existingBoards = await fetchBoardsByAccount(accountId);
  const existingSlugs = new Set(existingBoards.map((board) => board.slug));

  if (!existingSlugs.has(baseSlug)) {
    return baseSlug;
  }

  let index = 2;
  while (existingSlugs.has(`${baseSlug}-${index}`)) {
    index += 1;
  }

  return `${baseSlug}-${index}`;
}

export async function fetchBoardsByAccount(accountId: string) {
  assertBoardsConfigured();

  const supabase = createSupabaseBrowserClient();
  const [{ data: boards, error: boardsError }, { data: boardPosts, error: postsError }] = await Promise.all([
    supabase.from("app_boards").select("*").eq("account_id", accountId).order("created_at", { ascending: true }),
    supabase.from("app_board_posts").select("board_id, post_id").order("created_at", { ascending: true }),
  ]);

  if (boardsError) {
    throw boardsError;
  }

  if (postsError) {
    throw postsError;
  }

  const boardPostRows = ((boardPosts as AppBoardPostRow[]) ?? []).filter((item) =>
    (boards as AppBoardRow[]).some((board) => board.id === item.board_id),
  );
  const postIds = Array.from(new Set(boardPostRows.map((item) => item.post_id)));
  let previewPosts: BoardPreviewPostRow[] = [];

  if (postIds.length) {
    const { data: posts, error: previewError } = await supabase.from("app_posts").select("id, image_url").in("id", postIds);

    if (previewError) {
      throw previewError;
    }

    previewPosts = posts as BoardPreviewPostRow[];
  }

  return (boards as AppBoardRow[]).map((board) => mapBoard(board, boardPostRows, previewPosts));
}

export async function fetchBoardBySlug(accountId: string, slug: string) {
  const boards = await fetchBoardsByAccount(accountId);

  return boards.find((board) => board.slug === slug) ?? null;
}

export async function createAppBoard({ accountId, title, subtitle = "", coverImageUrl = defaultBoardCover }: AppBoardDraft) {
  assertBoardsConfigured();

  const supabase = createSupabaseBrowserClient();
  const slug = await uniqueBoardSlug(accountId, title);
  const { data, error } = await supabase
    .from("app_boards")
    .insert({
      account_id: accountId,
      slug,
      title: title.trim(),
      subtitle: subtitle.trim(),
      cover_image_url: coverImageUrl,
    })
    .select("*")
    .single();

  if (error) {
    throw error;
  }

  return mapBoard(data as AppBoardRow);
}

export async function updateAppBoard(boardId: string, updates: { title: string; subtitle: string }) {
  assertBoardsConfigured();

  const supabase = createSupabaseBrowserClient();
  const { data, error } = await supabase
    .from("app_boards")
    .update({
      title: updates.title.trim(),
      subtitle: updates.subtitle.trim(),
    })
    .eq("id", boardId)
    .select("*")
    .single();

  if (error) {
    throw error;
  }

  return mapBoard(data as AppBoardRow);
}

export async function deleteAppBoard(boardId: string) {
  assertBoardsConfigured();

  const supabase = createSupabaseBrowserClient();
  const { error } = await supabase.from("app_boards").delete().eq("id", boardId);

  if (error) {
    throw error;
  }
}

export async function savePostToBoard(boardId: string, postId: string, coverImageUrl?: string) {
  assertBoardsConfigured();

  const supabase = createSupabaseBrowserClient();
  const { error } = await supabase.from("app_board_posts").upsert({ board_id: boardId, post_id: postId }, { onConflict: "board_id,post_id" });

  if (error) {
    throw error;
  }

  if (coverImageUrl) {
    await supabase.from("app_boards").update({ cover_image_url: coverImageUrl }).eq("id", boardId).eq("cover_image_url", defaultBoardCover);
  }
}
