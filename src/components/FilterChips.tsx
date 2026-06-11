"use client";

import { UsersRound } from "lucide-react";
import { useState } from "react";

const filters = ["Friends", "All", "Nature", "Beaches", "Food", "Adventure", "Diving"];

export function FilterChips() {
  const [active, setActive] = useState("Friends");

  return (
    <div className="no-scrollbar flex gap-2 overflow-x-auto px-4 py-3">
      {filters.map((filter) => (
        <button
          className={`flex h-10 shrink-0 items-center gap-2 rounded-full px-4 text-sm font-semibold shadow-sm transition ${
            active === filter ? "bg-ink text-white" : "bg-white/88 text-ink/72 hover:bg-white"
          }`}
          key={filter}
          onClick={() => setActive(filter)}
          type="button"
        >
          {filter === "Friends" ? <UsersRound aria-hidden="true" size={15} /> : null}
          {filter}
        </button>
      ))}
    </div>
  );
}
