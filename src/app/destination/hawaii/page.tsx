"use client";

import { PointerEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft } from "lucide-react";
import { BottomNav } from "@/components/BottomNav";
import { ExperienceCard } from "@/components/ExperienceCard";
import { ExperienceFeedCard } from "@/components/ExperienceFeedCard";
import { FilterChips } from "@/components/FilterChips";
import { FriendPostCard } from "@/components/FriendPostCard";
import { MapboxMap } from "@/components/MapboxMap";
import { MobileFrame } from "@/components/MobileFrame";
import { SearchBar, type SearchSuggestion } from "@/components/SearchBar";
import type { Experience, FriendPost } from "@/lib/data";
import { experiences, friendPosts } from "@/lib/data";
import { fetchFriendPosts } from "@/lib/supabase/queries";

const worldView = { center: [-25, 22] as [number, number], zoom: 1.35 };

const knownLocations: Record<string, [number, number]> = {
  hawaii: [-156.45, 20.55],
  maui: [-156.3319, 20.7984],
  oahu: [-157.8583, 21.3099],
  "o‘ahu": [-157.8583, 21.3099],
  honolulu: [-157.8583, 21.3069],
  kona: [-155.9969, 19.6406],
  "kailua-kona": [-155.9969, 19.6406],
  wailea: [-156.4417, 20.6893],
  hana: [-155.9874, 20.7557],
  haleakala: [-156.2533, 20.7097],
  "big island": [-155.5828, 19.5429],
  tokyo: [139.6917, 35.6895],
  japan: [138.2529, 36.2048],
  lisbon: [-9.1393, 38.7223],
  portugal: [-8.2245, 39.3999],
  dolomites: [12.1357, 46.5405],
  italy: [12.5674, 41.8719],
  "mexico city": [-99.1332, 19.4326],
  banff: [-115.5708, 51.1784],
  canada: [-106.3468, 56.1304],
};

const baseSuggestions: SearchSuggestion[] = [
  { label: "Tokyo", description: "Japan · Nina's newest trip", center: [139.6917, 35.6895], zoom: 10.5 },
  { label: "Lisbon", description: "Portugal · Jake's Alfama walk", center: [-9.1393, 38.7223], zoom: 11 },
  { label: "Dolomites", description: "Italy · Allison's hut weekend", center: [12.1357, 46.5405], zoom: 9.5 },
  { label: "Mexico City", description: "Mexico · Matt's food crawl", center: [-99.1332, 19.4326], zoom: 10.5 },
  { label: "Banff", description: "Canada · Sarah's mountain trip", center: [-115.5708, 51.1784], zoom: 10 },
  { label: "Hawaii", description: "Island chain and friend posts", center: [-156.45, 20.55], zoom: 6.05 },
  { label: "Maui", description: "Road to Hana, Wailea, Haleakala", center: [-156.3319, 20.7984], zoom: 10.5 },
  { label: "O‘ahu", description: "Honolulu and North Shore saves", query: "o‘ahu", center: [-157.8583, 21.3099], zoom: 10.5 },
  { label: "Big Island", description: "Kona, volcanoes, black sand beaches", center: [-155.5828, 19.5429], zoom: 8.5 },
  { label: "Road to Hana", description: "Jake's Maui drive post", center: [-156.1677, 20.7984], zoom: 11 },
  { label: "Haleakalā Sunrise", description: "Sarah's sunrise recommendation", center: [-156.2533, 20.7097], zoom: 11 },
];

function searchHasHawaiiContent(query: string) {
  const normalizedQuery = query.trim().toLowerCase();
  const hawaiiAliases = ["hawaii", "maui", "kona", "oahu", "o‘ahu", "big island", "wailea", "hana", "haleakalā", "haleakala", "punalu"];

  if (!normalizedQuery) {
    return false;
  }

  if (hawaiiAliases.some((alias) => normalizedQuery.includes(alias))) {
    return true;
  }

  return experiences.some((experience) => {
    const searchableText = `${experience.name} ${experience.location} ${experience.island}`.toLowerCase();
    return searchableText.includes(normalizedQuery);
  });
}

