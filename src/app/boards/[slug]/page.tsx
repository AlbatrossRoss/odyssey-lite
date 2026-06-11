"use client";

import { ArrowLeft, Settings, Trash2, X } from "lucide-react";
import Link from "next/link";
import { notFound, useParams, useRouter } from "next/navigation";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { BottomNav } from "@/components/BottomNav";
import { MobileFrame } from "@/components/MobileFrame";
import type { Board } from "@/lib/data";
import { boards, experiences } from "@/lib/data";
import { readBoards, writeBoards } from "@/lib/boardStore";
import { readSavedSlugs } from "@/lib/saveStore";

type BoardFormState = {
  title: string;
  subtitle: string;
};

export default function BoardDetailPage() {
  const params = useParams<{ slug: string }>();
  const router = useRouter();
  const [board, setBoard] = useState<Board | null>(null);
  const [form, setForm] = useState<BoardFormState>({ title: "", subtitle: "" });
  const [loaded, setLoaded] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [savedSlugs, setSavedSlugs] = useState<string[]>([]);

  useEffect(() => {
    const matchingBoard = readBoards().find((item) => item.slug === params.slug) ?? null;

    setBoard(matchingBoard);
    setForm({
      title: matchingBoard?.title ?? "",
      subtitle: matchingBoard?.subtitle ?? "",
    });
    setSavedSlugs(readSavedSlugs(boards[0].experienceSlugs));
    setLoaded(true);
  }, [params.slug]);

  const savedExperiences = useMemo(() => {
    if (!board) {
      return [];
    }

    const merged = Array.from(new Set([...board.experienceSlugs, ...savedSlugs]));
    return experiences.filter((experience) => merged.includes(experience.slug));
  }, [board, savedSlugs]);

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

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!board || !form.title.trim()) {
      return;
    }

    const updatedBoard = {
      ...board,
      title: form.title.trim(),
      subtitle: form.subtitle.trim() || "Saved places from friends",
    };
    const nextBoards = readBoards().map((item) => (item.id === board.id ? updatedBoard : item));

    writeBoards(nextBoards);
    setBoard(updatedBoard);
    setSettingsOpen(false);
  }

  function handleDelete() {
    if (!board) {
      return;
    }

    const confirmed = window.confirm(`Delete "${board.title}"?`);

    if (!confirmed) {
      return;
    }

    writeBoards(readBoards().filter((item) => item.id !== board.id));
    router.push("/boards");
  }

  return (
    <MobileFrame>
      <section className="h-full overflow-y-auto bg-shell pb-28">
        <header className="relative h-64">
          <img alt={board.title} className="h-full w-full object-cover" src={board.coverImageUrl} />
          <div className="absolute inset-0 bg-gradient-to-b from-ink/20 via-transparent to-ink/76" />
          <Link
            aria-label="Back to Boards"
            className="absolute left-4 top-5 flex h-11 w-11 items-center justify-center rounded-full bg-white/90 text-ink shadow-lift backdrop-blur"
            href="/boards"
          >
            <ArrowLeft aria-hidden="true" size={20} />
          </Link>
          <button
            aria-label="Board settings"
            className="absolute right-4 top-5 flex h-11 w-11 items-center justify-center rounded-full bg-white/90 text-ink shadow-lift backdrop-blur"
            onClick={() => setSettingsOpen(true)}
            type="button"
          >
            <Settings aria-hidden="true" size={20} />
          </button>
          <div className="absolute bottom-5 left-5 right-5 text-white">
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-white/74">Board</p>
            <h1 className="text-4xl font-black leading-none">{board.title}</h1>
            <p className="mt-2 text-sm font-semibold text-white/82">{board.subtitle}</p>
          </div>
        </header>
        <div className="space-y-5 px-5 pt-5">
          <div className="grid grid-cols-2 gap-3">
            {savedExperiences.map((experience) => (
              <Link
                className="overflow-hidden rounded-[24px] bg-white shadow-soft"
                href={`/experience/${experience.slug}`}
                key={experience.slug}
              >
                <img alt={experience.name} className="h-36 w-full object-cover" src={experience.imageUrl} />
                <div className="p-3">
                  <h2 className="text-sm font-extrabold leading-tight text-ink">{experience.name}</h2>
                  <p className="mt-1 text-xs font-semibold text-moss">{experience.island}</p>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>
      <BottomNav />

      {settingsOpen ? (
        <div className="absolute inset-0 z-50 flex items-end bg-ink/28 backdrop-blur-sm">
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
                className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-coral/12 text-coral"
                onClick={handleDelete}
                type="button"
                aria-label="Delete board"
              >
                <Trash2 aria-hidden="true" size={20} />
              </button>
              <button
                className="flex h-14 flex-1 items-center justify-center rounded-full bg-ink px-5 text-base font-extrabold text-white shadow-lift"
                type="submit"
              >
                Save Changes
              </button>
            </div>
          </form>
        </div>
      ) : null}
    </MobileFrame>
  );
}
