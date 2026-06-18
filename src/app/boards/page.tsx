"use client";

import Link from "next/link";
import { Bookmark, Grid2X2, MapPin, MoreHorizontal, Plus, Trash2, X } from "lucide-react";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { BottomNav } from "@/components/BottomNav";
import { DynamicMapboxMap } from "@/components/DynamicMapboxMap";
import { MobileFrame } from "@/components/MobileFrame";
import { createAppBoard, deleteAppBoard, fetchBoardsByAccount, updateAppBoard, type AppBoard } from "@/lib/boards";
import { readAccountSessionId } from "@/lib/accounts";
import { fetchAppPostsByIds, type AppPost } from "@/lib/posts";
import { PostMediaPreview } from "@/components/PostMediaPreview";

type BoardFormState = {
  title: string;
  subtitle: string;
};

export default function BoardsPage() {
  const [accountId, setAccountId] = useState<string | null>(null);
  const [boards, setBoards] = useState<AppBoard[]>([]);
  const [postsById, setPostsById] = useState<Record<string, AppPost>>({});
  const [form, setForm] = useState<BoardFormState>({ title: "", subtitle: "" });
  const [editForm, setEditForm] = useState<BoardFormState>({ title: "", subtitle: "" });
  const [editingBoard, setEditingBoard] = useState<AppBoard | null>(null);
  const [selectedBoardId, setSelectedBoardId] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<"grid" | "map">("grid");
  const [createOpen, setCreateOpen] = useState(false);
  const [status, setStatus] = useState<"loading" | "ready" | "saving">("loading");
  const [message, setMessage] = useState("");

  useEffect(() => {
    const viewerId = readAccountSessionId();
    setAccountId(viewerId);

    if (!viewerId) {
      setStatus("ready");
      return;
    }

    let active = true;
    const activeAccountId = viewerId;

    async function loadBoards() {
      try {
        const nextBoards = await fetchBoardsByAccount(activeAccountId);
        const postIds = Array.from(new Set(nextBoards.flatMap((board) => board.postIds)));
        const posts = postIds.length ? await fetchAppPostsByIds(postIds) : [];

        if (active) {
          const requestedBoardSlug = new URLSearchParams(window.location.search).get("board");
          const requestedBoard = requestedBoardSlug ? nextBoards.find((board) => board.slug === requestedBoardSlug) : null;

          setBoards(nextBoards);
          setPostsById(Object.fromEntries(posts.map((post) => [post.id, post])));
          setSelectedBoardId((current) => requestedBoard?.id ?? current ?? nextBoards[0]?.id ?? null);
          setStatus("ready");
        }
      } catch (error) {
        if (active) {
          setMessage(formatError(error));
          setStatus("ready");
        }
      }
    }

    void loadBoards();

    return () => {
      active = false;
    };
  }, []);

  const selectedBoard = useMemo(() => boards.find((board) => board.id === selectedBoardId) ?? boards[0] ?? null, [boards, selectedBoardId]);
  const selectedPosts = useMemo(
    () => selectedBoard?.postIds.map((postId) => postsById[postId]).filter((post): post is AppPost => Boolean(post)) ?? [],
    [postsById, selectedBoard],
  );

  function openCreateBoard() {
    setForm({ title: "", subtitle: "" });
    setMessage("");
    setCreateOpen(true);
  }

  function closeModal() {
    setForm({ title: "", subtitle: "" });
    setCreateOpen(false);
  }

  function openBoardEditor(board: AppBoard) {
    setEditForm({ title: board.title, subtitle: board.subtitle });
    setEditingBoard(board);
    setMessage("");
  }

  function closeBoardEditor() {
    setEditingBoard(null);
    setEditForm({ title: "", subtitle: "" });
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!accountId || !form.title.trim()) {
      return;
    }

    setStatus("saving");
    setMessage("");

    try {
      const board = await createAppBoard({ accountId, title: form.title, subtitle: "" });
      setBoards((current) => [...current, board]);
      setSelectedBoardId(board.id);
      closeModal();
    } catch (error) {
      setMessage(formatError(error));
    } finally {
      setStatus("ready");
    }
  }

  async function handleBoardUpdate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!editingBoard || !editForm.title.trim()) {
      return;
    }

    setStatus("saving");
    setMessage("");

    try {
      const updatedBoard = await updateAppBoard(editingBoard.id, { title: editForm.title, subtitle: editingBoard.subtitle });
      setBoards((current) =>
        current.map((board) =>
          board.id === editingBoard.id
            ? {
                ...updatedBoard,
                postIds: board.postIds,
                previewImageUrls: board.previewImageUrls,
              }
            : board,
        ),
      );
      closeBoardEditor();
    } catch (error) {
      setMessage(formatError(error));
    } finally {
      setStatus("ready");
    }
  }

  async function handleBoardDelete() {
    if (!editingBoard) {
      return;
    }

    const confirmed = window.confirm(`Delete "${editingBoard.title}"?`);

    if (!confirmed) {
      return;
    }

    setStatus("saving");
    setMessage("");

    try {
      await deleteAppBoard(editingBoard.id);
      setBoards((current) => current.filter((board) => board.id !== editingBoard.id));
      setSelectedBoardId((current) => (current === editingBoard.id ? null : current));
      closeBoardEditor();
    } catch (error) {
      setMessage(formatError(error));
    } finally {
      setStatus("ready");
    }
  }

  return (
    <MobileFrame>
      <section className="h-full overflow-y-auto bg-white pb-[calc(var(--bottom-nav-clearance)+1rem)] text-ink">
        <header className="safe-top-bar px-5 pb-4">
            <div className="flex items-center justify-between gap-4">
            <h1 className="text-[24px] font-black leading-tight tracking-normal text-ink">My Boards</h1>
            <div className="flex items-center gap-3">
              <button
                aria-label="Create board"
                className="grid h-12 w-12 place-items-center rounded-full bg-white text-ink shadow-sm ring-1 ring-ink/10"
                onClick={openCreateBoard}
                type="button"
              >
                <Plus aria-hidden="true" size={25} strokeWidth={2.3} />
              </button>
            </div>
          </div>
        </header>

        {message ? <p className="mx-5 mb-4 rounded-2xl bg-coral/10 px-4 py-3 text-sm font-bold text-coral">{message}</p> : null}

        {status === "loading" ? (
          <div className="grid min-h-[420px] place-items-center text-sm font-black text-ink/44">Loading boards...</div>
        ) : boards.length ? (
          <>
            <section className="no-scrollbar flex gap-3 overflow-x-auto px-5 pb-6 pt-1">
              {boards.map((board) => (
                <BoardHeroCard board={board} key={board.id} onSelect={() => setSelectedBoardId(board.id)} selected={board.id === selectedBoard?.id} />
              ))}
            </section>

            <section className="border-b border-ink/10 px-5">
              <div className="mx-auto grid max-w-[20rem] grid-cols-2">
                <button
                  className={`flex h-14 items-center justify-center gap-2 border-b-2 text-base font-black transition ${
                    viewMode === "grid" ? "border-[#4b7df2] text-[#4b7df2]" : "border-transparent text-ink/42"
                  }`}
                  onClick={() => setViewMode("grid")}
                  type="button"
                >
                  <Grid2X2 aria-hidden="true" size={22} />
                  Grid
                </button>
                <button
                  className={`flex h-14 items-center justify-center gap-2 border-b-2 text-base font-black transition ${
                    viewMode === "map" ? "border-[#4b7df2] text-[#4b7df2]" : "border-transparent text-ink/42"
                  }`}
                  onClick={() => setViewMode("map")}
                  type="button"
                >
                  <MapPin aria-hidden="true" size={24} />
                  Map
                </button>
              </div>
            </section>

            {selectedBoard ? (
              viewMode === "map" ? (
                selectedPosts.length ? (
                  <section className="pt-0">
                    <div className="h-[560px] overflow-hidden bg-[#a9d7ed]">
                      <DynamicMapboxMap
                      appPosts={selectedPosts}
                      className="h-full w-full"
                      experiences={[]}
                      fitToAppPosts
                      interactive
                      zoom={5.4}
                    />
                    </div>
                  </section>
                ) : (
                  <section className="px-5 pt-7">
                    <div className="rounded-[22px] bg-shell px-5 py-8 text-center">
                      <Bookmark aria-hidden="true" className="mx-auto text-ink/32" size={28} />
                      <p className="mt-3 text-sm font-bold leading-relaxed text-ink/52">Save recommendations to this board to see them on the map.</p>
                    </div>
                  </section>
                )
              ) : (
                <section className="px-5 pt-7">
                  <div className="mb-5 flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <h2 className="truncate text-[20px] font-black leading-tight text-ink">{selectedBoard.title}</h2>
                      <p className="mt-1 text-sm font-semibold text-ink/52">
                        {selectedBoard.postIds.length} saved {selectedBoard.postIds.length === 1 ? "experience" : "experiences"}
                      </p>
                    </div>
                    <button
                      aria-label={`${selectedBoard.title} settings`}
                      className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-white text-ink shadow-sm ring-1 ring-ink/10"
                      onClick={() => openBoardEditor(selectedBoard)}
                      type="button"
                    >
                      <MoreHorizontal aria-hidden="true" size={21} />
                    </button>
                  </div>

                  {selectedPosts.length ? (
                    <>
                      <div className="grid grid-cols-2 items-start gap-3">
                        {selectedPosts.map((post, index) => (
                          <BoardSavedPostCard
                            index={index}
                            key={post.id}
                            post={post}
                          />
                        ))}
                      </div>
                      <Link className="mt-7 flex h-12 items-center justify-center rounded-full bg-ink px-5 text-sm font-black text-white shadow-lift" href="/explore">
                        Explore More
                      </Link>
                    </>
                  ) : (
                    <div className="rounded-[22px] bg-shell px-5 py-8 text-center">
                      <Bookmark aria-hidden="true" className="mx-auto text-ink/32" size={28} />
                      <p className="mt-3 text-sm font-bold leading-relaxed text-ink/52">Saved recommendations will appear here.</p>
                    </div>
                  )}
                </section>
              )
            ) : null}
          </>
        ) : (
          <div className="mx-5 grid min-h-[520px] place-items-center rounded-[24px] border border-dashed border-ink/12 bg-shell px-6 text-center">
            <div>
              <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-full bg-ink text-white shadow-lift">
                <Plus aria-hidden="true" size={28} />
              </div>
              <h2 className="text-2xl font-black text-ink">No boards yet</h2>
              <p className="mx-auto mt-2 max-w-64 text-sm font-semibold leading-relaxed text-ink/58">
                Save posts into trip ideas, weekend lists, or places you want to remember.
              </p>
              <button className="mt-6 rounded-full bg-ink px-6 py-3 text-sm font-black text-white shadow-lift" onClick={openCreateBoard} type="button">
                Create Board
              </button>
            </div>
          </div>
        )}
      </section>
      <BottomNav activeTab="Boards" />

      {createOpen ? (
        <div className="safe-modal-bottom absolute inset-x-0 top-0 z-50 flex h-full items-end bg-ink/28 backdrop-blur-sm">
          <form className="w-full rounded-t-[30px] bg-white p-5 shadow-soft" onSubmit={handleSubmit}>
            <div className="mb-5 flex items-center justify-between">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.18em] text-coral">Create board</p>
                <h2 className="text-2xl font-black text-ink">New board</h2>
              </div>
              <button
                aria-label="Close board editor"
                className="flex h-10 w-10 items-center justify-center rounded-full bg-shell text-ink"
                onClick={closeModal}
                type="button"
              >
                <X aria-hidden="true" size={19} />
              </button>
            </div>

            <label className="mb-4 block">
              <span className="mb-1 block text-sm font-bold text-ink/70">Board name</span>
              <input
                className="h-12 w-full rounded-2xl border border-ink/10 bg-shell px-4 text-base font-bold text-ink outline-none focus:border-coral"
                onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))}
                placeholder="Hawaii ideas"
                value={form.title}
              />
            </label>
            <button
              className="flex w-full items-center justify-center rounded-full bg-ink px-5 py-4 text-base font-extrabold text-white shadow-lift disabled:opacity-50"
              disabled={status === "saving" || !form.title.trim()}
              type="submit"
            >
              {status === "saving" ? "Creating..." : "Create Board"}
            </button>
          </form>
        </div>
      ) : null}

      {editingBoard ? (
        <div className="safe-modal-bottom absolute inset-x-0 top-0 z-50 flex h-full items-end bg-ink/28 backdrop-blur-sm">
          <form className="w-full rounded-t-[30px] bg-white p-5 shadow-soft" onSubmit={handleBoardUpdate}>
            <div className="mb-5 flex items-center justify-between">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.18em] text-coral">Board settings</p>
                <h2 className="text-2xl font-black text-ink">Edit board</h2>
              </div>
              <button
                aria-label="Close board settings"
                className="flex h-10 w-10 items-center justify-center rounded-full bg-shell text-ink"
                onClick={closeBoardEditor}
                type="button"
              >
                <X aria-hidden="true" size={19} />
              </button>
            </div>

            <label className="mb-4 block">
              <span className="mb-1 block text-sm font-bold text-ink/70">Board name</span>
              <input
                className="h-12 w-full rounded-2xl border border-ink/10 bg-shell px-4 text-base font-bold text-ink outline-none focus:border-coral"
                onChange={(event) => setEditForm((current) => ({ ...current, title: event.target.value }))}
                value={editForm.title}
              />
            </label>
            <div className="grid grid-cols-[1fr_auto] gap-3">
              <button
                className="flex h-14 items-center justify-center rounded-full bg-ink px-5 text-sm font-black text-white shadow-lift disabled:opacity-50"
                disabled={status === "saving" || !editForm.title.trim()}
                type="submit"
              >
                {status === "saving" ? "Saving..." : "Save Changes"}
              </button>
              <button
                aria-label="Delete board"
                className="flex h-14 w-14 items-center justify-center rounded-full bg-coral/10 text-coral disabled:opacity-50"
                disabled={status === "saving"}
                onClick={handleBoardDelete}
                type="button"
              >
                <Trash2 aria-hidden="true" size={20} />
              </button>
            </div>
          </form>
        </div>
      ) : null}
    </MobileFrame>
  );
}

