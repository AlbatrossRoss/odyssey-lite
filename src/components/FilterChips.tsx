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
    <div className="relative px-0 py-3">
      <div className="no-scrollbar flex gap-2 overflow-x-auto pr-12">
        <button
          aria-label="My posts"
          className={`odyssey-glass flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-full text-sm font-semibold transition ${
            active === "Mine" ? "bg-ink text-white ring-2 ring-white opacity-100" : "text-ink/58 opacity-75"
          }`}
          onClick={() => onChange?.("Mine")}
          type="button"
        >
          {userPhotoUrl ? <img alt="" className="h-full w-full object-cover" src={userPhotoUrl} /> : <span className="text-xs font-black">Me</span>}
        </button>
        {filters.map((filter) => (
          <button
            className={`flex h-9 shrink-0 items-center gap-2 rounded-full px-4 text-[13px] font-bold transition ${
              active === filter ? "bg-ink text-white shadow-lift" : "odyssey-glass text-ink/68"
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
          className={`absolute right-0 top-3 flex h-9 w-9 shrink-0 items-center justify-center rounded-full transition ${
            activeCategoryFilters.length ? "bg-ink text-white shadow-lift" : "odyssey-glass text-ink"
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
        <div className="odyssey-glass absolute right-0 top-[54px] z-40 flex max-w-[235px] flex-wrap justify-end gap-2 rounded-[20px] p-3">
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
