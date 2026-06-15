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

export function inferPostTagFromText(...parts: Array<string | null | undefined>): AppPostTag {
  const text = parts.join(" ").toLowerCase();

  if (/(restaurant|bar|coffee|cafe|café|drink|cocktail|beer|wine|brunch|breakfast|lunch|dinner|meal|food|pizza|taco|sushi|bakery|dessert)/.test(text)) {
    return "Food & Drink";
  }

  if (/(hotel|stay|bnb|airbnb|resort|inn|lodge|suite|room|hostel|cabin)/.test(text)) {
    return "Stay";
  }

  if (/(hike|trail|park|beach|mountain|lake|river|waterfall|garden|sunset|sunrise|forest|nature|view|scenic|outdoor)/.test(text)) {
    return "Nature";
  }

  if (/(hidden|secret|underrated|local|hole in the wall|gem|quiet|tucked|favorite)/.test(text)) {
    return "Hidden Gem";
  }

  return "Experience";
}
