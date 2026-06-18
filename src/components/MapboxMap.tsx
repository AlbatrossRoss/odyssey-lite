"use client";

import mapboxgl from "mapbox-gl";
import type { FeatureCollection, Polygon } from "geojson";
import { useEffect, useMemo, useRef } from "react";
import type { Experience } from "@/lib/data";
import { getUser } from "@/lib/data";
import type { AppPost } from "@/lib/posts";
import { emojiForPostTag } from "@/lib/postTags";

type MapboxMapProps = {
  experiences: Experience[];
  appPosts?: AppPost[];
  selectedSlug?: string;
  selectedPostId?: string;
  onSelect?: (experience: Experience) => void;
  onPostSelect?: (post: AppPost) => void;
  onMapInteraction?: () => void;
  mapTarget?: {
    center: [number, number];
    zoom?: number;
  };
  onMoveEnd?: (view: {
    bounds: {
      east: number;
      north: number;
      south: number;
      west: number;
    };
    center: [number, number];
    zoom: number;
  }) => void;
  className?: string;
  zoom?: number;
  fitToAppPosts?: boolean;
  interactive?: boolean;
  dark?: boolean;
  userLocation?: [number, number] | null;
  onReady?: () => void;
};

const hawaiiCenter: [number, number] = [-156.45, 20.55];
const markerCounts = [7, 12, 5, 6, 9];
const markerColors = ["#7c5fd6", "#df7b67", "#65a86f", "#9a6bd0", "#ee9a52"];
const islandsGeojson: FeatureCollection<Polygon, { name: string }> = {
  type: "FeatureCollection",
  features: [
    {
      type: "Feature",
      properties: { name: "O‘ahu" },
      geometry: {
        type: "Polygon",
        coordinates: [[
          [-158.29, 21.56],
          [-158.12, 21.71],
          [-157.83, 21.71],
          [-157.65, 21.58],
          [-157.68, 21.37],
          [-157.93, 21.25],
          [-158.21, 21.34],
          [-158.29, 21.56],
        ]],
      },
    },
    {
      type: "Feature",
      properties: { name: "Maui" },
      geometry: {
        type: "Polygon",
        coordinates: [[
          [-156.72, 21.03],
          [-156.48, 21.12],
          [-156.17, 21.01],
          [-155.98, 20.82],
          [-156.05, 20.61],
          [-156.35, 20.55],
          [-156.64, 20.69],
          [-156.72, 21.03],
        ]],
      },
    },
    {
      type: "Feature",
      properties: { name: "Hawai‘i" },
      geometry: {
        type: "Polygon",
        coordinates: [[
          [-156.08, 20.25],
          [-155.74, 20.28],
          [-155.28, 20.11],
          [-154.83, 19.73],
          [-154.81, 19.26],
          [-155.18, 18.92],
          [-155.73, 18.91],
          [-156.04, 19.28],
          [-156.08, 20.25],
        ]],
      },
    },
  ],
};

const localHawaiiStyle: mapboxgl.Style = {
  version: 8,
  sources: {
    islands: {
      type: "geojson",
      data: islandsGeojson,
    },
  },
  layers: [
    {
      id: "ocean",
      type: "background",
      paint: {
        "background-color": "#a9d7ed",
      },
    },
    {
      id: "island-fill",
      type: "fill",
      source: "islands",
      paint: {
        "fill-color": "#6aa45b",
        "fill-opacity": 1,
      },
    },
    {
      id: "island-ridge",
      type: "line",
      source: "islands",
      paint: {
        "line-color": "#4c7b45",
        "line-opacity": 0.58,
        "line-width": 10,
        "line-blur": 8,
      },
    },
    {
      id: "island-outline",
      type: "line",
      source: "islands",
      paint: {
        "line-color": "#ffffff",
        "line-opacity": 1,
        "line-width": 4,
      },
    },
  ],
};

