"use client";

import { Search } from "lucide-react";
import { useRouter } from "next/navigation";
import { FormEvent, KeyboardEvent, useEffect, useMemo, useState } from "react";

export type SearchSuggestion = {
  label: string;
  description?: string;
  query?: string;
  center?: [number, number];
  zoom?: number;
};

type SearchBarProps = {
  initialValue?: string;
  value?: string;
  placeholder?: string;
  compact?: boolean;
  suggestions?: SearchSuggestion[];
  onValueChange?: (value: string) => void;
  onSuggestionSelect?: (suggestion: SearchSuggestion) => void | Promise<void>;
  onSearch?: (query: string) => void | Promise<void>;
};

export function SearchBar({
  initialValue = "",
  value: controlledValue,
  placeholder = "Where to next?",
  compact = false,
  suggestions = [],
  onValueChange,
  onSuggestionSelect,
  onSearch,
}: SearchBarProps) {
  const [internalValue, setInternalValue] = useState(initialValue);
  const [focused, setFocused] = useState(false);
  const router = useRouter();
  const value = controlledValue ?? internalValue;
  const filteredSuggestions = useMemo(() => {
    const normalizedValue = value.trim().toLowerCase();

    if (!suggestions.length || !focused) {
      return [];
    }

    if (!normalizedValue) {
      return suggestions.slice(0, 5);
    }

    return suggestions
      .filter((suggestion) => {
        const searchableText = `${suggestion.label} ${suggestion.description ?? ""}`.toLowerCase();
        return searchableText.includes(normalizedValue);
      })
      .slice(0, 5);
  }, [focused, suggestions, value]);

  useEffect(() => {
    setInternalValue(initialValue);
  }, [initialValue]);

  function updateValue(nextValue: string) {
    if (controlledValue === undefined) {
      setInternalValue(nextValue);
    }

    onValueChange?.(nextValue);
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void executeSearch(value);
  }

  async function executeSearch(rawQuery: string) {
    const query = rawQuery.trim();

    setFocused(false);
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
      router.push("/destination/hawaii");
      return;
    }

    router.push("/destination/hawaii");
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
    setFocused(false);
    if (onSuggestionSelect) {
      void onSuggestionSelect({ ...suggestion, query: nextValue });
      return;
    }

    void executeSearch(nextValue);
  }

  return (
    <div className="relative">
      <form
        className={`flex items-center gap-2 rounded-full border border-white/70 bg-white/90 px-4 shadow-lift backdrop-blur-xl ${
          compact ? "h-12" : "h-14"
        }`}
        onSubmit={handleSubmit}
      >
        <Search aria-hidden="true" className="text-moss" size={19} />
        <input
          aria-label="Search destination"
          className="min-w-0 flex-1 bg-transparent text-[15px] font-semibold text-ink outline-none placeholder:text-ink/48"
          onBlur={() => window.setTimeout(() => setFocused(false), 120)}
          onChange={(event) => updateValue(event.target.value)}
          onFocus={() => setFocused(true)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          value={value}
        />
      </form>
      {filteredSuggestions.length ? (
        <div className="absolute left-0 right-0 top-[calc(100%+8px)] z-50 overflow-hidden rounded-[22px] border border-white/70 bg-white/96 py-1 shadow-soft backdrop-blur-xl">
          {filteredSuggestions.map((suggestion) => (
            <button
              className="flex w-full flex-col px-4 py-3 text-left transition hover:bg-shell"
              key={`${suggestion.label}-${suggestion.description ?? ""}`}
              onClick={() => handleSuggestionSelect(suggestion)}
              type="button"
            >
              <span className="text-sm font-extrabold text-ink">{suggestion.label}</span>
              {suggestion.description ? (
                <span className="mt-0.5 text-xs font-semibold text-ink/54">{suggestion.description}</span>
              ) : null}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
