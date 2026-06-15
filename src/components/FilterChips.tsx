"use client";

import { Check, SlidersHorizontal, UsersRound, X } from "lucide-react";
import { exploreFilterOptions, type ExploreCategoryFilter } from "@/lib/postTags";

const filters = ["Friends", "All"];

function filterLabel(filter: ExploreCategoryFilter) {
  return filter === "Hidden Gem" ? "Hidden Gems" : filter;
}

export function FilterChips({
  active = "Friends",
  activeCategoryFilters = [],
  categoriesOpen = false,
  onChange,
  onCategoryToggle,
  onToggleCategories,
  userPhotoUrl,
}: {
  active?: string;
  activeCategoryFilters?: ExploreCategoryFilter[];
  categoriesOpen?: boolean;
  onChange?: (filter: string) => void;
  onCategoryToggle?: (filter: ExploreCategoryFilter) => void;
  onToggleCategories?: () => void;
  userPhotoUrl?: string | null;
}) {
  return (
    <div className="relative px-4 py-3">
      <div className="no-scrollbar flex gap-2 overflow-x-auto pr-12">
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
        <button
          aria-label="Open category filters"
          className={`absolute right-4 top-3 flex h-10 w-10 shrink-0 items-center justify-center rounded-full shadow-sm transition ${
            activeCategoryFilters.length ? "bg-ink text-white" : "bg-white/92 text-ink"
          }`}
          onClick={onToggleCategories}
          type="button"
        >
          {categoriesOpen ? <X aria-hidden="true" size={18} /> : <SlidersHorizontal aria-hidden="true" size={17} />}
          {activeCategoryFilters.length ? (
            <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-coral px-1 text-[10px] font-black leading-none text-white">
              {activeCategoryFilters.length}
            </span>
          ) : null}
        </button>
      </div>

      {categoriesOpen ? (
        <div className="absolute right-4 top-[58px] z-40 flex max-w-[205px] flex-wrap justify-end gap-2">
          {exploreFilterOptions.map((filter) => {
            const selected = activeCategoryFilters.includes(filter);

            return (
              <button
                className={`flex h-10 items-center gap-2 rounded-full px-3 text-xs font-black transition ${
                  selected ? "bg-ink text-white" : "bg-shell text-ink/64"
                }`}
                key={filter}
                onClick={() => onCategoryToggle?.(filter)}
                type="button"
              >
                {selected ? <Check aria-hidden="true" size={14} /> : null}
                {filterLabel(filter)}
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
