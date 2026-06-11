"use client";

import { ArrowLeft, Plus, X } from "lucide-react";
import Link from "next/link";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { BoardCard } from "@/components/BoardCard";
import { BottomNav } from "@/components/BottomNav";
import { MobileFrame } from "@/components/MobileFrame";
import type { Board } from "@/lib/data";
import { createBoardDraft, readBoards, writeBoards } from "@/lib/boardStore";

type BoardFormState = {
  title: string;
  subtitle: string;
};

export default function BoardsPage() {
  const [managedBoards, setManagedBoards] = useState<Board[]>([]);
  const [form, setForm] = useState<BoardFormState>({ title: "", subtitle: "" });
  const modalOpen = form.title !== "" || form.subtitle !== "";

  useEffect(() => {
    setManagedBoards(readBoards());
  }, []);

  const firstBoardId = useMemo(() => managedBoards[0]?.id, [managedBoards]);

  function persistBoards(nextBoards: Board[]) {
    setManagedBoards(nextBoards);
    writeBoards(nextBoards);
  }

  function openCreateBoard() {
    setForm({ title: "New board", subtitle: "" });
  }

  function closeModal() {
    setForm({ title: "", subtitle: "" });
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!form.title.trim()) {
      return;
    }

    persistBoards([...managedBoards, createBoardDraft(form.title, form.subtitle, managedBoards)]);
    closeModal();
  }

  return (
    <MobileFrame>
      <section className="h-full overflow-y-auto bg-shell px-5 pb-28 pt-7">
        <header className="mb-5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link
              aria-label="Back to Explore"
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-white text-ink shadow-lift"
              href="/"
            >
              <ArrowLeft aria-hidden="true" size={20} />
            </Link>
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-coral">Boards</p>
              <h1 className="text-3xl font-black text-ink">Saved for later</h1>
            </div>
          </div>
          <button
            aria-label="Create board"
            className="flex h-12 w-12 items-center justify-center rounded-full bg-ink text-white shadow-lift"
            onClick={openCreateBoard}
            type="button"
          >
            <Plus aria-hidden="true" size={22} />
          </button>
        </header>
        <div className="grid grid-cols-2 gap-4">
          {managedBoards.map((board) => (
            <BoardCard board={board} key={board.id} tall={board.id === firstBoardId} />
          ))}
        </div>
      </section>
      <BottomNav />

      {modalOpen ? (
        <div className="absolute inset-0 z-50 flex items-end bg-ink/28 backdrop-blur-sm">
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
            <button className="h-13 flex w-full items-center justify-center rounded-full bg-ink px-5 py-4 text-base font-extrabold text-white shadow-lift" type="submit">
              Create Board
            </button>
          </form>
        </div>
      ) : null}
    </MobileFrame>
  );
}
