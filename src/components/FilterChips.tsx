"use client";

import { UsersRound } from "lucide-react";
import { exploreFilterOptions } from "@/lib/postTags";

const filters = ["Friends", ...exploreFilterOptions, "All"];

export function FilterChips({
  active = "Friends",
  onChange,
  userPhotoUrl,
}: {
  active?: string;
  onChange?: (filter: string) => void;
  userPhotoUrl?: string | null;
}) {
  return (
    <div className="no-scrollbar flex gap-2 overflow-x-auto px-4 py-3">
      <button
        aria-label="My posts"
        className={`flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-full text-sm font-semibold shadow-sm transition ${
          active === "Mine" ? "bg-ink text-white ring-2 ring-white opacity-100" : "bg-white/88 text-ink/42 opacity-45 hover:bg-white/80 hover:opacity-75"
        }`}
        onClick={() => onChange?.("Mine")}
        type="button"
      >
        {userPhotoUrl ? <img alt="" className="h-full w-full object-cover" src={userPhotoUrl} /> : <span className="text-xs font-black">Me</span>}
      </button>
      {filters.map((filter) => (
        <button
          className={`flex h-10 shrink-0 items-center gap-2 rounded-full px-4 text-sm font-semibold shadow-sm transition ${
            active === filter ? "bg-ink text-white" : "bg-white/88 text-ink/72 hover:bg-white"
          }`}
          key={filter}
          onClick={() => onChange?.(filter)}
          type="button"
        >
          {filter === "Friends" ? <UsersRound aria-hidden="true" size={15} /> : null}
          {filter}
        </button>
      ))}
    </div>
  );
}
