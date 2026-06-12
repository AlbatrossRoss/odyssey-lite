"use client";

import { ArrowLeft, Plus, X } from "lucide-react";
import Link from "next/link";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { BoardCard } from "@/components/BoardCard";
import { BottomNav } from "@/components/BottomNav";
import { MobileFrame } from "@/components/MobileFrame";
import { createAppBoard, fetchBoardsByAccount, type AppBoard } from "@/lib/boards";
import { readAccountSessionId } from "@/lib/accounts";

type BoardFormState = {
  title: string;
  subtitle: string;
};

export default function BoardsPage() {
  const [accountId, setAccountId] = useState<string | null>(null);
  const [boards, setBoards] = useState<AppBoard[]>([]);
  const [form, setForm] = useState<BoardFormState>({ title: "", subtitle: "" });
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

    fetchBoardsByAccount(viewerId)
      .then((nextBoards) => {
        if (active) {
          setBoards(nextBoards);
          setStatus("ready");
        }
      })
      .catch((error) => {
        if (active) {
          setMessage(formatError(error));
          setStatus("ready");
        }
      });

    return () => {
      active = false;
    };
  }, []);

  const firstBoardId = useMemo(() => boards[0]?.id, [boards]);

  function openCreateBoard() {
    setForm({ title: "", subtitle: "" });
    setMessage("");
    setCreateOpen(true);
  }

  function closeModal() {
    setForm({ title: "", subtitle: "" });
    setCreateOpen(false);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!accountId || !form.title.trim()) {
      return;
    }

    setStatus("saving");
    setMessage("");

    try {
      const board = await createAppBoard({ accountId, title: form.title, subtitle: form.subtitle });
      setBoards((current) => [...current, board]);
      closeModal();
    } catch (error) {
      setMessage(formatError(error));
    } finally {
      setStatus("ready");
    }
  }

  return (
    <MobileFrame>
      <section className="h-full overflow-y-auto bg-shell px-5 pb-28 pt-7">
        <header className="mb-5 flex items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            <Link
              aria-label="Back to Explore"
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-white text-ink shadow-lift"
              href="/"
            >
              <ArrowLeft aria-hidden="true" size={20} />
            </Link>
            <div className="min-w-0">
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-coral">Boards</p>
              <h1 className="truncate text-3xl font-black text-ink">Saved for later</h1>
            </div>
          </div>
          <button
            aria-label="Create board"
            className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-ink text-white shadow-lift"
            onClick={openCreateBoard}
            type="button"
          >
            <Plus aria-hidden="true" size={22} />
          </button>
        </header>

        {message ? <p className="mb-4 rounded-2xl bg-coral/10 px-4 py-3 text-sm font-bold text-coral">{message}</p> : null}

        {status === "loading" ? (
          <div className="grid min-h-[420px] place-items-center text-sm font-black text-ink/44">Loading boards...</div>
        ) : boards.length ? (
          <div className="grid grid-cols-2 gap-4">
            {boards.map((board) => (
              <BoardCard board={board} key={board.id} tall={board.id === firstBoardId} />
            ))}
          </div>
        ) : (
          <div className="grid min-h-[520px] place-items-center rounded-[32px] border border-dashed border-ink/12 bg-white/58 px-6 text-center">
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
      <BottomNav />

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
            <label className="mb-5 block">
              <span className="mb-1 block text-sm font-bold text-ink/70">Description</span>
              <textarea
                className="min-h-24 w-full resize-none rounded-2xl border border-ink/10 bg-shell px-4 py-3 text-sm font-semibold leading-relaxed text-ink outline-none focus:border-coral"
                onChange={(event) => setForm((current) => ({ ...current, subtitle: event.target.value }))}
                placeholder="Optional note"
                value={form.subtitle}
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
    </MobileFrame>
  );
}

function formatError(error: unknown) {
  return error instanceof Error ? error.message : "Something went wrong.";
}