export default function HawaiiDestinationPage() {
  const [mode, setMode] = useState<"home" | "explore">("home");
  const [selected, setSelected] = useState<Experience | null>(null);
  const [mapTarget, setMapTarget] = useState<{ center: [number, number]; zoom?: number }>(worldView);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeDestination, setActiveDestination] = useState("");
  const [latestPosts, setLatestPosts] = useState(friendPosts);
  const [mapboxSuggestions, setMapboxSuggestions] = useState<SearchSuggestion[]>([]);
  const [sheetExpanded, setSheetExpanded] = useState(false);
  const cardRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const dragStartY = useRef<number | null>(null);
  const reverseGeocodeRequestId = useRef(0);
  const searchSuggestions = useMemo(() => {
    const suggestions = [...mapboxSuggestions, ...baseSuggestions];
    const seen = new Set<string>();

    return suggestions.filter((suggestion) => {
      const key = `${suggestion.label}-${suggestion.description ?? ""}`.toLowerCase();

      if (seen.has(key)) {
        return false;
      }

      seen.add(key);
      return true;
    });
  }, [mapboxSuggestions]);

  useEffect(() => {
    const query = searchQuery.trim();
    const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;

    if (!token || query.length < 2) {
      setMapboxSuggestions([]);
      return;
    }

    const controller = new AbortController();
    const timeoutId = window.setTimeout(async () => {
      const params = new URLSearchParams({
        access_token: token,
        autocomplete: "true",
        language: "en",
        limit: "5",
        types: "country,region,place,locality,neighborhood,poi,address",
      });

      try {
        const response = await fetch(
          `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(query)}.json?${params.toString()}`,
          { signal: controller.signal },
        );
        const data = (await response.json()) as {
          features?: Array<{
            center?: [number, number];
            place_name?: string;
            text?: string;
            place_type?: string[];
          }>;
        };

        setMapboxSuggestions(
          data.features?.map((feature) => ({
            label: feature.text ?? feature.place_name ?? query,
            description: feature.place_name,
            query: feature.place_name ?? feature.text ?? query,
            center: feature.center,
            zoom: feature.place_type?.includes("country") ? 4 : feature.place_type?.includes("region") ? 6 : 10.5,
          })) ?? [],
        );
      } catch {
        if (!controller.signal.aborted) {
          setMapboxSuggestions([]);
        }
      }
    }, 180);

    return () => {
      controller.abort();
      window.clearTimeout(timeoutId);
    };
  }, [searchQuery]);

  useEffect(() => {
    let active = true;

    fetchFriendPosts()
      .then((posts) => {
        if (active && posts.length) {
          setLatestPosts(posts);
        }
      })
      .catch(() => {
        // Keep local prototype data if Supabase is unavailable.
      });

    return () => {
      active = false;
    };
  }, []);

  const handleSelect = useCallback((experience: Experience) => {
    setMode("explore");
    setSelected(experience);
    setSearchQuery(experience.name);
    setActiveDestination(experience.location);
    setMapTarget({ center: experience.coordinates, zoom: 11 });
    cardRefs.current[experience.slug]?.scrollIntoView({ behavior: "smooth", inline: "center", block: "nearest" });
  }, []);

  const enterExploreAt = useCallback((center: [number, number], zoom = 10.5, destination = "") => {
    setMode("explore");
    setSelected(null);
    setActiveDestination(destination);
    setSheetExpanded(false);
    setMapTarget({ center, zoom });
  }, []);

  const handleMapSearch = useCallback(async (query: string) => {
    const normalizedQuery = query.trim().toLowerCase();

    if (!normalizedQuery) {
      setSelected(null);
      setActiveDestination("");
      setMapTarget(worldView);
      setMode("home");
      setSheetExpanded(false);
      return;
    }

    const matchingExperience = experiences.find((experience) => {
      const searchableText = `${experience.name} ${experience.location} ${experience.island}`.toLowerCase();
      return searchableText.includes(normalizedQuery);
    });

    if (matchingExperience) {
      handleSelect(matchingExperience);
      return;
    }

    const knownLocation = knownLocations[normalizedQuery];

    if (knownLocation) {
      enterExploreAt(knownLocation, normalizedQuery === "hawaii" ? 6.05 : 10.5, query);
      return;
    }

    const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;

    if (!token) {
      return;
    }

    const params = new URLSearchParams({
      access_token: token,
      limit: "1",
      types: "country,region,place,locality,neighborhood,address,poi",
    });
    try {
      const response = await fetch(
        `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(query)}.json?${params.toString()}`,
      );
      const data = (await response.json()) as { features?: Array<{ center?: [number, number] }> };
      const center = data.features?.[0]?.center;

      if (center) {
        enterExploreAt(center, 10.5, query);
      }
    } catch {
      // Keep the current map position if geocoding is unavailable.
    }
  }, [enterExploreAt, handleSelect]);

  const handleSuggestionSelect = useCallback((suggestion: SearchSuggestion) => {
    const query = suggestion.query ?? suggestion.label;
    setSearchQuery(query);

    if (suggestion.center) {
      enterExploreAt(suggestion.center, suggestion.zoom, query);
      return;
    }

    void handleMapSearch(query);
  }, [enterExploreAt, handleMapSearch]);

  const handleResetToWorld = useCallback(() => {
    setSearchQuery("");
    setMode("home");
    setSelected(null);
    setActiveDestination("");
    setSheetExpanded(false);
    setMapTarget(worldView);
  }, []);

  const handleHomePostSelect = useCallback((post: FriendPost) => {
    setSearchQuery(post.destination);
    enterExploreAt(post.coordinates, 10.5, post.destination);
  }, [enterExploreAt]);

  const handleMapMoveEnd = useCallback(async ({ center, zoom }: { center: [number, number]; zoom: number }) => {
    if (mode !== "explore") {
      return;
    }

    const requestId = reverseGeocodeRequestId.current + 1;
    reverseGeocodeRequestId.current = requestId;
    const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;

    if (!token) {
      const coordinateLabel = `${center[1].toFixed(2)}, ${center[0].toFixed(2)}`;
      setSearchQuery(coordinateLabel);
      setActiveDestination(coordinateLabel);
      return;
    }

    const params = new URLSearchParams({
      access_token: token,
      language: "en",
      limit: "1",
      types: zoom > 9 ? "place,locality,neighborhood,poi" : "country,region,place",
    });

    try {
      const response = await fetch(
        `https://api.mapbox.com/geocoding/v5/mapbox.places/${center[0]},${center[1]}.json?${params.toString()}`,
      );
      const data = (await response.json()) as {
        features?: Array<{
          place_name?: string;
          text?: string;
        }>;
      };
      const nextDestination = data.features?.[0]?.place_name ?? data.features?.[0]?.text;

      if (requestId !== reverseGeocodeRequestId.current || !nextDestination) {
        return;
      }

      setSelected(null);
      setSearchQuery(nextDestination);
      setActiveDestination(nextDestination);
    } catch {
      // Keep the previous search label if reverse geocoding is unavailable.
    }
  }, [mode]);

  const hasExploreContent = mode === "explore" && searchHasHawaiiContent(activeDestination || searchQuery);
  const visibleExperiences = hasExploreContent ? experiences : [];

  function handleSheetPointerDown(event: PointerEvent<HTMLElement>) {
    dragStartY.current = event.clientY;
  }

  function handleSheetPointerUp(event: PointerEvent<HTMLElement>) {
    if (dragStartY.current === null) {
      return;
    }

    const deltaY = event.clientY - dragStartY.current;
    dragStartY.current = null;

    if (deltaY < -36) {
      setSheetExpanded(true);
    }

    if (deltaY > 36) {
      setSheetExpanded(false);
    }
  }

  return (
    <MobileFrame>
      <section className="relative h-full bg-white">
        <MapboxMap
          className="absolute inset-x-0 top-0 h-[66%] w-full"
          experiences={mode === "home" || hasExploreContent ? experiences : []}
          mapTarget={mapTarget}
          onMoveEnd={handleMapMoveEnd}
          onSelect={handleSelect}
          selectedSlug={selected?.slug}
          zoom={1.35}
        />
        <div className="absolute inset-x-0 top-0 z-30 bg-gradient-to-b from-white/55 via-white/18 to-transparent px-4 pb-10 pt-[calc(env(safe-area-inset-top)+18px)]">
          <div className="flex items-center gap-3">
            {mode === "explore" ? (
              <button
                aria-label="Clear search and show world map"
                className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-white text-ink shadow-lift"
                onClick={handleResetToWorld}
                type="button"
              >
                <ArrowLeft aria-hidden="true" size={21} />
              </button>
            ) : null}
            <div className="min-w-0 flex-1">
              <SearchBar
                compact
                onSearch={handleMapSearch}
                onSuggestionSelect={handleSuggestionSelect}
                onValueChange={setSearchQuery}
                placeholder="Where to next?"
                suggestions={searchSuggestions}
                value={searchQuery}
              />
            </div>
          </div>
          {mode === "explore" ? <FilterChips /> : null}
        </div>
        <section
          className={`absolute inset-x-0 z-30 rounded-t-[30px] bg-white px-4 pt-3 shadow-[0_-18px_42px_rgba(24,35,31,0.15)] transition-all duration-300 ease-out ${
            sheetExpanded ? "bottom-[76px] top-[92px] pb-4" : mode === "home" ? "bottom-[76px] h-[34%] pb-3" : "bottom-[76px] h-[36%] pb-3"
          }`}
          onPointerDown={handleSheetPointerDown}
          onPointerUp={handleSheetPointerUp}
        >
          <button
            aria-label={sheetExpanded ? "Collapse friend feed" : "Expand friend feed"}
            className="mx-auto mb-2 block h-5 w-16 rounded-full"
            onClick={() => setSheetExpanded((expanded) => !expanded)}
            type="button"
          >
            <span className="mx-auto block h-1.5 w-12 rounded-full bg-ink/16" />
          </button>
          <div className="mb-2 flex items-end justify-between px-1">
            <div>
              <h1 className="text-base font-black text-ink">
                {mode === "home" ? "My friends' latest posts" : "From your friends"}
              </h1>
              <p className="text-[11px] font-semibold text-ink/52">
                {mode === "home"
                  ? "Recent trips and saves around the world"
                  : hasExploreContent
                    ? "Real moments from real trips"
                    : "No friend posts here yet"}
              </p>
            </div>
            {mode === "home" ? (
              <button className="pb-1 text-xs font-bold text-[#7c5fd6]" type="button">
                View all
              </button>
            ) : null}
          </div>
          {mode === "home" ? (
            <div className="no-scrollbar flex gap-3 overflow-x-auto pb-2">
              {latestPosts.map((post) => (
                <FriendPostCard key={post.id} onSelect={handleHomePostSelect} post={post} />
              ))}
            </div>
          ) : sheetExpanded ? (
            visibleExperiences.length ? (
              <div className="no-scrollbar h-[calc(100%-74px)] space-y-4 overflow-y-auto pb-5">
                {visibleExperiences.map((experience) => (
                  <ExperienceFeedCard
                    active={selected?.slug === experience.slug}
                    experience={experience}
                    key={experience.slug}
                    onSelect={handleSelect}
                  />
                ))}
              </div>
            ) : (
              <div className="flex h-[calc(100%-74px)] items-center justify-center px-8 text-center">
                <p className="text-sm font-semibold leading-relaxed text-ink/54">
                  None of your friends have posted about this destination yet.
                </p>
              </div>
            )
          ) : visibleExperiences.length ? (
            <div className="no-scrollbar flex gap-4 overflow-x-auto pb-2">
              {visibleExperiences.map((experience) => (
                <div
                  key={experience.slug}
                  ref={(node) => {
                    cardRefs.current[experience.slug] = node;
                  }}
                >
                  <ExperienceCard
                    active={selected?.slug === experience.slug}
                    experience={experience}
                    onSelect={handleSelect}
                  />
                </div>
              ))}
            </div>
          ) : (
            <div className="flex h-[calc(100%-74px)] items-center justify-center px-8 text-center">
              <p className="text-sm font-semibold leading-relaxed text-ink/54">
                None of your friends have posted about this destination yet.
              </p>
            </div>
          )}
        </section>
        <BottomNav activeTab={mode === "home" ? "Home" : "Explore"} />
      </section>
    </MobileFrame>
  );
}
