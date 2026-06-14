"use client";

import { PointerEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft } from "lucide-react";
import { AppPostCard } from "@/components/AppPostCard";
import { AppPostFeedCard } from "@/components/AppPostFeedCard";
import { BottomNav } from "@/components/BottomNav";
import { FilterChips } from "@/components/FilterChips";
import { MapboxMap } from "@/components/MapboxMap";
import { MobileFrame } from "@/components/MobileFrame";
import { SearchBar, type SearchSuggestion } from "@/components/SearchBar";
import { fetchFollowingIds, readAccountSessionId } from "@/lib/accounts";
import { fetchAppPosts, type AppPost } from "@/lib/posts";

const worldView = { center: [-25, 22] as [number, number], zoom: 1.35 };
const mapExploreZoomThreshold = 3.25;
const exploreStateStorageKey = "odyssey-explore-view-state-v1";

type MapBounds = {
  east: number;
  north: number;
  south: number;
  west: number;
};

type MapArea = {
  bounds: MapBounds;
  center: [number, number];
  label: string;
  zoom: number;
};

type SheetPosition = "minimized" | "peek" | "expanded";

type MapView = {
  center: [number, number];
  zoom?: number;
};

type StoredExploreState = {
  activeDestination: string;
  activeFilter: string;
  currentMapView: MapView;
  exploreSource: "search" | "map";
  mapArea: MapArea | null;
  searchQuery: string;
  selectedPostId: string | null;
  sheetPosition: SheetPosition;
};

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
  atlanta: [-84.3877, 33.7488],
  "atlanta, ga": [-84.3877, 33.7488],
  greece: [23.7275, 37.9838],
  athens: [23.7275, 37.9838],
  santorini: [25.4615, 36.3932],
  "fort worth": [-97.3308, 32.7555],
  "fort worth, texas": [-97.3308, 32.7555],
};

function postSearchHasContent(query: string, post: AppPost) {
  const normalizedQuery = query.trim().toLowerCase();

  if (!normalizedQuery) {
    return false;
  }

  const searchableText = `${post.title} ${post.location} ${post.caption}`.toLowerCase();
  const hawaiiAliases = ["hawaii", "maui", "kona", "oahu", "o‘ahu", "big island", "wailea", "hana", "haleakalā", "haleakala", "punalu"];

  if (hawaiiAliases.some((alias) => normalizedQuery.includes(alias))) {
    return hawaiiAliases.some((alias) => searchableText.includes(alias));
  }

  return searchableText.includes(normalizedQuery);
}

function coordinateInBounds(coordinates: [number, number], bounds: MapBounds) {
  const [longitude, latitude] = coordinates;
  const isInLatitude = latitude >= bounds.south && latitude <= bounds.north;
  const isInLongitude =
    bounds.west <= bounds.east ? longitude >= bounds.west && longitude <= bounds.east : longitude >= bounds.west || longitude <= bounds.east;

  return isInLatitude && isInLongitude;
}

function mapAreaLabel(center: [number, number]) {
  return `${center[1].toFixed(2)}, ${center[0].toFixed(2)}`;
}

function isCoordinatePair(value: unknown): value is [number, number] {
  return Array.isArray(value) && value.length === 2 && value.every((item) => typeof item === "number" && Number.isFinite(item));
}

function isSheetPosition(value: unknown): value is SheetPosition {
  return value === "minimized" || value === "peek" || value === "expanded";
}

function isDefaultWorldView(value: MapView) {
  return value.center[0] === worldView.center[0] && value.center[1] === worldView.center[1] && (value.zoom ?? worldView.zoom) === worldView.zoom;
}

