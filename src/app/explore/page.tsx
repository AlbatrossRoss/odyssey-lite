"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { PointerEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Bell, Heart, MapPin, MessageCircle, UserPlus, X } from "lucide-react";
import { AppPostCard } from "@/components/AppPostCard";
import { AppPostFeedCard } from "@/components/AppPostFeedCard";
import { BottomNav } from "@/components/BottomNav";
import { FilterChips } from "@/components/FilterChips";
import { DynamicMapboxMap } from "@/components/DynamicMapboxMap";
import { LoadingScreen } from "@/components/LoadingScreen";
import { MobileFrame } from "@/components/MobileFrame";
import { PostMediaPreview } from "@/components/PostMediaPreview";
import { SearchBar, type SearchSuggestion } from "@/components/SearchBar";
import { consumeActionBanner, writeActionBanner, type ActionBanner } from "@/lib/actionBanner";
import {
  fetchAccountById,
  fetchAccountsForSearch,
  fetchFollowingIds,
  fetchFollowNotifications,
  markFollowNotificationsRead,
  readAccountSessionId,
  type AppAccount,
  type AppFollowNotification,
} from "@/lib/accounts";
import { fetchBoardsByAccount, savePostToBoard } from "@/lib/boards";
import { fetchCommentNotifications, markCommentNotificationsRead, type AppCommentNotification } from "@/lib/postComments";
import { fetchLikeNotifications, markLikeNotificationsRead, type AppLikeNotification } from "@/lib/postLikes";
import { fetchAppPosts, type AppPost } from "@/lib/posts";
import { isExploreCategoryFilter, tagForExploreFilter, type ExploreCategoryFilter } from "@/lib/postTags";

const worldView = { center: [-25, 22] as [number, number], zoom: 1.35 };
const mapExploreZoomThreshold = 3.25;
const exploreStateStorageKey = "odyssey-explore-view-state-v1";
const appPostsCacheKey = "odyssey-app-posts-cache-v2";
const appPostsLocalCacheKey = "odyssey-app-posts-cache-v3";
const appPostsLocalCacheMaxAgeMs = 1000 * 60 * 60 * 6;
let hasCompletedExploreColdLoad = false;

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
type ExploreNotification = (AppCommentNotification & { type: "comment" }) | AppLikeNotification | AppFollowNotification;

type MapView = {
  center: [number, number];
  zoom?: number;
};

type StoredExploreState = {
  activeDestination: string;
  activeCategoryFilters: ExploreCategoryFilter[];
  activeFilter: string;
  currentMapView: MapView;
  exploreSource: "search" | "map";
  mapArea: MapArea | null;
  profileAccountId: string | null;
  profileUsername: string | null;
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

  const searchableText = `${post.title} ${post.location} ${post.caption} ${(post.tags ?? []).join(" ")}`.toLowerCase();
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

function filterPostsByExploreFilter(
  posts: AppPost[],
  activeFilter: string,
  activeCategoryFilters: ExploreCategoryFilter[],
  followingIds: string[],
  viewerId: string | null,
  profileAccountId: string | null,
) {
  const filterablePosts = profileAccountId ? posts.filter((post) => post.accountId === profileAccountId) : posts;
  const sourcePosts =
    activeFilter === "All"
      ? filterablePosts
      : activeFilter === "Mine"
        ? viewerId
          ? filterablePosts.filter((post) => post.accountId === viewerId)
          : []
        : filterablePosts.filter((post) => followingIds.includes(post.accountId));

  if (!activeCategoryFilters.length) {
    return sourcePosts;
  }

  const tags = activeCategoryFilters.map(tagForExploreFilter);

  return sourcePosts.filter((post) => tags.some((tag) => (post.tags ?? []).includes(tag)));
}

function recommendationSubtitleSuffix(activeFilter: string, activeCategoryFilters: ExploreCategoryFilter[], profileUsername: string | null) {
  const categorySuffix = activeCategoryFilters.length ? `, filtered by ${activeCategoryFilters.join(", ")}` : "";

  if (profileUsername) {
    return `from @${profileUsername}${categorySuffix}`;
  }

  if (activeFilter === "Friends") {
    return `from people you follow${categorySuffix}`;
  }

  if (activeFilter === "Mine") {
    return `from you${categorySuffix}`;
  }

  return `from all travelers${categorySuffix}`;
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
      activeCategoryFilters: Array.isArray(parsed.activeCategoryFilters)
        ? parsed.activeCategoryFilters.filter((filter): filter is ExploreCategoryFilter => typeof filter === "string" && isExploreCategoryFilter(filter))
        : typeof parsed.activeFilter === "string" && isExploreCategoryFilter(parsed.activeFilter)
          ? [parsed.activeFilter]
          : [],
      activeFilter: isExploreFilter(parsed.activeFilter) && !isExploreCategoryFilter(parsed.activeFilter) ? parsed.activeFilter : "Friends",
      currentMapView: {
        center: parsed.currentMapView.center,
        zoom: typeof parsed.currentMapView.zoom === "number" ? parsed.currentMapView.zoom : worldView.zoom,
      },
      exploreSource: parsed.exploreSource === "map" ? "map" : "search",
      mapArea: parsed.mapArea && isCoordinatePair(parsed.mapArea.center) ? parsed.mapArea : null,
      profileAccountId: typeof parsed.profileAccountId === "string" ? parsed.profileAccountId : null,
      profileUsername: typeof parsed.profileUsername === "string" ? parsed.profileUsername : null,
      searchQuery: typeof parsed.searchQuery === "string" ? parsed.searchQuery : "",
      selectedPostId: typeof parsed.selectedPostId === "string" ? parsed.selectedPostId : null,
      sheetPosition: isSheetPosition(parsed.sheetPosition) ? parsed.sheetPosition : "peek",
    };

    if (
      isDefaultWorldView(restoredState.currentMapView) &&
      !restoredState.activeDestination &&
      !restoredState.searchQuery &&
      !restoredState.mapArea &&
      !restoredState.profileAccountId &&
      !restoredState.selectedPostId
    ) {
      return null;
    }

    return restoredState;
  } catch {
    return null;
  }
}