function BoardHeroCard({ board, onSelect, selected }: { board: AppBoard; onSelect: () => void; selected: boolean }) {
  const imageUrl = board.previewImageUrls[0] ?? (board.coverImageUrl === "/hawaii-reference-map.png" ? null : board.coverImageUrl);

  return (
    <button
      className={`relative aspect-[3/4] h-[150px] shrink-0 overflow-hidden rounded-[14px] bg-ink text-left shadow-sm transition ${
        selected ? "ring-2 ring-[#4b7df2]/70 ring-offset-2 ring-offset-white" : ""
      }`}
      onClick={onSelect}
      type="button"
    >
      {imageUrl ? <img alt="" className="absolute inset-0 h-full w-full object-cover" src={imageUrl} /> : <span className="absolute inset-0 bg-ink/12" />}
      <span className="absolute inset-x-0 bottom-0 h-[78%] bg-gradient-to-t from-black/95 via-black/62 via-55% to-transparent" />
      <span className="absolute right-3 top-3 text-white/92">
        <MoreHorizontal aria-hidden="true" size={18} />
      </span>
      <span className="absolute inset-x-0 bottom-0 p-3 text-white">
        <span className="line-clamp-2 block text-sm font-black leading-tight">{board.title}</span>
        <span className="mt-1.5 block text-xs font-bold leading-tight text-white/84">
          {board.postIds.length} saved
        </span>
      </span>
    </button>
  );
}

