"use client";

import { ArrowLeft, MapPin, Search, UserRound } from "lucide-react";
import { useRouter } from "next/navigation";
import { FormEvent, KeyboardEvent, useEffect, useMemo, useState } from "react";

export type SearchSuggestion = {
  category?: string;
  label: string;
  description?: string;
  mapboxId?: string;
  query?: string;
  sessionToken?: string;
  center?: [number, number];
  profilePhotoUrl?: string | null;
  type?: "place" | "user";
  username?: string;
  zoom?: number;
};

type SearchBarProps = {
  initialValue?: string;
  value?: string;
  placeholder?: string;
  compact?: boolean;
  showBackButtonOnFocus?: boolean;
  suggestions?: SearchSuggestion[];
  onFocusChange?: (focused: boolean) => void;
  onValueChange?: (value: string) => void;
  onSuggestionSelect?: (suggestion: SearchSuggestion) => void | Promise<void>;
  onSearch?: (query: string) => void | Promise<void>;
};

export function SearchBar({
  initialValue = "",
  value: controlledValue,
  placeholder = "Where to next?",
  compact = false,
  showBackButtonOnFocus = true,
  suggestions = [],
  onFocusChange,
  onValueChange,
  onSuggestionSelect,
  onSearch,
}: SearchBarProps) {
  const [internalValue, setInternalValue] = useState(initialValue);
  const [focused, setFocused] = useState(false);
  const router = useRouter();
  const value = controlledValue ?? internalValue;
  const filteredSuggestions = useMemo(() => {
    if (!suggestions.length || !focused) {
      return [];
    }

    return suggestions.slice(0, 10);
  }, [focused, suggestions]);
  const placeSuggestions = filteredSuggestions.filter((suggestion) => (suggestion.type ?? "place") === "place").slice(0, 5);
  const userSuggestions = filteredSuggestions.filter((suggestion) => suggestion.type === "user").slice(0, 5);

  useEffect(() => {
    setInternalValue(initialValue);
  }, [initialValue]);

  function updateValue(nextValue: string) {
    if (controlledValue === undefined) {
      setInternalValue(nextValue);
    }

    onValueChange?.(nextValue);
  }

  function updateFocused(nextFocused: boolean) {
    setFocused(nextFocused);
    onFocusChange?.(nextFocused);
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void executeSearch(value);
  }

  async function executeSearch(rawQuery: string) {
    const query = rawQuery.trim();

    updateFocused(false);
    if (document.activeElement instanceof HTMLElement) {
      document.activeElement.blur();
    }

    if (onSearch) {
      await onSearch(query);
      return;
    }

    navigateToDestination(query);
  }

  function navigateToDestination(query: string) {
    if (query.toLowerCase().includes("hawaii") || !query) {
      router.push("/explore");
      return;
    }

    router.push("/explore");
  }

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Enter") {
      event.preventDefault();
      void executeSearch(value);
    }
  }

  function handleSuggestionSelect(suggestion: SearchSuggestion) {
    const nextValue = suggestion.query ?? suggestion.label;

    updateValue(nextValue);
    updateFocused(false);
    if (onSuggestionSelect) {
      void onSuggestionSelect({ ...suggestion, query: nextValue });
      return;
    }

    void executeSearch(nextValue);
  }

  function closeSearchMode() {
    updateFocused(false);
    if (document.activeElement instanceof HTMLElement) {
      document.activeElement.blur();
    }
  }

  function renderSuggestionRow(suggestion: SearchSuggestion) {
    const isUser = suggestion.type === "user";

    return (
      <button
        className="flex w-full items-center gap-3 px-4 py-3 text-left transition hover:bg-shell"
        key={`${suggestion.type ?? "place"}-${suggestion.label}-${suggestion.description ?? ""}`}
        onClick={() => handleSuggestionSelect(suggestion)}
        type="button"
      >
        <span className="grid h-10 w-10 shrink-0 place-items-center overflow-hidden rounded-full bg-shell text-moss">
          {isUser && suggestion.profilePhotoUrl ? (
            <img alt="" className="h-full w-full object-cover" src={suggestion.profilePhotoUrl} />
          ) : isUser ? (
            <UserRound aria-hidden="true" size={18} />
          ) : (
            <MapPin aria-hidden="true" size={18} />
          )}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-extrabold text-ink">{suggestion.label}</span>
          {suggestion.description ? (
            <span className="mt-0.5 block truncate text-xs font-semibold text-ink/54">{suggestion.description}</span>
          ) : null}
          {suggestion.category ? (
            <span className="mt-1 block truncate text-[10px] font-black uppercase tracking-[0.1em] text-moss/72">{suggestion.category}</span>
          ) : null}
        </span>
      </button>
    );
  }

  return (
    <div className="relative">
      <form
        className={`flex items-center gap-2 rounded-full border border-white/70 bg-white/90 px-4 shadow-lift backdrop-blur-xl ${
          compact ? "h-12" : "h-14"
        }`}
        onSubmit={handleSubmit}
      >
        {focused && showBackButtonOnFocus ? (
          <button
            aria-label="Close search"
            className="-ml-1 grid h-9 w-9 shrink-0 place-items-center rounded-full text-ink"
            onMouseDown={(event) => event.preventDefault()}
            onClick={closeSearchMode}
            type="button"
          >
            <ArrowLeft aria-hidden="true" size={20} />
          </button>
        ) : (
          <Search aria-hidden="true" className="text-moss" size={19} />
        )}
        <input
          aria-label="Search places or people"
          className={`min-w-0 flex-1 bg-transparent font-semibold text-ink outline-none placeholder:text-ink/48 ${
            compact ? "text-[13px]" : "text-[15px]"
          }`}
          onBlur={() => window.setTimeout(() => updateFocused(false), 120)}
          onChange={(event) => {
            updateFocused(true);
            updateValue(event.target.value);
          }}
          onFocus={() => updateFocused(true)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          value={value}
        />
      </form>
      {focused ? (
        <div className="absolute left-0 right-0 top-[calc(100%+8px)] z-50 max-h-[calc(100dvh-9.5rem)] overflow-y-auto rounded-[22px] border border-white/70 bg-white/96 py-2 shadow-soft backdrop-blur-xl">
          <section>
            <p className="px-4 py-2 text-[11px] font-black uppercase tracking-[0.14em] text-ink/36">Places</p>
            {placeSuggestions.length ? (
              placeSuggestions.map(renderSuggestionRow)
            ) : (
              <p className="px-4 py-3 text-sm font-semibold text-ink/42">Search a city, neighborhood, or place.</p>
            )}
          </section>
          <section className="border-t border-ink/8 pt-1">
            <p className="px-4 py-2 text-[11px] font-black uppercase tracking-[0.14em] text-ink/36">People</p>
            {userSuggestions.length ? (
              userSuggestions.map(renderSuggestionRow)
            ) : (
              <p className="px-4 py-3 text-sm font-semibold text-ink/42">Search by username.</p>
            )}
          </section>
        </div>
      ) : null}
    </div>
  );
}