function readStoredExploreState(): StoredExploreState | null {
  if (typeof window === "undefined") {
    return null;
  }

  try {
    const stored = window.sessionStorage.getItem(exploreStateStorageKey);
    const parsed = stored ? (JSON.parse(stored) as Partial<StoredExploreState>) : null;

    if (!parsed || !parsed.currentMapView || !isCoordinatePair(parsed.currentMapView.center)) {
      return null;
    }

    const restoredState: StoredExploreState = {
      activeDestination: typeof parsed.activeDestination === "string" ? parsed.activeDestination : "",
      activeFilter: parsed.activeFilter === "All" ? "All" : "Friends",
      currentMapView: {
        center: parsed.currentMapView.center,
        zoom: typeof parsed.currentMapView.zoom === "number" ? parsed.currentMapView.zoom : worldView.zoom,
      },
      exploreSource: parsed.exploreSource === "map" ? "map" : "search",
      mapArea: parsed.mapArea && isCoordinatePair(parsed.mapArea.center) ? parsed.mapArea : null,
      searchQuery: typeof parsed.searchQuery === "string" ? parsed.searchQuery : "",
      selectedPostId: typeof parsed.selectedPostId === "string" ? parsed.selectedPostId : null,
      sheetPosition: isSheetPosition(parsed.sheetPosition) ? parsed.sheetPosition : "peek",
    };

    if (
      isDefaultWorldView(restoredState.currentMapView) &&
      !restoredState.activeDestination &&
      !restoredState.searchQuery &&
      !restoredState.mapArea &&
      !restoredState.selectedPostId
    ) {
      return null;
    }

    return restoredState;
  } catch {
    return null;
  }
}

function writeStoredExploreState(state: StoredExploreState) {
  try {
    window.sessionStorage.setItem(exploreStateStorageKey, JSON.stringify(state));
  } catch {
    // Explore can still work if private browsing or storage settings block session storage.
  }
}