function isExploreFilter(value: unknown): value is string {
  return value === "Mine" || value === "Friends" || value === "All";
}

function formatNotificationTime(value: string) {
  const timestamp = new Date(value).getTime();

  if (!Number.isFinite(timestamp)) {
    return "";
  }

  const seconds = Math.max(0, Math.floor((Date.now() - timestamp) / 1000));

  if (seconds < 60) {
    return "Just now";
  }

  const minutes = Math.floor(seconds / 60);

  if (minutes < 60) {
    return `${minutes}m ago`;
  }

  const hours = Math.floor(minutes / 60);

  if (hours < 24) {
    return `${hours}h ago`;
  }

  const days = Math.floor(hours / 24);

  if (days < 7) {
    return `${days}d ago`;
  }

  return new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric" }).format(new Date(value));
}

function writeStoredExploreState(state: StoredExploreState) {
  try {
    window.sessionStorage.setItem(exploreStateStorageKey, JSON.stringify(state));
  } catch {
    // Explore can still work if private browsing or storage settings block session storage.
  }
}

function readCachedAppPosts() {
  if (typeof window === "undefined") {
    return [];
  }

  try {
    const cached = window.sessionStorage.getItem(appPostsCacheKey);
    if (cached) {
      return JSON.parse(cached) as AppPost[];
    }

    const localCached = window.localStorage.getItem(appPostsLocalCacheKey);
    const parsed = localCached ? (JSON.parse(localCached) as { savedAt?: number; value?: AppPost[] }) : null;

    if (parsed?.value?.length && typeof parsed.savedAt === "number" && Date.now() - parsed.savedAt <= appPostsLocalCacheMaxAgeMs) {
      return parsed.value;
    }

    return [];
  } catch {
    return [];
  }
}

function writeCachedAppPosts(posts: AppPost[]) {
  try {
    window.sessionStorage.setItem(appPostsCacheKey, JSON.stringify(posts));
    window.localStorage.setItem(appPostsLocalCacheKey, JSON.stringify({ savedAt: Date.now(), value: posts }));
  } catch {
    try {
      window.localStorage.setItem(appPostsLocalCacheKey, JSON.stringify({ savedAt: Date.now(), value: posts }));
    } catch {
      // Explore can still refresh from Supabase if browser storage is unavailable.
    }
  }
}