function BoardSavedPostCard({ index, post }: { index: number; post: AppPost }) {
  const aspectClass = index % 5 === 1 || index % 5 === 4 ? "aspect-[0.82]" : index % 5 === 2 ? "aspect-[1.08]" : "aspect-square";

  return (
    <Link className="group block min-w-0 text-ink" href={`/posts/${post.id}`}>
      <span className={`relative block overflow-hidden rounded-[8px] bg-shell ${aspectClass}`}>
        {post.imageUrl ? (
          <PostMediaPreview alt={post.title} className="h-full w-full object-cover transition duration-300 group-active:scale-[0.99]" mediaType={post.mediaTypes[0]} src={post.imageUrl} />
        ) : (
          <span className="flex h-full items-center justify-center px-3 text-center text-xs font-bold leading-tight text-ink/48">{post.title}</span>
        )}
        {post.profilePhotoUrl ? (
          <img alt="" className="absolute bottom-2 left-2 h-7 w-7 rounded-full border-2 border-white object-cover shadow-sm" src={post.profilePhotoUrl} />
        ) : null}
      </span>
      <span className="mt-2 block min-w-0">
          <span className="line-clamp-2 text-[11px] font-black leading-tight">{post.title}</span>
          <span className="mt-1 block truncate text-[10px] font-semibold text-ink/52">{post.location}</span>
      </span>
    </Link>
  );
}

function formatError(error: unknown) {
  return error instanceof Error ? error.message : "Something went wrong.";
}