export default function ExplorePage() {
  const [restoredExploreState] = useState(() => readStoredExploreState());
  const [exploreSource, setExploreSource] = useState<"search" | "map">(restoredExploreState?.exploreSource ?? "search");
  const [defaultMapView, setDefaultMapView] = useState<MapView>(worldView);
  const [currentMapView, setCurrentMapView] = useState<MapView>(restoredExploreState?.currentMapView ?? worldView);
  const [mapTarget, setMapTarget] = useState<MapView>(restoredExploreState?.currentMapView ?? worldView);
  const [mapArea, setMapArea] = useState<MapArea | null>(restoredExploreState?.mapArea ?? null);
  const [searchQuery, setSearchQuery] = useState(restoredExploreState?.searchQuery ?? "");
  const [activeDestination, setActiveDestination] = useState(restoredExploreState?.activeDestination ?? "");
  const [appPosts, setAppPosts] = useState<AppPost[]>([]);
  const [followingIds, setFollowingIds] = useState<string[]>([]);
  const [mapboxSuggestions, setMapboxSuggestions] = useState<SearchSuggestion[]>([]);
  const [activeFilter, setActiveFilter] = useState(restoredExploreState?.activeFilter ?? "Friends");
  const [sheetPosition, setSheetPosition] = useState<SheetPosition>(restoredExploreState?.sheetPosition ?? "peek");
  const [selectedPostId, setSelectedPostId] = useState<string | null>(restoredExploreState?.selectedPostId ?? null);
  const dragStartPoint = useRef<{ x: number; y: number } | null>(null);
  const exploreStateRef = useRef<StoredExploreState>({
    activeDestination: restoredExploreState?.activeDestination ?? "",
    activeFilter: restoredExploreState?.activeFilter ?? "Friends",
    currentMapView: restoredExploreState?.currentMapView ?? worldView,
    exploreSource: restoredExploreState?.exploreSource ?? "search",
    mapArea: restoredExploreState?.mapArea ?? null,
    searchQuery: restoredExploreState?.searchQuery ?? "",
    selectedPostId: restoredExploreState?.selectedPostId ?? null,
    sheetPosition: restoredExploreState?.sheetPosition ?? "peek",
  });
  const searchSuggestions = useMemo(() => {
    const seen = new Set<string>();

    return mapboxSuggestions.filter((suggestion) => {
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
    if (restoredExploreState || typeof navigator === "undefined" || !("geolocation" in navigator)) {
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const nextView = {
          center: [position.coords.longitude, position.coords.latitude] as [number, number],
          zoom: 9.5,
        };

        setDefaultMapView(nextView);
        setCurrentMapView(nextView);
        setMapTarget(nextView);
      },
      () => {
        setDefaultMapView(worldView);
        setCurrentMapView(worldView);
        setMapTarget(worldView);
      },
      { enableHighAccuracy: false, maximumAge: 1000 * 60 * 10, timeout: 6500 },
    );
  }, [restoredExploreState]);

  useEffect(() => {
    const nextState = {
      activeDestination,
      activeFilter,
      currentMapView,
      exploreSource,
      mapArea,
      searchQuery,
      selectedPostId,
      sheetPosition,
    } satisfies StoredExploreState;

    exploreStateRef.current = nextState;
    writeStoredExploreState(nextState);
  }, [activeDestination, activeFilter, currentMapView, exploreSource, mapArea, searchQuery, selectedPostId, sheetPosition]);

  useEffect(() => {
    let active = true;

    fetchAppPosts()
      .then((sharedPosts) => {
        if (!active) {
          return;
        }

        setAppPosts(sharedPosts);
      })
      .catch(() => {
        // Keep an empty recommendations feed if Supabase is unavailable.
      });

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    const viewerId = readAccountSessionId();

    if (!viewerId) {
      setFollowingIds([]);
      return;
    }

    let active = true;

    fetchFollowingIds(viewerId)
      .then((ids) => {
        if (active) {
          setFollowingIds(ids);
        }
      })
      .catch(() => {
        if (active) {
          setFollowingIds([]);
        }
      });

    return () => {
      active = false;
    };
  }, []);

  const enterExploreAt = useCallback((center: [number, number], zoom = 10.5, destination = "") => {
    const nextView = { center, zoom };

    setExploreSource("search");
    setMapArea(null);
    setActiveDestination(destination);
    setSheetPosition("peek");
    setSelectedPostId(null);
    setCurrentMapView(nextView);
    setMapTarget(nextView);
  }, []);

  const handleMapSearch = useCallback(async (query: string) => {
    const normalizedQuery = query.trim().toLowerCase();

    if (!normalizedQuery) {
      setActiveDestination("");
      setMapArea(null);
      setExploreSource("search");
      setCurrentMapView(defaultMapView);
      setMapTarget(defaultMapView);
      setSheetPosition("peek");
      setSelectedPostId(null);
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
  }, [defaultMapView, enterExploreAt]);

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
    setExploreSource("search");
    setActiveDestination("");
    setMapArea(null);
    setSheetPosition("peek");
    setSelectedPostId(null);
    setCurrentMapView(defaultMapView);
    setMapTarget(defaultMapView);
  }, [defaultMapView]);

  const handleAppPostSelect = useCallback((post: AppPost) => {
    setSelectedPostId(post.id);
    setSheetPosition("peek");
  }, []);

  const handlePostOpen = useCallback((post: AppPost) => {
    writeStoredExploreState({
      ...exploreStateRef.current,
      selectedPostId: post.id,
      sheetPosition: exploreStateRef.current.sheetPosition === "minimized" ? "peek" : exploreStateRef.current.sheetPosition,
    });
  }, []);

  const handleMapInteraction = useCallback(() => {
    setSheetPosition("minimized");
  }, []);

  const handleMapMoveEnd = useCallback(async ({ bounds, center, zoom }: { bounds: MapBounds; center: [number, number]; zoom: number }) => {
    const sourcePosts = activeFilter === "All" ? appPosts : appPosts.filter((post) => followingIds.includes(post.accountId));
    const areaPosts = sourcePosts.filter((post) => coordinateInBounds(post.coordinates, bounds));
    const canUseMapArea = zoom >= mapExploreZoomThreshold;

    setCurrentMapView({ center, zoom });

    if (canUseMapArea && (areaPosts.length > 0 || exploreSource === "map")) {
      const coordinateLabel = mapAreaLabel(center);
      setExploreSource("map");
      setMapArea({ bounds, center, label: coordinateLabel, zoom });
      setActiveDestination(coordinateLabel);
      return;
    }

    if (!canUseMapArea && exploreSource === "map") {
      setExploreSource("search");
      setMapArea(null);
      setActiveDestination("");
    }
  }, [activeFilter, appPosts, exploreSource, followingIds]);

  const followedPosts = useMemo(
    () => appPosts.filter((post) => followingIds.includes(post.accountId)),
    [appPosts, followingIds],
  );
  const filteredPosts = activeFilter === "All" ? appPosts : followedPosts;
  const searchText = activeDestination || searchQuery;
  const searchPosts = searchText ? filteredPosts.filter((post) => postSearchHasContent(searchText, post)) : filteredPosts;
  const mapAreaPosts = mapArea ? filteredPosts.filter((post) => coordinateInBounds(post.coordinates, mapArea.bounds)) : [];
  const visibleAppPosts = exploreSource === "map" ? mapAreaPosts : searchPosts;
  const selectedPost = selectedPostId ? visibleAppPosts.find((post) => post.id === selectedPostId) ?? null : null;
  const peekPosts = selectedPost ? [selectedPost] : visibleAppPosts;
  const feedPosts = selectedPost ? [selectedPost, ...visibleAppPosts.filter((post) => post.id !== selectedPost.id)] : visibleAppPosts;
  const recommendationCount = visibleAppPosts.length;
  const recommendationSubtitle =
    recommendationCount > 0
      ? `${recommendationCount} ${recommendationCount === 1 ? "recommendation" : "recommendations"} ${activeFilter === "Friends" ? "from people you follow" : "from all travelers"}`
      : activeFilter === "Friends"
        ? "Follow accounts to see their recommendations here"
        : "No recommendations in this area yet";
  const sheetClassName =
    sheetPosition === "expanded"
      ? "nav-cleared-bottom top-[92px] pb-4"
      : sheetPosition === "minimized"
        ? "nav-cleared-bottom h-[56px] pb-2"
        : "nav-cleared-bottom h-[36%] pb-3";
  const mapClassName =
    sheetPosition === "minimized"
      ? "absolute inset-0 w-full"
      : "absolute inset-x-0 top-0 h-[66%] w-full";
  const handleLabel =
    sheetPosition === "expanded"
      ? "Show less recommendations"
      : sheetPosition === "minimized"
        ? "Show recommendations"
        : "Expand recommendations";

  useEffect(() => {
    if (selectedPostId && !visibleAppPosts.some((post) => post.id === selectedPostId)) {
      setSelectedPostId(null);
    }
  }, [selectedPostId, visibleAppPosts]);

  function handleSheetPointerDown(event: PointerEvent<HTMLElement>) {
    dragStartPoint.current = { x: event.clientX, y: event.clientY };
  }

  function handleSheetPointerMove(event: PointerEvent<HTMLElement>) {
    const start = dragStartPoint.current;

    if (!start) {
      return;
    }

    const deltaX = event.clientX - start.x;
    const deltaY = event.clientY - start.y;

    if (Math.abs(deltaY) < 52 || Math.abs(deltaY) < Math.abs(deltaX) * 1.2) {
      return;
    }

    setSheetPosition(deltaY < 0 ? "expanded" : "minimized");
    dragStartPoint.current = null;
  }

  function handleSheetPointerUp(event: PointerEvent<HTMLElement>) {
    const start = dragStartPoint.current;

    if (!start) {
      return;
    }

    const deltaX = event.clientX - start.x;
    const deltaY = event.clientY - start.y;
    dragStartPoint.current = null;

    if (Math.abs(deltaY) < 28 || Math.abs(deltaY) < Math.abs(deltaX) * 1.1) {
      return;
    }

    if (deltaY < 0) {
      setSheetPosition("expanded");
    }

    if (deltaY > 0) {
      setSheetPosition("minimized");
    }
  }

  function handleSheetPointerCancel() {
    dragStartPoint.current = null;
  }

  return (
    <MobileFrame>
      <section className="relative h-full bg-white">
        <MapboxMap
          appPosts={visibleAppPosts}
          className={mapClassName}
          experiences={[]}
          mapTarget={mapTarget}
          onMapInteraction={handleMapInteraction}
          onMoveEnd={handleMapMoveEnd}
          onPostSelect={handleAppPostSelect}
          selectedPostId={selectedPostId ?? undefined}
          zoom={1.35}
        />
        <div className="absolute inset-x-0 top-0 z-30 bg-gradient-to-b from-white/55 via-white/18 to-transparent px-4 pb-10 pt-[calc(var(--safe-area-top)+18px)]">
          <div className="flex items-center gap-3">
            {searchQuery || activeDestination || mapArea ? (
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
          <FilterChips active={activeFilter} onChange={setActiveFilter} />
        </div>
        <section
          className={`absolute inset-x-0 z-30 rounded-t-[30px] bg-white px-4 pt-1 shadow-[0_-18px_42px_rgba(24,35,31,0.15)] transition-all duration-300 ease-out ${sheetClassName}`}
          onPointerCancel={handleSheetPointerCancel}
          onPointerDown={handleSheetPointerDown}
          onPointerMove={handleSheetPointerMove}
          onPointerUp={handleSheetPointerUp}
        >
          <button
            aria-label={handleLabel}
            className="mx-auto mb-1 block h-4 w-16 rounded-full"
            onClick={() =>
              setSheetPosition((position) => (position === "minimized" ? "peek" : position === "peek" ? "expanded" : "peek"))
            }
            type="button"
          >
            <span className="mx-auto block h-1.5 w-12 rounded-full bg-ink/16" />
          </button>
          <div className={`mb-2 flex items-end justify-between px-1 ${sheetPosition === "minimized" ? "sr-only" : ""}`}>
            <div>
              <h1 className="text-base font-black text-ink">Recommendations</h1>
              <p className="text-[11px] font-semibold text-ink/52">{recommendationSubtitle}</p>
            </div>
          </div>
          {sheetPosition === "minimized" ? (
            <button
              className="flex w-full items-center justify-center rounded-full py-1 text-xs font-extrabold text-ink/54"
              onClick={() => setSheetPosition("peek")}
              type="button"
            >
              {recommendationCount ? `${recommendationCount} recommendations` : "Recommendations"}
            </button>
          ) : sheetPosition === "expanded" ? (
            feedPosts.length ? (
              <div className="no-scrollbar h-[calc(100%-58px)] space-y-4 overflow-y-auto pb-5">
                {feedPosts.map((post) => (
                  <AppPostFeedCard key={post.id} onOpen={() => handlePostOpen(post)} post={post} />
                ))}
              </div>
            ) : (
              <div className="flex h-[calc(100%-74px)] items-center justify-center px-8 text-center">
                <p className="text-sm font-semibold leading-relaxed text-ink/54">
                  {activeFilter === "Friends" ? "No followed accounts have recommendations here yet." : "No recommendations here yet."}
                </p>
              </div>
            )
          ) : peekPosts.length ? (
            <div className="no-scrollbar flex gap-4 overflow-x-auto pb-2">
              {peekPosts.map((post) => (
                <AppPostCard key={post.id} onOpen={() => handlePostOpen(post)} post={post} />
              ))}
            </div>
          ) : (
            <div className="flex h-[calc(100%-74px)] items-center justify-center px-8 text-center">
              <p className="text-sm font-semibold leading-relaxed text-ink/54">
                {activeFilter === "Friends" ? "No followed accounts have recommendations here yet." : "No recommendations here yet."}
              </p>
            </div>
          )}
        </section>
        <BottomNav activeTab="Explore" onExploreClick={handleResetToWorld} />
      </section>
    </MobileFrame>
  );
}