export default function ExplorePage() {
  const router = useRouter();
  const [restoredExploreState] = useState(() => readStoredExploreState());
  const [exploreSource, setExploreSource] = useState<"search" | "map">(restoredExploreState?.exploreSource ?? "search");
  const [defaultMapView, setDefaultMapView] = useState<MapView>(worldView);
  const [currentMapView, setCurrentMapView] = useState<MapView>(restoredExploreState?.currentMapView ?? worldView);
  const [mapTarget, setMapTarget] = useState<MapView>(restoredExploreState?.currentMapView ?? worldView);
  const [mapArea, setMapArea] = useState<MapArea | null>(restoredExploreState?.mapArea ?? null);
  const [searchQuery, setSearchQuery] = useState(restoredExploreState?.searchQuery ?? "");
  const [activeDestination, setActiveDestination] = useState(restoredExploreState?.activeDestination ?? "");
  const [appPosts, setAppPosts] = useState<AppPost[]>(() => readCachedAppPosts());
  const [appPostsStatus, setAppPostsStatus] = useState<"loading" | "ready">("loading");
  const [followingIds, setFollowingIds] = useState<string[]>([]);
  const [viewerId, setViewerId] = useState<string | null>(null);
  const [viewerPhotoUrl, setViewerPhotoUrl] = useState<string | null>(null);
  const [viewerStatus, setViewerStatus] = useState<"loading" | "ready">("loading");
  const [commentNotifications, setCommentNotifications] = useState<AppCommentNotification[]>([]);
  const [followNotifications, setFollowNotifications] = useState<AppFollowNotification[]>([]);
  const [likeNotifications, setLikeNotifications] = useState<AppLikeNotification[]>([]);
  const [unreadNotificationCount, setUnreadNotificationCount] = useState(0);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [notificationStatus, setNotificationStatus] = useState<"idle" | "loading">("idle");
  const [notificationsHydrated, setNotificationsHydrated] = useState(false);
  const [notificationMessage, setNotificationMessage] = useState("");
  const [userLocation, setUserLocation] = useState<[number, number] | null>(null);
  const [mapboxSuggestions, setMapboxSuggestions] = useState<SearchSuggestion[]>([]);
  const [accountSearchAccounts, setAccountSearchAccounts] = useState<AppAccount[]>([]);
  const [searchFocused, setSearchFocused] = useState(false);
  const [activeFilter, setActiveFilter] = useState(restoredExploreState?.activeFilter ?? "Friends");
  const [activeCategoryFilters, setActiveCategoryFilters] = useState<ExploreCategoryFilter[]>(restoredExploreState?.activeCategoryFilters ?? []);
  const [profileAccountId, setProfileAccountId] = useState<string | null>(restoredExploreState?.profileAccountId ?? null);
  const [profileUsername, setProfileUsername] = useState<string | null>(restoredExploreState?.profileUsername ?? null);
  const [categoriesOpen, setCategoriesOpen] = useState(false);
  const [sheetPosition, setSheetPosition] = useState<SheetPosition>("peek");
  const [sheetDragOffset, setSheetDragOffset] = useState(0);
  const [selectedPostId, setSelectedPostId] = useState<string | null>(restoredExploreState?.selectedPostId ?? null);
  const [actionBanner, setActionBanner] = useState<ActionBanner | null>(null);
  const [saveMessage, setSaveMessage] = useState("");
  const [savingPostId, setSavingPostId] = useState<string | null>(null);
  const [savedPostIds, setSavedPostIds] = useState<Set<string>>(() => new Set());
  const [shouldShowColdLoadScreen, setShouldShowColdLoadScreen] = useState(() => !hasCompletedExploreColdLoad);
  const [coldLoadIntroComplete, setColdLoadIntroComplete] = useState(() => hasCompletedExploreColdLoad);
  const dragStartPoint = useRef<{ position: SheetPosition; x: number; y: number } | null>(null);
  const feedPostIdsRef = useRef<string[]>([]);
  const userChangedFilterRef = useRef(false);
  const exploreStateRef = useRef<StoredExploreState>({
    activeDestination: restoredExploreState?.activeDestination ?? "",
    activeCategoryFilters: restoredExploreState?.activeCategoryFilters ?? [],
    activeFilter: restoredExploreState?.activeFilter ?? "Friends",
    currentMapView: restoredExploreState?.currentMapView ?? worldView,
    exploreSource: restoredExploreState?.exploreSource ?? "search",
    mapArea: restoredExploreState?.mapArea ?? null,
    profileAccountId: restoredExploreState?.profileAccountId ?? null,
    profileUsername: restoredExploreState?.profileUsername ?? null,
    searchQuery: restoredExploreState?.searchQuery ?? "",
    selectedPostId: restoredExploreState?.selectedPostId ?? null,
    sheetPosition: "peek",
  });
  const placeSearchSuggestions = useMemo(() => {
    const seen = new Set<string>();

    return mapboxSuggestions.filter((suggestion) => {
      const key = `${suggestion.label}-${suggestion.description ?? ""}`.toLowerCase();

      if (seen.has(key)) {
        return false;
      }

      seen.add(key);
      return true;
    }).map((suggestion) => ({ ...suggestion, type: "place" as const }));
  }, [mapboxSuggestions]);
  const userSearchSuggestions = useMemo(() => {
    const query = searchQuery.trim().replace(/^@+/, "").toLowerCase();
    const sourceAccounts = query
      ? accountSearchAccounts.filter((account) =>
        `${account.username} ${account.currentCity ?? ""}`.toLowerCase().includes(query),
      )
      : accountSearchAccounts;

    return sourceAccounts.slice(0, 5).map((account) => ({
      description: account.currentCity
        ? account.currentCity
        : "Traveler",
      label: `@${account.username}`,
      profilePhotoUrl: account.profilePhotoUrl,
      query: `@${account.username}`,
      type: "user" as const,
      username: account.username,
    }));
  }, [accountSearchAccounts, searchQuery]);
  const searchSuggestions = useMemo(
    () => [...placeSearchSuggestions, ...userSearchSuggestions],
    [placeSearchSuggestions, userSearchSuggestions],
  );
  const notifications = useMemo<ExploreNotification[]>(
    () =>
      [
        ...commentNotifications.map((notification) => ({ ...notification, type: "comment" as const })),
        ...followNotifications,
        ...likeNotifications,
      ].sort((first, second) => new Date(second.createdAt).getTime() - new Date(first.createdAt).getTime()),
    [commentNotifications, followNotifications, likeNotifications],
  );

  useEffect(() => {
    const banner = consumeActionBanner();

    if (!banner) {
      return;
    }

    setActionBanner(banner);
    const timeoutId = window.setTimeout(() => setActionBanner(null), 6500);

    return () => window.clearTimeout(timeoutId);
  }, []);

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
        limit: "8",
        proximity: currentMapView.center.join(","),
        types: "poi,address,neighborhood,locality,place,region,country",
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
  }, [currentMapView.center, searchQuery]);

  useEffect(() => {
    if (typeof navigator === "undefined" || !("geolocation" in navigator)) {
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const nextView = {
          center: [position.coords.longitude, position.coords.latitude] as [number, number],
          zoom: 10.2,
        };

        setUserLocation(nextView.center);
        setDefaultMapView(nextView);
        if (restoredExploreState) {
          return;
        }

        setCurrentMapView(nextView);
        setMapTarget(nextView);
      },
      () => {
        setUserLocation(null);
        if (restoredExploreState) {
          return;
        }

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
      activeCategoryFilters,
      activeFilter,
      currentMapView,
      exploreSource,
      mapArea,
      profileAccountId,
      profileUsername,
      searchQuery,
      selectedPostId,
      sheetPosition,
    } satisfies StoredExploreState;

    exploreStateRef.current = nextState;
    writeStoredExploreState(nextState);
  }, [activeCategoryFilters, activeDestination, activeFilter, currentMapView, exploreSource, mapArea, profileAccountId, profileUsername, searchQuery, selectedPostId, sheetPosition]);

  useEffect(() => {
    let active = true;

    fetchAppPosts()
      .then((sharedPosts) => {
        if (!active) {
          return;
        }

        writeCachedAppPosts(sharedPosts);
        setAppPosts(sharedPosts);
        setAppPostsStatus("ready");
      })
      .catch(() => {
        if (active) {
          // Keep an empty recommendations feed if Supabase is unavailable.
          setAppPostsStatus("ready");
        }
      });

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    const viewerId = readAccountSessionId();
    setViewerId(viewerId);

    if (!viewerId) {
      setFollowingIds([]);
      setViewerPhotoUrl(null);
      setViewerStatus("ready");
      return;
    }

    let active = true;
    setViewerStatus("loading");

    Promise.all([fetchFollowingIds(viewerId), fetchAccountById(viewerId)])
      .then(([ids, account]) => {
        if (active) {
          setFollowingIds(ids);
          setViewerPhotoUrl(account?.profilePhotoUrl ?? null);
          if (!restoredExploreState && !userChangedFilterRef.current && ids.length === 0) {
            setActiveFilter("All");
          }
        }
      })
      .catch(() => {
        if (active) {
          setFollowingIds([]);
          setViewerPhotoUrl(null);
        }
      })
      .finally(() => {
        if (active) {
          setViewerStatus("ready");
        }
      });

    return () => {
      active = false;
    };
  }, [restoredExploreState]);

  useEffect(() => {
    if (!viewerId) {
      setSavedPostIds(new Set());
      return;
    }

    let active = true;

    fetchBoardsByAccount(viewerId)
      .then((boards) => {
        if (active) {
          setSavedPostIds(new Set(boards.flatMap((board) => board.postIds)));
        }
      })
      .catch(() => {
        if (active) {
          setSavedPostIds(new Set());
        }
      });

    return () => {
      active = false;
    };
  }, [viewerId]);

  useEffect(() => {
    if (!searchFocused || accountSearchAccounts.length) {
      return;
    }

    let active = true;

    fetchAccountsForSearch()
      .then((accounts) => {
        if (active) {
          setAccountSearchAccounts(accounts);
        }
      })
      .catch(() => {
        if (active) {
          setAccountSearchAccounts([]);
        }
      });

    return () => {
      active = false;
    };
  }, [accountSearchAccounts.length, searchFocused]);

  useEffect(() => {
    if (!viewerId) {
      setCommentNotifications([]);
      setFollowNotifications([]);
      setLikeNotifications([]);
      setUnreadNotificationCount(0);
      setNotificationStatus("idle");
      setNotificationsHydrated(true);
      return;
    }

    let active = true;

    setNotificationMessage("");
    setNotificationStatus("loading");
    setNotificationsHydrated(false);

    Promise.all([fetchCommentNotifications(viewerId), fetchFollowNotifications(viewerId), fetchLikeNotifications(viewerId)])
      .then(([comments, follows, likes]) => {
        if (active) {
          setCommentNotifications(comments);
          setFollowNotifications(follows);
          setLikeNotifications(likes);
          setUnreadNotificationCount(
            comments.filter((notification) => !notification.isRead).length +
            follows.filter((notification) => !notification.isRead).length +
            likes.filter((notification) => !notification.isRead).length,
          );
          setNotificationStatus("idle");
          setNotificationsHydrated(true);
        }
      })
      .catch((error) => {
        if (active) {
          setNotificationMessage(error instanceof Error ? error.message : "Unable to load notifications.");
          setNotificationStatus("idle");
          setNotificationsHydrated(true);
        }
      });

    return () => {
      active = false;
    };
  }, [viewerId]);

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
      types: "poi,address,neighborhood,locality,place,region,country",
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

    if (suggestion.type === "user" && suggestion.username) {
      setSearchQuery("");
      setSearchFocused(false);
      router.push(`/accounts/${suggestion.username}`);
      return;
    }

    setSearchQuery(query);

    if (suggestion.center) {
      enterExploreAt(suggestion.center, suggestion.zoom, query);
      return;
    }

    void handleMapSearch(query);
  }, [enterExploreAt, handleMapSearch, router]);

  const handleResetToWorld = useCallback(() => {
    const nextView = userLocation ? { center: userLocation, zoom: 10.2 } : defaultMapView;

    setSearchQuery("");
    setExploreSource("search");
    setActiveDestination("");
    setMapArea(null);
    setProfileAccountId(null);
    setProfileUsername(null);
    setSheetPosition("peek");
    setSelectedPostId(null);
    setCurrentMapView(nextView);
    setMapTarget(nextView);
  }, [defaultMapView, userLocation]);

  const handleCategoryToggle = useCallback((filter: ExploreCategoryFilter) => {
    setActiveCategoryFilters((current) =>
      current.includes(filter) ? current.filter((item) => item !== filter) : [...current, filter],
    );
    setSelectedPostId(null);
    setSheetPosition("peek");
  }, []);

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

  const markVisibleNotificationsRead = useCallback(() => {
    if (!viewerId || unreadNotificationCount === 0) {
      return;
    }

    const unreadCommentIds = commentNotifications.filter((notification) => !notification.isRead).map((notification) => notification.id);
    const unreadFollowIds = followNotifications.filter((notification) => !notification.isRead).map((notification) => notification.followId);
    const unreadLikeIds = likeNotifications.filter((notification) => !notification.isRead).map((notification) => notification.id);

    setCommentNotifications((current) => current.map((notification) => ({ ...notification, isRead: true })));
    setFollowNotifications((current) => current.map((notification) => ({ ...notification, isRead: true })));
    setLikeNotifications((current) => current.map((notification) => ({ ...notification, isRead: true })));
    setUnreadNotificationCount(0);

    void Promise.all([
      markCommentNotificationsRead(viewerId, unreadCommentIds),
      markFollowNotificationsRead(viewerId, unreadFollowIds),
      markLikeNotificationsRead(viewerId, unreadLikeIds),
    ]).catch((error) => {
      setNotificationMessage(error instanceof Error ? error.message : "Unable to update notifications.");
    });
  }, [commentNotifications, followNotifications, likeNotifications, unreadNotificationCount, viewerId]);

  const closeNotifications = useCallback(() => {
    setNotificationsOpen(false);
    markVisibleNotificationsRead();
  }, [markVisibleNotificationsRead]);

  const handleNotificationToggle = useCallback(() => {
    setNotificationsOpen((open) => {
      if (open) {
        markVisibleNotificationsRead();
      }

      return !open;
    });
  }, [markVisibleNotificationsRead]);

  const handleNotificationOpen = useCallback(
    (notification: ExploreNotification) => {
      setNotificationsOpen(false);

      if (!viewerId || notification.isRead) {
        return;
      }

      if (notification.type === "follow") {
        setFollowNotifications((current) =>
          current.map((item) => (item.id === notification.id ? { ...item, isRead: true } : item)),
        );
        setUnreadNotificationCount((count) => Math.max(0, count - 1));
        void markFollowNotificationsRead(viewerId, [notification.followId]).catch((error) => {
          setNotificationMessage(error instanceof Error ? error.message : "Unable to update notifications.");
        });
        return;
      }

      if (notification.type === "like") {
        setLikeNotifications((current) =>
          current.map((item) => (item.id === notification.id ? { ...item, isRead: true } : item)),
        );
        setUnreadNotificationCount((count) => Math.max(0, count - 1));
        void markLikeNotificationsRead(viewerId, [notification.id]).catch((error) => {
          setNotificationMessage(error instanceof Error ? error.message : "Unable to update notifications.");
        });
        return;
      }

      setCommentNotifications((current) =>
        current.map((item) => (item.id === notification.id ? { ...item, isRead: true } : item)),
      );
      setUnreadNotificationCount((count) => Math.max(0, count - 1));
      void markCommentNotificationsRead(viewerId, [notification.id]).catch((error) => {
        setNotificationMessage(error instanceof Error ? error.message : "Unable to update notifications.");
      });
    },
    [viewerId],
  );

  const handleMapInteraction = useCallback(() => {
    setSheetPosition("minimized");
  }, []);

  const handleSaveToLatestBoard = useCallback(
    async (post: AppPost) => {
      if (!viewerId || savingPostId) {
        setSaveMessage(viewerId ? "" : "Log in to save posts.");
        return;
      }

      setSavingPostId(post.id);
      setSaveMessage("");

      try {
        const boards = await fetchBoardsByAccount(viewerId);
        const latestBoard = [...boards].sort((left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime())[0];

        if (!latestBoard) {
          setSaveMessage("Create a board before saving posts.");
          return;
        }

        await savePostToBoard(latestBoard.id, post.id, post.imageUrl ?? undefined);
        setSavedPostIds((current) => new Set([...current, post.id]));

        const banner = {
          href: `/posts/${post.id}`,
          imageUrl: post.imageUrl,
          mediaType: post.mediaTypes[0],
          message: `Saved to ${latestBoard.title}`,
          title: post.title,
          type: "post-saved",
        } satisfies ActionBanner;

        writeActionBanner(banner);
        setActionBanner(banner);
        window.setTimeout(() => setActionBanner(null), 6500);
      } catch (error) {
        setSaveMessage(error instanceof Error ? error.message : "Unable to save this post.");
      } finally {
        setSavingPostId(null);
      }
    },
    [savingPostId, viewerId],
  );

  const recommendationPosts = useMemo(() => appPosts.filter((post) => post.type !== "trip"), [appPosts]);

  const handleMapMoveEnd = useCallback(async ({ bounds, center, zoom }: { bounds: MapBounds; center: [number, number]; zoom: number }) => {
    const sourcePosts = filterPostsByExploreFilter(recommendationPosts, activeFilter, activeCategoryFilters, followingIds, viewerId, profileAccountId);
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
  }, [activeCategoryFilters, activeFilter, exploreSource, followingIds, profileAccountId, recommendationPosts, viewerId]);

  const filteredPosts = useMemo(
    () => filterPostsByExploreFilter(recommendationPosts, activeFilter, activeCategoryFilters, followingIds, viewerId, profileAccountId),
    [activeCategoryFilters, activeFilter, followingIds, profileAccountId, recommendationPosts, viewerId],
  );
  const searchText = activeDestination || searchQuery;
  const searchPosts = searchText ? filteredPosts.filter((post) => postSearchHasContent(searchText, post)) : filteredPosts;
  const mapAreaPosts = mapArea ? filteredPosts.filter((post) => coordinateInBounds(post.coordinates, mapArea.bounds)) : [];
  const visibleAppPosts = exploreSource === "map" ? mapAreaPosts : searchPosts;
  const selectedPost = selectedPostId ? visibleAppPosts.find((post) => post.id === selectedPostId) ?? null : null;
  const feedPosts = useMemo(
    () => (selectedPost ? [selectedPost, ...visibleAppPosts.filter((post) => post.id !== selectedPost.id)] : visibleAppPosts),
    [selectedPost, visibleAppPosts],
  );
  const peekPosts = feedPosts;
  const feedPostIds = useMemo(() => feedPosts.map((post) => post.id), [feedPosts]);
  const recommendationCount = visibleAppPosts.length;
  const recommendationsLoading = appPostsStatus === "loading" && !feedPosts.length;
  const exploreReady = appPostsStatus === "ready" && viewerStatus === "ready" && notificationsHydrated;
  const showExploreColdLoadScreen = shouldShowColdLoadScreen && (!exploreReady || !coldLoadIntroComplete);
  const recommendationSubtitle =
    recommendationCount > 0
      ? `${recommendationCount} ${recommendationCount === 1 ? "recommendation" : "recommendations"} ${recommendationSubtitleSuffix(activeFilter, activeCategoryFilters, profileUsername)}`
      : profileUsername
        ? `@${profileUsername} has no recommendations here yet`
        : activeFilter === "Friends"
          ? "Follow accounts to see their recommendations here"
          : activeFilter === "Mine"
            ? "Your recommendations will show up here"
            : "No recommendations in this area yet";

  useEffect(() => {
    feedPostIdsRef.current = feedPostIds;
  }, [feedPostIds]);

  const sheetClassName =
    sheetPosition === "expanded"
      ? "nav-cleared-bottom top-[82px] pb-4"
      : sheetPosition === "minimized"
        ? "nav-cleared-bottom h-[76px] pb-3"
        : "nav-cleared-bottom h-[40%] pb-3";
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

  useEffect(() => {
    if (!shouldShowColdLoadScreen || coldLoadIntroComplete) {
      return;
    }

    const timeoutId = window.setTimeout(() => setColdLoadIntroComplete(true), 2500);

    return () => window.clearTimeout(timeoutId);
  }, [coldLoadIntroComplete, shouldShowColdLoadScreen]);

  useEffect(() => {
    if (!exploreReady || !coldLoadIntroComplete || !shouldShowColdLoadScreen) {
      return;
    }

    hasCompletedExploreColdLoad = true;
    setShouldShowColdLoadScreen(false);
  }, [coldLoadIntroComplete, exploreReady, shouldShowColdLoadScreen]);

  function handleSheetPointerDown(event: PointerEvent<HTMLElement>) {
    event.currentTarget.setPointerCapture(event.pointerId);
    dragStartPoint.current = { position: sheetPosition, x: event.clientX, y: event.clientY };
    setSheetDragOffset(0);
  }

  function handleSheetPointerMove(event: PointerEvent<HTMLElement>) {
    const start = dragStartPoint.current;

    if (!start) {
      return;
    }

    const deltaX = event.clientX - start.x;
    const deltaY = event.clientY - start.y;

    if (Math.abs(deltaY) < 8 || Math.abs(deltaY) < Math.abs(deltaX) * 1.1) {
      return;
    }

    const maxUp = start.position === "expanded" ? 0 : start.position === "peek" ? 260 : 540;
    const maxDown = start.position === "minimized" ? 0 : start.position === "peek" ? 220 : 420;
    setSheetDragOffset(Math.max(-maxUp, Math.min(maxDown, deltaY)));
  }

  function handleSheetPointerUp(event: PointerEvent<HTMLElement>) {
    const start = dragStartPoint.current;

    if (!start) {
      return;
    }

    const deltaX = event.clientX - start.x;
    const deltaY = event.clientY - start.y;
    dragStartPoint.current = null;
    setSheetDragOffset(0);

    if (Math.abs(deltaY) < 28 || Math.abs(deltaY) < Math.abs(deltaX) * 1.1) {
      return;
    }

    if (start.position === "minimized") {
      setSheetPosition(deltaY < -170 ? "expanded" : deltaY < -40 ? "peek" : "minimized");
      return;
    }

    if (start.position === "peek") {
      setSheetPosition(deltaY < -120 ? "expanded" : deltaY > 120 ? "minimized" : "peek");
      return;
    }

    setSheetPosition(deltaY > 210 ? "minimized" : deltaY > 70 ? "peek" : "expanded");
  }

  function handleSheetPointerCancel() {
    dragStartPoint.current = null;
    setSheetDragOffset(0);
  }

  return (
    <MobileFrame>
      <section className="relative h-full bg-white">
        <DynamicMapboxMap
          appPosts={visibleAppPosts}
          className={mapClassName}
          experiences={[]}
          mapTarget={mapTarget}
          onMapInteraction={handleMapInteraction}
          onMoveEnd={handleMapMoveEnd}
          onPostSelect={handleAppPostSelect}
          selectedPostId={selectedPostId ?? undefined}
          userLocation={userLocation}
          zoom={1.35}
        />
        {actionBanner ? (
          <div className="pointer-events-none absolute inset-x-0 top-0 z-[60] px-4 pt-[calc(var(--safe-area-top)+18px)]">
            <Link
              className="pointer-events-auto flex items-center gap-3 rounded-[24px] bg-white/96 p-2 pr-4 text-left shadow-lift backdrop-blur"
              href={actionBanner.href}
            >
              {actionBanner.imageUrl ? (
                <PostMediaPreview
                  className="h-14 w-14 shrink-0 rounded-[18px] object-cover"
                  mediaType={actionBanner.mediaType}
                  src={actionBanner.imageUrl}
                />
              ) : (
                <span className="grid h-14 w-14 shrink-0 place-items-center rounded-[18px] bg-shell text-coral">
                  <MapPin aria-hidden="true" size={20} />
                </span>
              )}
              <span className="min-w-0 flex-1">
                <span className="block text-xs font-black uppercase tracking-[0.12em] text-coral">{actionBanner.message}</span>
                <span className="mt-0.5 block truncate text-sm font-black text-ink">{actionBanner.title}</span>
              </span>
              <span className="text-xs font-black text-ink/42">View</span>
            </Link>
          </div>
        ) : null}
        <div
          className={`absolute inset-x-0 top-0 bg-gradient-to-b from-white/55 via-white/18 to-transparent px-4 pb-10 pt-[calc(var(--safe-area-top)+18px)] ${
            searchFocused ? "z-40" : "z-20"
          }`}
        >
          <div className="flex items-center gap-3">
            <div className="min-w-0 flex-1">
              <SearchBar
                compact
                onFocusChange={setSearchFocused}
                onSearch={handleMapSearch}
                onSuggestionSelect={handleSuggestionSelect}
                onValueChange={setSearchQuery}
                placeholder="Explore places, people, or interests"
                showBackButtonOnFocus={false}
                suggestions={searchSuggestions}
                value={searchQuery}
              />
            </div>
            <button
              aria-label="Open notifications"
              className="relative flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-white text-ink shadow-lift"
              onClick={handleNotificationToggle}
              type="button"
            >
              <Bell aria-hidden="true" size={20} />
              {unreadNotificationCount ? (
                <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-coral px-1 text-[10px] font-black leading-none text-white">
                  {unreadNotificationCount > 9 ? "9+" : unreadNotificationCount}
                </span>
              ) : null}
            </button>
          </div>
          {profileUsername ? (
            <div className="mt-3 inline-flex h-10 items-center rounded-full bg-white px-4 text-sm font-black text-ink shadow-lift">
              @{profileUsername}&apos;s map
            </div>
          ) : (
            <FilterChips
              active={activeFilter}
              activeCategoryFilters={activeCategoryFilters}
              categoriesOpen={categoriesOpen}
              onCategoryToggle={handleCategoryToggle}
              onChange={(filter) => {
                userChangedFilterRef.current = true;
                setActiveFilter(filter);
                setSelectedPostId(null);
                setSheetPosition("peek");
              }}
              onToggleCategories={() => setCategoriesOpen((open) => !open)}
              userPhotoUrl={viewerPhotoUrl}
            />
          )}
        </div>
        <div
          className={`absolute inset-0 z-50 bg-ink/24 transition-opacity duration-300 ${
            notificationsOpen ? "pointer-events-auto opacity-100" : "pointer-events-none opacity-0"
          }`}
          onClick={closeNotifications}
        />
        <aside
          className={`absolute bottom-0 right-0 top-0 z-50 flex w-[88%] max-w-sm flex-col bg-white shadow-[-18px_0_42px_rgba(24,35,31,0.18)] transition-transform duration-300 ease-out ${
            notificationsOpen ? "translate-x-0" : "translate-x-full"
          }`}
        >
          <div className="border-b border-ink/8 px-5 pb-4 pt-[calc(var(--safe-area-top)+18px)]">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.16em] text-coral">Notifications</p>
                <h2 className="mt-1 text-2xl font-black text-ink">Notifications</h2>
              </div>
              <button
                aria-label="Close notifications"
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-shell text-ink"
                onClick={closeNotifications}
                type="button"
              >
                <X aria-hidden="true" size={18} />
              </button>
            </div>
            {unreadNotificationCount ? (
              <p className="mt-2 text-xs font-bold text-ink/50">
                {unreadNotificationCount} unread {unreadNotificationCount === 1 ? "notification" : "notifications"}
              </p>
            ) : null}
          </div>

          <div className="no-scrollbar flex-1 overflow-y-auto px-4 py-4">
            {!viewerId ? (
              <Link className="flex h-12 items-center justify-center rounded-full bg-shell px-4 text-sm font-black text-ink" href="/accounts">
                Log in to see notifications
              </Link>
            ) : notificationStatus === "loading" ? (
              <p className="rounded-[20px] bg-shell px-4 py-5 text-center text-sm font-bold text-ink/46">Loading notifications...</p>
            ) : notificationMessage ? (
              <p className="rounded-[20px] bg-coral/10 px-4 py-3 text-sm font-bold text-coral">{notificationMessage}</p>
            ) : notifications.length ? (
              <div className="space-y-3">
                {notifications.map((notification) => (
                  <Link
                    className={`relative flex gap-3 rounded-[22px] p-3 ${
                      notification.isRead ? "bg-shell text-ink/76" : "bg-coral/10 text-ink ring-1 ring-coral/18"
                    }`}
                    href={notification.type === "follow" ? `/accounts/${notification.username}` : `/posts/${notification.postId}`}
                    key={`${notification.type}-${notification.id}`}
                    onClick={() => handleNotificationOpen(notification)}
                  >
                    {!notification.isRead ? <span className="absolute right-3 top-3 h-2.5 w-2.5 rounded-full bg-coral" /> : null}
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-full bg-white text-ink/42">
                      {notification.profilePhotoUrl ? (
                        <img alt="" className="h-full w-full object-cover" src={notification.profilePhotoUrl} />
                      ) : notification.type === "like" ? (
                        <Heart aria-hidden="true" size={18} />
                      ) : notification.type === "follow" ? (
                        <UserPlus aria-hidden="true" size={18} />
                      ) : (
                        <MessageCircle aria-hidden="true" size={18} />
                      )}
                    </span>
                    <span className="min-w-0 flex-1 pr-3">
                      <span className="block text-sm font-black leading-tight">
                        @{notification.username}{" "}
                        {notification.type === "follow"
                          ? "started following you"
                          : notification.type === "like"
                            ? "liked your recommendation"
                            : "commented"}
                      </span>
                      {notification.type !== "follow" ? (
                        <span className="mt-0.5 block truncate text-xs font-bold text-ink/50">on {notification.postTitle}</span>
                      ) : null}
                      {notification.type === "comment" ? (
                        <span className="mt-1 line-clamp-3 block text-xs font-semibold leading-snug text-ink/62">{notification.body}</span>
                      ) : null}
                      <span className="mt-2 block text-[10px] font-black uppercase tracking-[0.12em] text-ink/34">
                        {formatNotificationTime(notification.createdAt)}
                      </span>
                    </span>
                  </Link>
                ))}
              </div>
            ) : (
              <p className="rounded-[20px] bg-shell px-4 py-5 text-center text-sm font-bold text-ink/46">No notifications yet.</p>
            )}
          </div>
        </aside>
        <section
          className={`absolute inset-x-0 z-30 rounded-t-[30px] bg-white px-4 pt-0 shadow-[0_-18px_42px_rgba(24,35,31,0.15)] ${
            sheetDragOffset ? "transition-none" : "transition-all duration-300 ease-out"
          } ${sheetClassName}`}
          onPointerCancel={handleSheetPointerCancel}
          onPointerDown={handleSheetPointerDown}
          onPointerMove={handleSheetPointerMove}
          onPointerUp={handleSheetPointerUp}
          style={{ transform: sheetDragOffset ? `translateY(${sheetDragOffset}px)` : undefined }}
        >
          <button
            aria-label={handleLabel}
            className="mx-auto mb-0 flex h-9 w-28 touch-none cursor-grab items-center justify-center rounded-full active:cursor-grabbing"
            onClick={() =>
              setSheetPosition((position) => (position === "minimized" ? "peek" : position === "peek" ? "expanded" : "peek"))
            }
            type="button"
          >
            <span className="block h-1.5 w-[54px] rounded-full bg-[#8f8f8f] shadow-[0_1px_0_rgba(255,255,255,0.8)]" />
          </button>
          <div className={`mb-3 flex items-end justify-between px-1 ${sheetPosition === "minimized" ? "sr-only" : ""}`}>
            <div>
              <h1 className="text-base font-black text-ink">Recommendations</h1>
              <p className="text-[11px] font-semibold text-ink/52">{recommendationSubtitle}</p>
            </div>
          </div>
          {sheetPosition === "minimized" ? (
            <button
              className="flex h-7 w-full items-center justify-center rounded-full text-xs font-extrabold leading-none text-ink/58"
              onClick={() => setSheetPosition("peek")}
              type="button"
            >
              {recommendationCount ? `${recommendationCount} recommendations` : "Recommendations"}
            </button>
          ) : sheetPosition === "expanded" ? (
            feedPosts.length ? (
              <div className="no-scrollbar -mx-4 h-[calc(100%-54px)] space-y-3 overflow-y-auto pb-5">
                {saveMessage ? <p className="mx-4 rounded-[18px] bg-coral/10 px-4 py-3 text-sm font-bold text-coral">{saveMessage}</p> : null}
                {feedPosts.map((post) => (
                  <AppPostFeedCard
                    key={post.id}
                    onOpen={() => handlePostOpen(post)}
                    onSave={handleSaveToLatestBoard}
                    post={post}
                    saveDisabled={savingPostId === post.id}
                    saved={savedPostIds.has(post.id)}
                  />
                ))}
              </div>
            ) : (
              <RecommendationEmptyState activeFilter={activeFilter} isLoading={recommendationsLoading} />
            )
          ) : peekPosts.length ? (
            <div className="no-scrollbar flex gap-2.5 overflow-x-auto pb-2 pt-1">
              {peekPosts.map((post) => (
                <AppPostCard key={post.id} onOpen={() => handlePostOpen(post)} post={post} />
              ))}
            </div>
          ) : (
            <RecommendationEmptyState activeFilter={activeFilter} isLoading={recommendationsLoading} />
          )}
        </section>
        {showExploreColdLoadScreen ? (
          <div className="absolute inset-0 z-[80]">
            <LoadingScreen framed progress={coldLoadIntroComplete ? 74 : 28} />
          </div>
        ) : null}
        <BottomNav activeTab="Explore" onExploreClick={handleResetToWorld} profilePhotoUrl={viewerPhotoUrl} />
      </section>
    </MobileFrame>
  );
}

function RecommendationEmptyState({ activeFilter, isLoading }: { activeFilter: string; isLoading: boolean }) {
  return (
    <div className="flex h-[calc(100%-74px)] items-center justify-center px-8 text-center">
      {isLoading ? (
        <p className="text-sm font-semibold leading-relaxed text-ink/54">Prototype loading, please be patient.</p>
      ) : activeFilter === "Friends" ? (
        <p className="text-sm font-semibold leading-relaxed text-ink/54">
          <span className="block">No followed accounts have recommendations here yet.</span>
          <span className="mt-3 block">Swipe to the All page to browse everyone&apos;s recommendations.</span>
        </p>
      ) : (
        <p className="text-sm font-semibold leading-relaxed text-ink/54">No recommendations here yet.</p>
      )}
    </div>
  );
}
