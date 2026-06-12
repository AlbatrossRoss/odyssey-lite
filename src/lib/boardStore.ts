import type { Board } from "@/lib/data";

const boardsKey = "odyssey:boards";

export function slugifyBoardTitle(title: string) {
  const slug = title
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");

  return slug || `board-${Date.now()}`;
}

export function readBoards() {
  if (typeof window === "undefined") {
    return [];
  }

  try {
    const stored = window.localStorage.getItem(boardsKey);
    return stored ? (JSON.parse(stored) as Board[]) : [];
  } catch {
    return [];
  }
}

export function writeBoards(boards: Board[]) {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(boardsKey, JSON.stringify(boards));
}

export function createBoardDraft(title: string, subtitle: string, existingBoards: Board[]): Board {
  const baseSlug = slugifyBoardTitle(title);
  const existingSlugs = new Set(existingBoards.map((board) => board.slug));
  let slug = baseSlug;
  let suffix = 2;

  while (existingSlugs.has(slug)) {
    slug = `${baseSlug}-${suffix}`;
    suffix += 1;
  }

  return {
    id: `board-${Date.now()}`,
    slug,
    title: title.trim(),
    subtitle: subtitle.trim() || "Saved places from friends",
    coverImageUrl: "https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=1000&q=80",
    experienceSlugs: [],
  };
}
