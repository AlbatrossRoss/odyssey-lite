"use client";

import { ArrowLeft, Settings, Trash2, X } from "lucide-react";
import Link from "next/link";
import { notFound, useParams, useRouter } from "next/navigation";
import { FormEvent, useEffect, useState } from "react";
import { AppPostCard } from "@/components/AppPostCard";
import { BottomNav } from "@/components/BottomNav";
import { MobileFrame } from "@/components/MobileFrame";
import { deleteAppBoard, fetchBoardBySlug, updateAppBoard, type AppBoard } from "@/lib/boards";
import { readAccountSessionId } from "@/lib/accounts";
import { fetchAppPostsByIds, type AppPost } from "@/lib/posts";

type BoardFormState = {
  title: string;
  subtitle: string;
};

export default function BoardDetailPage() {
  const params = useParams<{ slug: string }>();
  const router = useRouter();
  const [board, setBoard] = useState<AppBoard | null>(null);
  const [posts, setPosts] = useState<AppPost[]>([]);
  const [form, setForm] = useState<BoardFormState>({ title: "", subtitle: "" });
  const [loaded, setLoaded] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    const accountId = readAccountSessionId();

    if (!accountId) {
      setLoaded(true);
      return;
    }

    let active = true;
    const viewerId = accountId;

    async function loadBoard() {
      try {
        const matchingBoard = await fetchBoardBySlug(viewerId, params.slug);

        if (!active) {
          return;
        }

        setBoard(matchingBoard);
        setForm({
          title: matchingBoard?.title ?? "",
          subtitle: matchingBoard?.subtitle ?? "",
        });

        if (matchingBoard?.postIds.length) {
          const savedPosts = await fetchAppPostsByIds(matchingBoard.postIds);

          if (active) {
            setPosts(savedPosts);
          }
        }
      } catch (error) {
        if (active) {
          setMessage(formatError(error));
        }
      } finally {
        if (active) {
          setLoaded(true);
        }
      }
    }

    void loadBoard();

    return () => {
      active = false;
    };
  }, [params.slug]);

  if (loaded && !board) {
    notFound();
  }

  if (!board) {
    return null;
  }

  function closeSettings() {
    if (!board) {
      return;
    }

    setSettingsOpen(false);
    setForm({ title: board.title, subtitle: board.subtitle });
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!board || !form.title.trim()) {
      return;
    }

    try {
      const updatedBoard = await updateAppBoard(board.id, { title: form.title, subtitle: form.subtitle });
      setBoard({ ...updatedBoard, previewImageUrls: board.previewImageUrls, postIds: board.postIds });
      setSettingsOpen(false);
    } catch (error) {
      setMessage(formatError(error));
    }
  }

  async function handleDelete() {
    if (!board) {
      return;
    }

    const confirmed = window.confirm(`Delete "${board.title}"?`);

    if (!confirmed) {
      return;
    }

    await deleteAppBoard(board.id);
    router.push("/boards");
  }

  return (
    <MobileFrame>
      <section className="safe-page-bottom h-full overflow-y-auto bg-shell">
        <header className="relative h-64">
          <img alt={board.title} className="h-full w-full object-cover" src={board.coverImageUrl} />
          <div className="absolute inset-0 bg-gradient-to-b from-ink/20 via-transparent to-ink/76" />
          <Link
            aria-label="Back to Boards"
            className="safe-top-control absolute left-4 flex h-11 w-11 items-center justify-center rounded-full bg-white/90 text-ink shadow-lift backdrop-blur"
            href="/boards"
          >
            <ArrowLeft aria-hidden="true" size={20} />
          </Link>
          <button
            aria-label="Board settings"
            className="safe-top-control absolute right-4 flex h-11 w-11 items-center justify-center rounded-full bg-white/90 text-ink shadow-lift backdrop-blur"
            onClick={() => setSettingsOpen(true)}
            type="button"
          >
            <Settings aria-hidden="true" size={20} />
          </button>
          <div className="absolute bottom-5 left-5 right-5 text-white">
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-white/74">Board</p>
            <h1 className="text-4xl font-black leading-none">{board.title}</h1>
            <p className="mt-2 text-sm font-semibold text-white/82">{board.subtitle || `${posts.length} saved posts`}</p>
          </div>
        </header>
        <div className="px-5 pt-5">
          {message ? <p className="mb-4 rounded-2xl bg-coral/10 px-4 py-3 text-sm font-bold text-coral">{message}</p> : null}

          {posts.length ? (
            <div className="grid grid-cols-2 gap-3">
              {posts.map((post) => (
                <AppPostCard key={post.id} post={post} />
              ))}
            </div>
          ) : (
            <div className="grid min-h-[360px] place-items-center rounded-[30px] bg-white/64 px-6 text-center shadow-soft">
              <div>
                <h2 className="text-2xl font-black text-ink">Nothing saved yet</h2>
                <p className="mt-2 text-sm font-semibold leading-relaxed text-ink/58">Open a post and save it here when it feels worth remembering.</p>
                <Link className="mt-6 inline-flex rounded-full bg-ink px-6 py-3 text-sm font-black text-white" href="/explore">
                  Explore posts
                </Link>
              </div>
            </div>
          )}
        </div>
      </section>
      <BottomNav />

      {settingsOpen ? (
        <div className="safe-modal-bottom absolute inset-x-0 top-0 z-50 flex h-full items-end bg-ink/28 backdrop-blur-sm">
          <form className="w-full rounded-t-[30px] bg-white p-5 shadow-soft" onSubmit={handleSubmit}>
            <div className="mb-5 flex items-center justify-between">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.18em] text-coral">Board settings</p>
                <h2 className="text-2xl font-black text-ink">{board.title}</h2>
              </div>
              <button
                aria-label="Close board settings"
                className="flex h-10 w-10 items-center justify-center rounded-full bg-shell text-ink"
                onClick={closeSettings}
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
                value={form.title}
              />
            </label>
            <label className="mb-5 block">
              <span className="mb-1 block text-sm font-bold text-ink/70">Description</span>
              <textarea
                className="min-h-24 w-full resize-none rounded-2xl border border-ink/10 bg-shell px-4 py-3 text-sm font-semibold leading-relaxed text-ink outline-none focus:border-coral"
                onChange={(event) => setForm((current) => ({ ...current, subtitle: event.target.value }))}
                value={form.subtitle}
              />
            </label>
            <div className="flex gap-3">
              <button
                aria-label="Delete board"
                className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-coral/12 text-coral"
                onClick={handleDelete}
                type="button"
              >
                <Trash2 aria-hidden="true" size={20} />
              </button>
              <button className="flex h-14 flex-1 items-center justify-center rounded-full bg-ink px-5 text-base font-extrabold text-white shadow-lift" type="submit">
                Save Changes
              </button>
            </div>
          </form>
        </div>
      ) : null}
    </MobileFrame>
  );
}

function formatError(error: unknown) {
  return error instanceof Error ? error.message : "Something went wrong.";
}