export function MapboxMap({
  experiences,
  appPosts = [],
  selectedSlug,
  selectedPostId,
  onSelect,
  onPostSelect,
  onMapInteraction,
  mapTarget,
  onMoveEnd,
  className = "",
  zoom = 6.35,
  fitToAppPosts = false,
  interactive = true,
  dark = false,
  userLocation = null,
  onReady,
}: MapboxMapProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const markersRef = useRef<mapboxgl.Marker[]>([]);
  const onMoveEndRef = useRef(onMoveEnd);
  const onMapInteractionRef = useRef(onMapInteraction);
  const onSelectRef = useRef(onSelect);
  const onPostSelectRef = useRef(onPostSelect);
  const onReadyRef = useRef(onReady);
  const appPostsRef = useRef(appPosts);
  const experiencesRef = useRef(experiences);
  const readyNotifiedRef = useRef(false);
  const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;
  const hasPositionClass = /\b(absolute|fixed|relative|sticky)\b/.test(className);
  const markerSignature = useMemo(
    () =>
      JSON.stringify({
        appPosts: appPosts.map((post) => [post.id, post.coordinates, post.imageUrl, post.mediaTypes[0], post.profilePhotoUrl, post.tags[0], post.title]),
        experiences: experiences.map((experience) => [experience.slug, experience.coordinates, experience.imageUrl, experience.name, experience.userId]),
        userLocation,
      }),
    [appPosts, experiences, userLocation],
  );

  useEffect(() => {
    onMoveEndRef.current = onMoveEnd;
  }, [onMoveEnd]);

  useEffect(() => {
    onMapInteractionRef.current = onMapInteraction;
  }, [onMapInteraction]);

  useEffect(() => {
    onSelectRef.current = onSelect;
  }, [onSelect]);

  useEffect(() => {
    onPostSelectRef.current = onPostSelect;
  }, [onPostSelect]);

  useEffect(() => {
    onReadyRef.current = onReady;
  }, [onReady]);

  useEffect(() => {
    appPostsRef.current = appPosts;
  }, [appPosts]);

  useEffect(() => {
    experiencesRef.current = experiences;
  }, [experiences]);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) {
      return;
    }

    const mapContainer = containerRef.current;
    mapboxgl.accessToken = token ?? "";
    mapRef.current = new mapboxgl.Map({
      container: mapContainer,
      style: token ? "mapbox://styles/mapbox/outdoors-v12" : localHawaiiStyle,
      center: hawaiiCenter,
      zoom,
      attributionControl: false,
      interactive,
    });
    const notifyReady = () => {
      if (readyNotifiedRef.current) {
        return;
      }

      readyNotifiedRef.current = true;
      onReadyRef.current?.();
    };

    mapRef.current.on("load", () => {
      if (!mapRef.current || !dark || !token) {
        mapRef.current?.once("idle", notifyReady);
        return;
      }

      mapRef.current.setPaintProperty("water", "fill-color", "#17313a");
      mapRef.current.setPaintProperty("land", "background-color", "#1f2d27");
      mapRef.current.setPaintProperty("landuse", "fill-color", "#2f463b");
      mapRef.current.setPaintProperty("national-park", "fill-color", "#2e5142");
      mapRef.current.once("idle", notifyReady);
    });
    mapRef.current.on("moveend", () => {
      if (!mapRef.current) {
        return;
      }

      const center = mapRef.current.getCenter();
      const bounds = mapRef.current.getBounds();
      if (!bounds) {
        return;
      }

      onMoveEndRef.current?.({
        bounds: {
          east: bounds.getEast(),
          north: bounds.getNorth(),
          south: bounds.getSouth(),
          west: bounds.getWest(),
        },
        center: [center.lng, center.lat],
        zoom: mapRef.current.getZoom(),
      });
    });
    mapRef.current.on("dragstart", () => onMapInteractionRef.current?.());
    mapRef.current.on("wheel", () => onMapInteractionRef.current?.());
    const resizeObserver = new ResizeObserver(() => {
      mapRef.current?.resize();
    });
    resizeObserver.observe(mapContainer);

    return () => {
      resizeObserver.disconnect();
      markersRef.current.forEach((marker) => marker.remove());
      markersRef.current = [];
      mapRef.current?.remove();
      mapRef.current = null;
      readyNotifiedRef.current = false;
    };
  }, [dark, interactive, token, zoom]);

  useEffect(() => {
    if (!mapRef.current || !mapTarget) {
      return;
    }

    const flyToTarget = () => {
      mapRef.current?.flyTo({
        center: mapTarget.center,
        zoom: mapTarget.zoom ?? 11,
        duration: 900,
        essential: true,
      });
    };

    if (mapRef.current.loaded()) {
      flyToTarget();
      return;
    }

    mapRef.current.once("load", flyToTarget);
  }, [mapTarget]);

  useEffect(() => {
    if (!mapRef.current || !fitToAppPosts || !appPosts.length) {
      return;
    }

    const fitToPosts = () => {
      if (!mapRef.current) {
        return;
      }

      const bounds = appPosts.reduce((nextBounds, post) => nextBounds.extend(post.coordinates), new mapboxgl.LngLatBounds(appPosts[0].coordinates, appPosts[0].coordinates));

      if (appPosts.length === 1) {
        mapRef.current.flyTo({
          center: appPosts[0].coordinates,
          duration: 700,
          essential: true,
          zoom: 11,
        });
        return;
      }

      mapRef.current.fitBounds(bounds, {
        duration: 700,
        essential: true,
        maxZoom: 11,
        padding: {
          bottom: 96,
          left: 52,
          right: 52,
          top: 52,
        },
      });
    };

    if (mapRef.current.loaded()) {
      fitToPosts();
      return;
    }

    mapRef.current.once("load", fitToPosts);
  }, [appPosts, fitToAppPosts]);

  useEffect(() => {
    if (!mapRef.current) {
      return;
    }

    markersRef.current.forEach((marker) => marker.remove());
    const userLocationMarker = userLocation
      ? (() => {
          const element = document.createElement("span");
          element.className = "odyssey-user-location";
          element.setAttribute("aria-label", "Your current location");

          return new mapboxgl.Marker({ element, anchor: "center" }).setLngLat(userLocation).addTo(mapRef.current!);
        })()
      : null;
    const nextExperiences = experiencesRef.current;
    const nextAppPosts = appPostsRef.current;
    const experienceMarkers = nextExperiences.map((experience) => {
      const element = document.createElement("button");
      element.className = "odyssey-marker";
      element.type = "button";
      element.setAttribute("aria-label", experience.name);
      const user = getUser(experience.userId);
      const index = nextExperiences.findIndex((item) => item.slug === experience.slug);
      element.innerHTML = `
        <span class="odyssey-marker-card" data-selected="false" data-slug="${escapeHtml(experience.slug)}">
          <img class="odyssey-marker-photo" src="${experience.imageUrl}" alt="" />
          <img class="odyssey-marker-avatar" src="${user?.avatarUrl ?? ""}" alt="" />
          <span class="odyssey-marker-count" style="background:${markerColors[index % markerColors.length]}">
            ${markerCounts[index % markerCounts.length]}
          </span>
        </span>
      `;
      const selectExperience = (event: Event) => {
        event.stopPropagation();
        onSelectRef.current?.(experience);
      };
      element.addEventListener("click", selectExperience);
      element.addEventListener("pointerup", selectExperience);

      return new mapboxgl.Marker({ element, anchor: "bottom" }).setLngLat(experience.coordinates).addTo(mapRef.current!);
    });
    const postMarkers = nextAppPosts.map((post) => {
      const element = document.createElement("button");
      element.className = "odyssey-marker";
      element.type = "button";
      element.setAttribute("aria-label", post.title);
      const avatarMarkup = post.profilePhotoUrl ? `<img class="odyssey-marker-avatar" src="${escapeHtml(post.profilePhotoUrl)}" alt="" />` : "";
      const textOnlyEmoji = post.tags[0] ? emojiForPostTag(post.tags[0]) : "📍";
      const isVideoPost = post.imageUrl ? post.mediaTypes[0] === "video" || isVideoUrl(post.imageUrl) : false;
      const mediaMarkup = !post.imageUrl
        ? `<span class="odyssey-marker-text">${escapeHtml(textOnlyEmoji)}</span>`
        : isVideoPost
          ? `<video class="odyssey-marker-photo" src="${escapeHtml(post.imageUrl)}" autoplay loop muted playsinline preload="auto"></video>`
          : `<img class="odyssey-marker-photo" src="${escapeHtml(post.imageUrl)}" alt="" decoding="async" />`;

      element.innerHTML = `
        <span class="odyssey-marker-card" data-post-id="${escapeHtml(post.id)}" data-selected="false">
          ${mediaMarkup}
          ${avatarMarkup}
        </span>
      `;
      const selectPost = (event: Event) => {
        event.stopPropagation();
        onPostSelectRef.current?.(post);
      };
      element.addEventListener("click", selectPost);
      element.addEventListener("pointerup", selectPost);

      const marker = new mapboxgl.Marker({ element, anchor: "bottom" }).setLngLat(post.coordinates).addTo(mapRef.current!);
      const markerVideo = element.querySelector("video");
      if (markerVideo) {
        markerVideo.defaultMuted = true;
        markerVideo.muted = true;
        markerVideo.loop = true;
        markerVideo.playsInline = true;
        markerVideo.setAttribute("muted", "");
        markerVideo.setAttribute("playsinline", "");
        markerVideo.setAttribute("webkit-playsinline", "");
        requestAnimationFrame(() => {
          markerVideo.play().catch(() => undefined);
        });
      }

      return marker;
    });

    markersRef.current = [...(userLocationMarker ? [userLocationMarker] : []), ...experienceMarkers, ...postMarkers];
  }, [markerSignature, userLocation]);

  useEffect(() => {
    containerRef.current?.querySelectorAll<HTMLElement>(".odyssey-marker-card").forEach((element) => {
      const selected = element.dataset.postId === selectedPostId || element.dataset.slug === selectedSlug;
      element.dataset.selected = selected ? "true" : "false";
    });
  }, [markerSignature, selectedPostId, selectedSlug]);

  return (
    <div className={`${hasPositionClass ? "" : "relative"} bg-[#a9d7ed] ${className}`} onWheel={onMapInteraction}>
      <div className="absolute inset-0" ref={containerRef} />
      {!token ? (
        <svg
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 h-full w-full opacity-95"
          preserveAspectRatio="xMidYMid slice"
          viewBox="0 0 393 560"
        >
          <defs>
            <filter id="land-shadow" x="-30%" y="-30%" width="160%" height="160%">
              <feDropShadow dx="0" dy="8" floodColor="#2a6a75" floodOpacity=".22" stdDeviation="8" />
              <feDropShadow dx="0" dy="0" floodColor="#ffffff" floodOpacity=".82" stdDeviation="4" />
            </filter>
            <linearGradient id="land-fill" x1="0%" x2="100%" y1="0%" y2="100%">
              <stop offset="0%" stopColor="#d8e7a9" />
              <stop offset="48%" stopColor="#86b96c" />
              <stop offset="100%" stopColor="#4f8751" />
            </linearGradient>
          </defs>
          <g filter="url(#land-shadow)">
            <path
              d="M42 215 L58 198 L88 187 L125 185 L158 197 L180 218 L163 240 L122 253 L80 246 L50 232 Z"
              fill="url(#land-fill)"
            />
            <path d="M67 218 C98 202 135 204 162 224 M94 190 C88 210 83 230 75 245 M135 190 C126 214 119 235 108 251" className="map-ridge" />
            <path
              d="M235 315 L258 286 L298 273 L340 284 L370 311 L360 340 L321 359 L279 353 L246 335 Z"
              fill="url(#land-fill)"
            />
            <path d="M253 316 C286 297 326 302 357 323 M292 276 C288 306 281 334 270 354 M333 286 C319 311 308 337 292 358" className="map-ridge" />
            <path
              d="M122 400 L150 368 L195 350 L250 356 L304 382 L334 424 L318 467 L266 499 L205 493 L156 467 L122 430 Z"
              fill="url(#land-fill)"
            />
            <path d="M146 405 C195 380 264 388 315 420 M139 432 C194 414 266 424 316 452 M197 354 C188 397 176 436 154 469 M252 360 C240 404 225 450 205 490" className="map-ridge" />
          </g>
          <g fill="#25312d" fontFamily="ui-sans-serif, system-ui" fontWeight="900" letterSpacing="5" opacity=".72">
            <text fontSize="18" x="128" y="236">O‘AHU</text>
            <text fontSize="18" x="292" y="349">MAUI</text>
            <text fontSize="18" x="205" y="466">HAWAI‘I</text>
          </g>
        </svg>
      ) : null}
    </div>
  );
}

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (character) => {
    if (character === "&") return "&amp;";
    if (character === "<") return "&lt;";
    if (character === ">") return "&gt;";
    if (character === '"') return "&quot;";
    return "&#39;";
  });
}

function isVideoUrl(url: string) {
  return /\.(avi|m4v|mov|mp4|webm)(\?|#|$)/i.test(url);
}
