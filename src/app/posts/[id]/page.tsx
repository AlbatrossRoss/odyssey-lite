"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { ArrowLeft, Bookmark, Calendar, Check, MapPin, Plus, UserRound, X } from "lucide-react";
import { MapboxMap } from "@/components/MapboxMap";
import { MobileFrame } from "@/components/MobileFrame";
import { fetchAppPostById, type AppPost } from "@/lib/posts";
import type { Experience } from "@/lib/data";
import { createAppBoard, fetchBoardsByAccount, savePostToBoard, type AppBoard } from "@/lib/boards";
import { readAccountSessionId } from "@/lib/accounts";

export default function PostDetailPage() {
  const params = useParams<{ id: string }>();
  const [post, setPost] = useState<AppPost | null>(null);
  const [accountId, setAccountId] = useState<string | null>(null);
  const [boards, setBoards] = useState<AppBoard[]>([]);
  const [loading, setLoading] = useState(true);
  const [saveOpen, setSaveOpen] = useState(false);
  const [newBoardOpen, setNewBoardOpen] = useState(false);
  const [newBoardTitle, setNewBoardTitle] = useState("");
  const [newBoardSubtitle, setNewBoardSubtitle] = useState("");
  const [saveStatus, setSaveStatus] = useState<"ready" | "saving">("ready");
  const [saveMessage, setSaveMessage] = useState("");

  useEffect(() => {
    let active = true;
    const viewerId = readAccountSessionId();

    setAccountId(viewerId);

    fetchAppPostById(params.id)
      .then((nextPost) => {
        if (active) {
          setPost(nextPost);
          setLoading(false);
        }
      })
      .catch(() => {
        if (active) {
          setLoading(false);
        }
      });

    return () => {
      active = false;
    };
  }, [params.id]);

  useEffect(() => {
    if (!accountId) {
      return;
    }

    let active = true;

    fetchBoardsByAccount(accountId)
      .then((nextBoards) => {
        if (active) {
          setBoards(nextBoards);
        }
      })
      .catch((error) => {
        if (active) {
          setSaveMessage(formatError(error));
        }
      });

    return () => {
      active = false;
    };
  }, [accountId]);

  const mapExperience = useMemo<Experience | null>(() => {
    if (!post) {
      return null;
    }

    return {
      alsoExperiencedBy: [],
      caption: post.caption,
      coordinates: post.coordinates,
      id: post.id,
      imageUrl: post.imageUrl,
      island: post.location,
      location: post.location,
      name: post.title,
      slug: post.id,
      tripId: post.id,
      userId: post.accountId,
    };
  }, [post]);

  if (loading) {
    return (
      <MobileFrame>
        <main className="grid h-full place-items-center bg-shell px-8 text-center">
          <p className="text-sm font-black text-ink/52">Loading post...</p>
        </main>
      </MobileFrame>
    );
  }

  if (!post || !mapExperience) {
    return (
      <MobileFrame>
        <main className="grid h-full place-items-center bg-shell px-8 text-center">
          <div>
            <UserRound aria-hidden="true" className="mx-auto text-ink/38" size={42} />
            <h1 className="mt-3 text-2xl font-black text-ink">Post not found</h1>
            <Link className="mt-5 inline-flex rounded-full bg-ink px-5 py-3 text-sm font-black text-white" href="/destination/hawaii">
              Back to Explore
            </Link>
          </div>
        </main>
      </MobileFrame>
    );
  }

  const savedBoardIds = boards.filter((board) => board.postIds.includes(post.id)).map((board) => board.id);
  const isSaved = savedBoardIds.length > 0;

  async function handleSaveToBoard(board: AppBoard) {
    if (!post) {
      return;
    }

    setSaveStatus("saving");
    setSaveMessage("");

    try {
      await savePostToBoard(board.id, post.id, post.imageUrl);
      setBoards((current) =>
        current.map((item) =>
          item.id === board.id
            ? {
                ...item,
                coverImageUrl: item.coverImageUrl === "/hawaii-reference-map.png" ? post.imageUrl : item.coverImageUrl,
                postIds: Array.from(new Set([...item.postIds, post.id])),
              }
            : item,
        ),
      );
      setSaveMessage(`Saved to ${board.title}.`);
    } catch (error) {
      setSaveMessage(formatError(error));
    } finally {
      setSaveStatus("ready");
    }
  }

  async function handleCreateAndSave(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!accountId || !post || !newBoardTitle.trim()) {
      return;
    }

    setSaveStatus("saving");
    setSaveMessage("");

    try {
      const board = await createAppBoard({
        accountId,
        coverImageUrl: post.imageUrl,
        subtitle: newBoardSubtitle,
        title: newBoardTitle,
      });

      await savePostToBoard(board.id, post.id, post.imageUrl);
      const savedBoard = { ...board, postIds: [post.id] };
      setBoards((current) => [...current, savedBoard]);
      setNewBoardTitle("");
      setNewBoardSubtitle("");
      setNewBoardOpen(false);
      setSaveMessage(`Saved to ${board.title}.`);
    } catch (error) {
      setSaveMessage(formatError(error));
    } finally {
      setSaveStatus("ready");
    }
  }

  return (
    <MobileFrame>
      <article className="h-full overflow-y-auto bg-shell pb-8">
        <div className="relative h-[430px] bg-ink">
          <img alt={post.title} className="h-full w-full object-cover" src={post.imageUrl} />
          <div className="absolute inset-0 bg-gradient-to-b from-ink/34 via-transparent to-ink/74" />
          <Link
            aria-label="Back to Explore"
            className="absolute left-4 top-5 flex h-11 w-11 items-center justify-center rounded-full bg-white/88 text-ink shadow-lift backdrop-blur"
            href="/destination/hawaii"
          >
            <ArrowLeft aria-hidden="true" size={20} />
          </Link>
          <div className="absolute bottom-6 left-5 right-5 text-white">
            <Link className="mb-4 flex items-center gap-3" href={`/accounts/${post.username}`}>
              <span className="flex h-12 w-12 items-center justify-center overflow-hidden rounded-full border-2 border-white bg-shell text-ink shadow-lift">
                {post.profilePhotoUrl ? (
                  <img alt="" className="h-full w-full object-cover" src={post.profilePhotoUrl} />
                ) : (
                  <UserRound aria-hidden="true" size={22} />
                )}
              </span>
              <span>
                <span className="block text-sm font-black">@{post.username}</span>
                <span className="block text-xs font-semibold capitalize text-white/72">{post.type}</span>
              </span>
            </Link>
            <h1 className="text-4xl font-black leading-none">{post.title}</h1>
          </div>
        </div>

        <div className="-mt-5 space-y-4 rounded-t-[34px] bg-shell px-5 pb-8 pt-5">
          <section className="rounded-[28px] bg-white p-4 shadow-soft">
            <p className="text-[15px] leading-relaxed text-ink/74">{post.caption}</p>
            <div className="mt-4 grid gap-2">
              <p className="flex items-center gap-2 text-sm font-bold text-ink/58">
                <MapPin aria-hidden="true" className="text-coral" size={17} />
                {post.location}
              </p>
              <p className="flex items-center gap-2 text-sm font-bold text-ink/58">
                <Calendar aria-hidden="true" className="text-coral" size={17} />
                {post.dateLabel}
              </p>
            </div>
            <button
              className={`mt-5 flex w-full items-center justify-center gap-2 rounded-full px-5 py-4 text-sm font-black shadow-lift ${
                isSaved ? "bg-ink text-white" : "bg-coral text-white"
              }`}
              onClick={() => setSaveOpen(true)}
              type="button"
            >
              <Bookmark aria-hidden="true" fill={isSaved ? "currentColor" : "none"} size={18} />
              {isSaved ? "Saved to Board" : "Save to Board"}
            </button>
          </section>

          <MapboxMap
            className="h-56 overflow-hidden rounded-[28px] shadow-soft"
            experiences={[mapExperience]}
            selectedSlug={mapExperience.slug}
            zoom={10.4}
          />
        </div>
      </article>

      {saveOpen ? (
        <div className="absolute inset-0 z-50 flex items-end bg-ink/28 backdrop-blur-sm">
          <section className="max-h-[82%] w-full overflow-y-auto rounded-t-[30px] bg-white p-5 shadow-soft">
            <div className="mb-5 flex items-center justify-between gap-3">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.18em] text-coral">Save post</p>
                <h2 className="text-2xl font-black text-ink">Choose a board</h2>
              </div>
              <button
                aria-label="Close save menu"
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-shell text-ink"
                onClick={() => setSaveOpen(false)}
                type="button"
              >
                <X aria-hidden="true" size={19} />
              </button>
            </div>

            {saveMessage ? <p className="mb-4 rounded-2xl bg-moss/10 px-4 py-3 text-sm font-bold text-moss">{saveMessage}</p> : null}

            <div className="space-y-3">
              {boards.map((board) => {
                const boardHasPost = board.postIds.includes(post.id);

                return (
                  <button
                    className="flex w-full items-center gap-3 rounded-[22px] border border-ink/8 bg-shell p-3 text-left disabled:opacity-60"
                    disabled={saveStatus === "saving" || boardHasPost}
                    key={board.id}
                    onClick={() => handleSaveToBoard(board)}
                    type="button"
                  >
                    <img alt="" className="h-14 w-14 rounded-2xl object-cover" src={board.coverImageUrl} />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-black text-ink">{board.title}</span>
                      <span className="block truncate text-xs font-bold text-ink/50">
                        {board.postIds.length} {board.postIds.length === 1 ? "post" : "posts"}
                      </span>
                    </span>
                    {boardHasPost ? <Check aria-hidden="true" className="text-moss" size={20} /> : <Plus aria-hidden="true" className="text-ink/42" size={20} />}
                  </button>
                );
              })}
            </div>

            {!boards.length && !newBoardOpen ? (
              <p className="rounded-[24px] bg-shell px-4 py-5 text-center text-sm font-semibold leading-relaxed text-ink/58">
                You do not have any boards yet. Create one below and this post will be saved there.
              </p>
            ) : null}

            {newBoardOpen ? (
              <form className="mt-4 rounded-[24px] bg-shell p-4" onSubmit={handleCreateAndSave}>
                <label className="mb-3 block">
                  <span className="mb-1 block text-sm font-bold text-ink/70">Board name</span>
                  <input
                    className="h-12 w-full rounded-2xl border border-ink/10 bg-white px-4 text-base font-bold text-ink outline-none focus:border-coral"
                    onChange={(event) => setNewBoardTitle(event.target.value)}
                    placeholder="Weekend saves"
                    value={newBoardTitle}
                  />
                </label>
                <label className="mb-4 block">
                  <span className="mb-1 block text-sm font-bold text-ink/70">Description</span>
                  <textarea
                    className="min-h-20 w-full resize-none rounded-2xl border border-ink/10 bg-white px-4 py-3 text-sm font-semibold leading-relaxed text-ink outline-none focus:border-coral"
                    onChange={(event) => setNewBoardSubtitle(event.target.value)}
                    placeholder="Optional note"
                    value={newBoardSubtitle}
                  />
                </label>
                <button
                  className="flex w-full items-center justify-center rounded-full bg-ink px-5 py-4 text-sm font-black text-white shadow-lift disabled:opacity-50"
                  disabled={saveStatus === "saving" || !newBoardTitle.trim()}
                  type="submit"
                >
                  {saveStatus === "saving" ? "Saving..." : "Create and Save"}
                </button>
              </form>
            ) : (
              <button
                className="mt-4 flex w-full items-center justify-center gap-2 rounded-full bg-ink px-5 py-4 text-sm font-black text-white shadow-lift"
                onClick={() => setNewBoardOpen(true)}
                type="button"
              >
                <Plus aria-hidden="true" size={18} />
                New Board
              </button>
            )}
          </section>
        </div>
      ) : null}
    </MobileFrame>
  );
}

function formatError(error: unknown) {
  return error instanceof Error ? error.message : "Something went wrong.";
}
