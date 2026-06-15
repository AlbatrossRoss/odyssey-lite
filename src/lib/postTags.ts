export const postTagOptions = ["Food & Drink", "Experience", "Nature", "Stay", "Hidden Gem"] as const;
export const exploreFilterOptions = ["Food & Drink", "Experiences", "Nature", "Stays", "Hidden Gem"] as const;

export type AppPostTag = (typeof postTagOptions)[number];
export type ExploreCategoryFilter = (typeof exploreFilterOptions)[number];

const filterToTagMap: Record<ExploreCategoryFilter, AppPostTag> = {
  "Food & Drink": "Food & Drink",
  Experiences: "Experience",
  Nature: "Nature",
  Stays: "Stay",
  "Hidden Gem": "Hidden Gem",
};

const tagToFilterMap: Record<AppPostTag, ExploreCategoryFilter> = {
  "Food & Drink": "Food & Drink",
  Experience: "Experiences",
  Nature: "Nature",
  Stay: "Stays",
  "Hidden Gem": "Hidden Gem",
};

const legacyTagMap: Record<string, AppPostTag> = {
  Experiences: "Experience",
  Stays: "Stay",
};

export function isAppPostTag(value: string): value is AppPostTag {
  return (postTagOptions as readonly string[]).includes(value);
}

export function isExploreCategoryFilter(value: string): value is ExploreCategoryFilter {
  return (exploreFilterOptions as readonly string[]).includes(value);
}

export function tagForExploreFilter(filter: ExploreCategoryFilter) {
  return filterToTagMap[filter];
}

export function filterForPostTag(tag: AppPostTag) {
  return tagToFilterMap[tag];
}

export function normalizePostTag(value: string): AppPostTag | null {
  if (isAppPostTag(value)) {
    return value;
  }

  return legacyTagMap[value] ?? null;
}

export function emojiForPostTag(tag: AppPostTag) {
  if (tag === "Food & Drink") return "🍴";
  if (tag === "Experience") return "✨";
  if (tag === "Nature") return "🌿";
  if (tag === "Stay") return "🛏️";
  return "💎";
}
