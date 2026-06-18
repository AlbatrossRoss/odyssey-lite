"use client";

import { Calendar, Check, ImagePlus, MapPin, Send, Share2, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { MobileFrame } from "@/components/MobileFrame";
import { readAccountSessionId } from "@/lib/accounts";
import { uploadPostMedia } from "@/lib/media";
import { createAppPost, type AppPost } from "@/lib/posts";
import { postTagOptions, type AppPostTag } from "@/lib/postTags";
import type { SearchSuggestion } from "@/components/SearchBar";

type MediaMetadata = {
  date?: string;
  location?: string;
  coordinates?: [number, number];
};

type SelectedUpload = {
  id: string;
  file: File;
  isHeic: boolean;
  kind: "image" | "video";
  metadata: MediaMetadata;
  posterUrl?: string;
  previewReady: boolean;
  url: string;
};

type PostedSuccess = {
  dateLabel: string;
  description: string;
  href?: string;
  imageUrl: string | null;
  location: string;
  mediaType?: "image" | "video";
  profilePhotoUrl: string | null;
  tags: AppPostTag[];
  title: string;
  username: string;
};

const maxVideoDurationSeconds = 60;
const videoFileExtensions = /\.(avi|m4v|mov|mp4|webm)$/i;
const heicFileExtensions = /\.(heic|heif)$/i;

export default function CreatePage() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const currentCoordinatesRef = useRef<[number, number] | undefined>(undefined);
  const currentLocationRef = useRef("");
  const selectedMediaRef = useRef<SelectedUpload[]>([]);
  const [selectedMedia, setSelectedMedia] = useState<SelectedUpload[]>([]);
  const [activeMediaId, setActiveMediaId] = useState("");
  const [draggedMediaId, setDraggedMediaId] = useState<string | null>(null);
  const [recommendation, setRecommendation] = useState("");
  const [description, setDescription] = useState("");
  const [selectedTags, setSelectedTags] = useState<AppPostTag[]>([]);
  const [location, setLocation] = useState("");
  const [date, setDate] = useState("");
  const [coordinates, setCoordinates] = useState<[number, number] | undefined>();
  const [locationFocused, setLocationFocused] = useState(false);
  const [locationSuggestions, setLocationSuggestions] = useState<SearchSuggestion[]>([]);
  const [status, setStatus] = useState<"idle" | "reading" | "sharing" | "published">("idle");
  const [message, setMessage] = useState("");
  const [postedSuccess, setPostedSuccess] = useState<PostedSuccess | null>(null);
  const canShare =
    recommendation.trim().length > 0 && description.trim().length > 0 && location.trim().length > 0 && status !== "sharing" && status !== "reading";

  useEffect(() => {
    selectedMediaRef.current = selectedMedia;
  }, [selectedMedia]);

  useEffect(() => {
    if (!selectedMedia.length) {
      setActiveMediaId("");
      return;
    }

    if (!activeMediaId || !selectedMedia.some((item) => item.id === activeMediaId)) {
      setActiveMediaId(selectedMedia[0].id);
    }
  }, [activeMediaId, selectedMedia]);

  useEffect(() => {
    return () => {
      selectedMediaRef.current.forEach(revokeSelectedUploadUrls);
    };
  }, []);

  useEffect(() => {
    if (!navigator.geolocation) {
      return;
    }

    let active = true;

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const nextCoordinates: [number, number] = [position.coords.longitude, position.coords.latitude];
        const nextLocation = (await reverseGeocodeCoordinates(nextCoordinates)) ?? formatCoordinates(nextCoordinates);

        if (!active) {
          return;
        }

        currentCoordinatesRef.current = nextCoordinates;
        currentLocationRef.current = nextLocation;
        setCoordinates((current) => current ?? nextCoordinates);
        setLocation((current) => (current.trim() ? current : nextLocation));
      },
      () => undefined,
      { enableHighAccuracy: false, maximumAge: 300000, timeout: 8000 },
    );

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    const query = location.trim();
    const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;

    if (!token || !locationFocused || query.length < 2) {
      setLocationSuggestions([]);
      return;
    }

    const controller = new AbortController();
    const timeoutId = window.setTimeout(async () => {
      const params = new URLSearchParams({
        access_token: token,
        autocomplete: "true",
        language: "en",
        limit: "8",
        types: "poi,address,neighborhood,locality,place,region,country",
      });
      const proximity = coordinates ?? currentCoordinatesRef.current;

      if (proximity) {
        params.set("proximity", proximity.join(","));
      }

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
          }>;
        };

        setLocationSuggestions(
          data.features?.map((feature) => ({
            center: feature.center,
            description: feature.place_name,
            label: feature.text ?? feature.place_name ?? query,
            query: feature.place_name ?? feature.text ?? query,
          })) ?? [],
        );
      } catch {
        if (!controller.signal.aborted) {
          setLocationSuggestions([]);
        }
      }
    }, 220);

    return () => {
      controller.abort();
      window.clearTimeout(timeoutId);
    };
  }, [coordinates, location, locationFocused]);

  async function handleUpload(files: FileList | null) {
    const mediaFiles = Array.from(files ?? []).filter(isSupportedMediaFile);
    const file = mediaFiles[0];

    if (!file) {
      return;
    }

    setStatus("reading");
    setMessage("");

    try {
      const videoFiles = mediaFiles.filter(isVideoFile);
      const videoDurations = await Promise.all(videoFiles.map((item) => readVideoDuration(item)));
      const longVideoIndex = videoDurations.findIndex((duration) => duration > maxVideoDurationSeconds);

      if (longVideoIndex >= 0) {
        setStatus("idle");
        setMessage(`Videos need to be ${maxVideoDurationSeconds} seconds or shorter. Choose a shorter clip and try again.`);
        return;
      }
    } catch {
      setStatus("idle");
      setMessage("We could not read that video. Try a different clip.");
      return;
    }

    const metadataByFile = new Map<File, MediaMetadata>();
    const readSelectedMetadata = async (item: File) => {
      const metadata = await readMediaMetadata(item);
      metadataByFile.set(item, metadata);
      return metadata;
    };
    const selectedMetadata = await Promise.all(mediaFiles.map(readSelectedMetadata));
    const allMetadata = [...selectedMediaRef.current.map((item) => item.metadata), ...selectedMetadata];
    const locationDecision = decidePostLocation(allMetadata);
    const nextCoordinates = locationDecision.coordinates;
    const nextLocation = nextCoordinates ? await reverseGeocodeCoordinates(nextCoordinates) : locationDecision.location;
    const nextDate = allMetadata.find((item) => item.date)?.date ?? fallbackDateFromFile(file);
    const nextMedia = await Promise.all(
      mediaFiles.map(async (item) => ({
        file: item,
        id: `${item.name}-${item.lastModified}-${item.size}`,
        isHeic: isHeicFile(item),
        kind: isVideoFile(item) ? ("video" as const) : ("image" as const),
        metadata: metadataByFile.get(item) ?? {},
        ...(await createPreview(item)),
      })),
    );

    setSelectedMedia((current) => [...current, ...nextMedia]);
    setActiveMediaId((current) => current || nextMedia[0]?.id || "");
    if (nextCoordinates) {
      setCoordinates(nextCoordinates);
    }
    setDate(nextDate);
    setLocation((current) => nextLocation ?? current);
    setStatus("idle");
  }

  async function shareRecommendation() {
    setMessage("");

    if (!recommendation.trim()) {
      setMessage("Add a recommendation before sharing.");
      return;
    }

    if (!description.trim()) {
      setMessage("Add a description before sharing.");
      return;
    }

    const accountId = readAccountSessionId();

    if (!accountId) {
      setMessage("Log in again before sharing.");
      return;
    }

    setStatus("sharing");

    try {
      const resolvedCoordinates = coordinates ?? (location.trim() ? await geocodePlace(location) : undefined);

      if (!resolvedCoordinates) {
        setStatus("idle");
        setMessage("Add a location before sharing.");
        return;
      }

      const mediaUrls = await Promise.all(selectedMedia.map((item) => uploadPostMedia(item.file, accountId)));
      const mediaTypes = selectedMedia.map((item) => item.kind);
      const createdPost = await createAppPost({
        accountId,
        caption: description.trim(),
        coordinates: resolvedCoordinates,
        dateLabel: date || "Just now",
        imageUrl: mediaUrls[0] ?? null,
        mediaTypes,
        mediaUrls,
        tags: selectedTags,
        location: location.trim() || formatCoordinates(resolvedCoordinates),
        title: recommendation.trim(),
        type: "experience",
        visibility: "Public",
      });

      setPostedSuccess(successFromPost(createdPost));
      setStatus("published");
    } catch (error) {
      setStatus("idle");
      setMessage(formatPublishError(error));
    }
  }

  function resetPost() {
    selectedMedia.forEach(revokeSelectedUploadUrls);

    setSelectedMedia([]);
    setActiveMediaId("");
    setRecommendation("");
    setDescription("");
    setSelectedTags([]);
    setLocation(currentLocationRef.current);
    setLocationFocused(false);
    setLocationSuggestions([]);
    setDate("");
    setCoordinates(currentCoordinatesRef.current);
    setStatus("idle");
    setMessage("");
    setPostedSuccess(null);
  }

  function toggleTag(tag: AppPostTag) {
    setSelectedTags((current) => (current.includes(tag) ? current.filter((item) => item !== tag) : [...current, tag]));
  }

  function reorderMedia(sourceId: string, targetId: string) {
    if (sourceId === targetId) {
      return;
    }

    setSelectedMedia((current) => {
      const sourceIndex = current.findIndex((item) => item.id === sourceId);
      const targetIndex = current.findIndex((item) => item.id === targetId);

      if (sourceIndex < 0 || targetIndex < 0) {
        return current;
      }

      const next = [...current];
      const [movedItem] = next.splice(sourceIndex, 1);
      next.splice(targetIndex, 0, movedItem);
      return next;
    });
  }

  function removeActiveMedia() {
    if (!activeMediaId) {
      return;
    }

    setSelectedMedia((current) => {
      const removeIndex = current.findIndex((item) => item.id === activeMediaId);

      if (removeIndex < 0) {
        return current;
      }

      const removedItem = current[removeIndex];
      revokeSelectedUploadUrls(removedItem);
      const next = current.filter((item) => item.id !== activeMediaId);
      setActiveMediaId(next[Math.min(removeIndex, next.length - 1)]?.id ?? "");
      return next;
    });
  }

  function handleMediaPointerMove(event: React.PointerEvent<HTMLButtonElement>) {
    if (!draggedMediaId) {
      return;
    }

    const target = document.elementFromPoint(event.clientX, event.clientY)?.closest<HTMLElement>("[data-media-id]");
    const targetId = target?.dataset.mediaId;

    if (targetId) {
      reorderMedia(draggedMediaId, targetId);
    }
  }

  function finishMediaDrag() {
    setDraggedMediaId(null);
  }

  if (postedSuccess) {
    return (
      <PostedSuccessPage
        onDone={() => {
          resetPost();
          router.push("/explore");
        }}
        onShare={() => void sharePostedSuccess(postedSuccess).catch(() => undefined)}
        onView={() => {
          if (postedSuccess.href) {
            router.push(postedSuccess.href);
            return;
          }

          setPostedSuccess(null);
        }}
        post={postedSuccess}
      />
    );
  }

  const activeMedia = selectedMedia.find((item) => item.id === activeMediaId) ?? selectedMedia[0];

  return (
    <MobileFrame>
      <section className="relative h-full overflow-hidden bg-white text-ink">
        <header className="safe-top-bar bg-white px-5 pb-4">
          <div className="flex items-center justify-between">
            <button
              aria-label="Back to Explore"
              className="-ml-2 flex h-10 w-10 items-center justify-center rounded-full text-ink"
              onClick={() => router.push("/explore")}
              type="button"
            >
              <X aria-hidden="true" size={22} />
            </button>
            <h1 className="text-base font-black text-ink">Add Rec</h1>
            <span className="h-10 w-10" />
          </div>
        </header>

        <div className="app-scroll h-[calc(100%-128px)] overflow-y-auto px-3 pb-32 pt-1">
          <input
            accept="image/*,video/*,.heic,.heif,.mov,.mp4,.m4v"
            className="hidden"
            multiple
            onChange={(event) => void handleUpload(event.target.files)}
            ref={fileInputRef}
            type="file"
          />

          <section>
            <p className="text-xs font-semibold text-ink/56">Add photos or videos</p>
            <button
              aria-label="Choose recommendation media"
              className="relative mt-4 block aspect-[1.34] w-full overflow-hidden rounded-[10px] bg-shell text-ink/46 shadow-[0_10px_24px_rgba(24,35,31,0.08)]"
              onClick={() => fileInputRef.current?.click()}
              type="button"
            >
              {activeMedia ? (
                <MediaPreview className="h-full w-full object-cover" item={activeMedia} />
              ) : (
                <span className="grid h-full place-items-center">
                  <span className="flex flex-col items-center gap-2">
                    <ImagePlus aria-hidden="true" size={34} />
                    <span className="text-sm font-semibold text-ink/56">Add media</span>
                  </span>
                </span>
              )}
              {selectedMedia.length > 1 ? (
                <span className="absolute right-4 top-4 rounded-full bg-ink/58 px-2.5 py-1 text-xs font-black text-white">
                  {selectedMedia.length}
                </span>
              ) : null}
              {activeMedia ? (
                <span
                  aria-label="Remove selected media"
                  className="absolute bottom-3 left-3 grid h-10 w-10 place-items-center rounded-full bg-ink/62 text-white shadow-lift backdrop-blur"
                  onClick={(event) => {
                    event.stopPropagation();
                    removeActiveMedia();
                  }}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault();
                      event.stopPropagation();
                      removeActiveMedia();
                    }
                  }}
                >
                  <X aria-hidden="true" size={18} />
                </span>
              ) : null}
            </button>
          </section>

          {selectedMedia.length ? (
            <section className="mt-3">
              <p className="px-1 text-xs font-semibold text-ink/46">Drag to rearrange</p>
              <div className="-mx-1 mt-1 flex flex-wrap gap-2 px-1 py-1.5">
                {selectedMedia.map((item, index) => (
                  <button
                    aria-label={item.id === activeMediaId ? "Selected media" : `Show media ${index + 1}`}
                    className={`relative h-16 w-16 touch-none overflow-hidden rounded-[10px] bg-shell ring-1 transition ${
                      item.id === activeMediaId ? "ring-2 ring-moss" : "ring-ink/8"
                    } ${draggedMediaId === item.id ? "scale-95 opacity-75" : ""}`}
                    data-media-id={item.id}
                    draggable={selectedMedia.length > 1}
                    key={item.id}
                    onDragEnd={finishMediaDrag}
                    onDragEnter={() => {
                      if (draggedMediaId) {
                        reorderMedia(draggedMediaId, item.id);
                      }
                    }}
                    onDragOver={(event) => event.preventDefault()}
                    onDragStart={(event) => {
                      event.dataTransfer.effectAllowed = "move";
                      event.dataTransfer.setData("text/plain", item.id);
                      setDraggedMediaId(item.id);
                    }}
                    onDrop={finishMediaDrag}
                    onPointerCancel={finishMediaDrag}
                    onPointerDown={(event) => {
                      if (selectedMedia.length > 1) {
                        event.currentTarget.setPointerCapture(event.pointerId);
                        setDraggedMediaId(item.id);
                      }
                    }}
                    onPointerMove={handleMediaPointerMove}
                    onPointerUp={(event) => {
                      if (draggedMediaId === item.id && event.currentTarget.hasPointerCapture(event.pointerId)) {
                        event.currentTarget.releasePointerCapture(event.pointerId);
                      }
                      finishMediaDrag();
                    }}
                    onClick={() => setActiveMediaId(item.id)}
                    type="button"
                  >
                    <MediaPreview className="h-full w-full object-cover" item={item} />
                    {index === 0 ? (
                      <span className="absolute inset-x-1 bottom-1 rounded-full bg-moss px-1.5 py-0.5 text-[10px] font-black text-white">Cover</span>
                    ) : (
                      <span className="absolute right-1 top-1 grid h-5 min-w-5 place-items-center rounded-full bg-ink/60 px-1 text-[10px] font-black text-white">
                        {index + 1}
                      </span>
                    )}
                  </button>
                ))}
                <button
                  aria-label="Add more media"
                  className="grid h-16 w-16 place-items-center rounded-[10px] bg-[#f1efeb] text-ink/56 ring-1 ring-ink/6"
                  onClick={() => fileInputRef.current?.click()}
                  type="button"
                >
                  <ImagePlus aria-hidden="true" size={22} />
                </button>
              </div>
            </section>
          ) : null}

          <section className="mt-6 space-y-4">
            <label className="block">
              <span className="mb-2 block text-sm font-normal text-ink">Recommendation title</span>
              <input
                className="h-12 w-full rounded-[9px] border border-ink/12 bg-white px-3 text-base font-semibold text-ink outline-none placeholder:text-ink/34 focus:border-moss"
                maxLength={80}
                onChange={(event) => setRecommendation(event.target.value)}
                placeholder="e.g. Sunrise from Areopagus Hill"
                value={recommendation}
              />
              <span className="mt-1 block text-right text-xs font-bold text-ink/42">{recommendation.length}/80</span>
            </label>

            <label className="block">
              <span className="mb-2 block text-sm font-normal text-ink">Description</span>
              <textarea
                className="min-h-[106px] w-full resize-none rounded-[9px] border border-ink/12 bg-white px-3 py-3 text-sm font-semibold leading-relaxed text-ink outline-none placeholder:text-ink/34 focus:border-moss"
                maxLength={1000}
                onChange={(event) => setDescription(event.target.value)}
                placeholder="Share what makes this place or experience special."
                value={description}
              />
              <span className="mt-1 block text-right text-xs font-bold text-ink/42">{description.length}/1000</span>
            </label>

            <section>
              <h2 className="mb-2 text-sm font-normal text-ink">Tags</h2>
              <div className="flex flex-wrap gap-2">
                {postTagOptions.map((tag) => {
                  const isSelected = selectedTags.includes(tag);

                  return (
                    <button
                      className={`rounded-full px-3 py-2 text-xs font-normal transition ${
                        isSelected ? "bg-moss text-white shadow-sm" : "bg-[#f1efeb] text-ink/72"
                      }`}
                      key={tag}
                      onClick={() => toggleTag(tag)}
                      type="button"
                    >
                      {tag}
                    </button>
                  );
                })}
              </div>
            </section>

            <section>
              <label className="block">
                <span className="mb-2 block text-sm font-normal text-ink">Location</span>
                <span className="flex h-12 items-center gap-2 rounded-[9px] border border-ink/12 bg-white px-3 text-sm font-semibold text-ink focus-within:border-moss">
                  <MapPin aria-hidden="true" size={15} />
                  <input
                    className="min-w-0 flex-1 bg-transparent font-normal outline-none placeholder:text-ink/34"
                    onBlur={() => window.setTimeout(() => setLocationFocused(false), 140)}
                    onChange={(event) => {
                      setLocation(event.target.value);
                      setCoordinates(undefined);
                    }}
                    onFocus={() => setLocationFocused(true)}
                    placeholder="Add a location"
                    value={location}
                  />
                </span>
                {locationSuggestions.length ? (
                  <div className="mt-2 overflow-hidden rounded-[12px] border border-ink/8 bg-white py-1 shadow-soft">
                    {locationSuggestions.map((suggestion) => (
                      <button
                        className="flex min-h-12 w-full flex-col justify-center px-4 py-2 text-left transition hover:bg-shell"
                        key={`${suggestion.label}-${suggestion.description ?? ""}`}
                        onClick={() => {
                          setLocation(suggestion.query ?? suggestion.label);
                          setCoordinates(suggestion.center);
                          setLocationFocused(false);
                          setLocationSuggestions([]);
                        }}
                        type="button"
                      >
                        <span className="text-sm font-extrabold text-ink">{suggestion.label}</span>
                        {suggestion.description ? <span className="mt-0.5 line-clamp-1 text-xs font-semibold text-ink/54">{suggestion.description}</span> : null}
                      </button>
                    ))}
                  </div>
                ) : null}
              </label>
            </section>

            <label className="block">
              <span className="mb-2 block text-sm font-normal text-ink">Date</span>
              <span className="flex h-12 items-center gap-2 rounded-[9px] border border-ink/12 bg-white px-3 text-sm font-semibold text-ink focus-within:border-moss">
                <Calendar aria-hidden="true" size={15} />
                <input
                  className="min-w-0 flex-1 bg-transparent font-normal outline-none"
                  onChange={(event) => setDate(event.target.value)}
                  type="date"
                  value={date}
                />
              </span>
            </label>
          </section>

          {message ? <p className="mt-5 rounded-2xl bg-coral/10 px-4 py-3 text-sm font-bold text-coral">{message}</p> : null}

          {status === "published" ? (
            <div className="mt-5 rounded-[26px] bg-ink p-5 text-white shadow-soft">
              <div className="mb-3 grid h-11 w-11 place-items-center rounded-full bg-white text-ink">
                <Check aria-hidden="true" size={22} />
              </div>
              <h2 className="text-2xl font-black">Posted</h2>
              <p className="mt-1 text-sm font-semibold leading-relaxed text-white/70">Your rec is now available anywhere shared posts are loaded.</p>
              <button className="mt-4 rounded-full bg-white px-4 py-3 text-sm font-black text-ink" onClick={resetPost} type="button">
                Post another rec
              </button>
            </div>
          ) : null}
        </div>

        <footer className="create-share-bar absolute inset-x-0 z-50 bg-white px-3 py-3">
          <button
            className="flex h-16 w-full items-center justify-center gap-3 rounded-[9px] bg-moss px-5 text-base font-black text-white shadow-lift disabled:opacity-40"
            disabled={!canShare}
            onClick={shareRecommendation}
            type="button"
          >
            <Send aria-hidden="true" size={19} />
            {status === "sharing" ? "Sharing..." : "Share Recommendation"}
          </button>
          <p className="mt-2 px-2 text-center text-[11px] font-medium leading-snug text-ink/44">
            Prototype uploads may take a few moments, please be patient.
          </p>
        </footer>
      </section>
    </MobileFrame>
  );
}

function PostedSuccessPage({
  onDone,
  onShare,
  onView,
  post,
}: {
  onDone: () => void;
  onShare: () => void;
  onView: () => void;
  post: PostedSuccess;
}) {
  return (
    <MobileFrame>
      <section className="safe-top-bar safe-page-bottom flex h-full flex-col overflow-hidden bg-white px-3 text-ink">
        <div className="flex min-h-0 flex-1 flex-col items-center justify-start pt-1">
          <div className="mb-2 text-center">
            <p className="text-sm font-black leading-tight">Posted!</p>
            <div className="relative mx-auto mt-2 grid h-12 w-12 place-items-center rounded-full bg-[#9bc58f] text-white shadow-[0_12px_30px_rgba(77,111,65,0.22)]">
              <Check aria-hidden="true" size={24} strokeWidth={2.8} />
            </div>
            <p className="mx-auto mt-2 max-w-[250px] text-[12px] font-semibold leading-tight text-ink/78">Your recommendation is live and ready to inspire others.</p>
          </div>

          <article className="w-full overflow-hidden rounded-[10px] bg-white shadow-[0_12px_28px_rgba(24,35,31,0.12)]">
            <SuccessMedia imageUrl={post.imageUrl} mediaType={post.mediaType} />
            <div className="relative px-3 pb-2.5 pt-2">
              <div className="-mt-7 mb-1.5 flex items-end gap-2">
                <div className="grid h-9 w-9 shrink-0 place-items-center overflow-hidden rounded-full border-2 border-white bg-shell shadow-sm">
                  {post.profilePhotoUrl ? <img alt="" className="h-full w-full object-cover" src={post.profilePhotoUrl} /> : <span className="text-sm font-black">Y</span>}
                </div>
                <div className="min-w-[58px] max-w-[160px] rounded-full bg-white/95 px-2.5 py-1.5 shadow-sm">
                  <p className="truncate whitespace-nowrap text-[10px] font-black leading-none">{post.username}</p>
                  <p className="mt-1 whitespace-nowrap text-[8px] font-semibold leading-none text-ink/54">just now</p>
                </div>
              </div>
              <h2 className="line-clamp-2 text-[17px] font-black leading-tight">{post.title}</h2>
              <p className="mt-1 line-clamp-1 text-[11px] font-semibold leading-snug text-ink/56">{post.location}</p>
              <p className="mt-0.5 line-clamp-1 text-[11px] font-semibold text-ink/46">{post.dateLabel}</p>
              <p className="mt-1.5 line-clamp-2 text-[11px] font-semibold leading-snug text-ink/70">{post.description}</p>
              {post.tags.length ? (
                <div className="mt-1.5 flex max-h-[24px] flex-wrap gap-1.5 overflow-hidden">
                  {post.tags.slice(0, 4).map((tag) => (
                    <span className="rounded-full bg-[#f1efeb] px-2.5 py-1 text-[9px] font-normal leading-none text-ink/72" key={tag}>
                      {tag}
                    </span>
                  ))}
                  {post.tags.length > 4 ? <span className="rounded-full bg-[#f1efeb] px-2.5 py-1 text-[9px] font-normal leading-none text-ink/72">+{post.tags.length - 4}</span> : null}
                </div>
              ) : null}
            </div>
          </article>
        </div>

        <div className="shrink-0 space-y-2 pt-2.5">
          <button className="flex h-12 w-full items-center justify-center gap-2 rounded-[9px] bg-moss text-sm font-black text-white shadow-lift" onClick={onView} type="button">
            <Send aria-hidden="true" size={17} />
            View Recommendation
          </button>
          <button className="flex h-12 w-full items-center justify-center gap-2 rounded-[9px] bg-[#f5f2ed] text-sm font-black text-ink" onClick={onShare} type="button">
            <Share2 aria-hidden="true" size={17} />
            Share Recommendation
          </button>
          <button className="mx-auto block h-8 px-6 text-xs font-black text-moss" onClick={onDone} type="button">
            Done
          </button>
        </div>
      </section>
    </MobileFrame>
  );
}

function SuccessMedia({ imageUrl, mediaType }: { imageUrl: string | null; mediaType?: "image" | "video" }) {
  if (!imageUrl) {
    return (
      <div className="grid aspect-[2.15] w-full place-items-center bg-shell text-ink/36">
        <ImagePlus aria-hidden="true" size={34} />
      </div>
    );
  }

  if (mediaType === "video") {
    return <video aria-label="Posted recommendation preview" autoPlay className="aspect-[2.15] w-full object-cover" loop muted playsInline src={imageUrl} />;
  }

  return <img alt="" className="aspect-[2.15] w-full object-cover" src={imageUrl} />;
}

function MediaPreview({ className, item }: { className: string; item: SelectedUpload }) {
  if (item.kind === "video") {
    return <video aria-label="Selected video preview" autoPlay className={className} loop muted playsInline src={item.url} />;
  }

  if (item.isHeic && !item.previewReady) {
    return <HeicPreview className={className} />;
  }

  return <img alt="" className={className} src={item.url} />;
}

function isSupportedMediaFile(file: File) {
  return file.type.startsWith("image/") || isHeicFile(file) || isVideoFile(file);
}

function isHeicFile(file: File) {
  return /hei[cf]/i.test(file.type) || heicFileExtensions.test(file.name);
}

function isVideoFile(file: File) {
  return file.type.startsWith("video/") || videoFileExtensions.test(file.name);
}

async function createPreview(file: File) {
  if (isVideoFile(file)) {
    return { previewReady: true, url: URL.createObjectURL(file) };
  }

  if (!isHeicFile(file)) {
    return { previewReady: true, url: URL.createObjectURL(file) };
  }

  try {
    const heic2any = (await import("heic2any")).default;
    const converted = await heic2any({ blob: file, toType: "image/jpeg", quality: 0.82 });
    const previewBlob = Array.isArray(converted) ? converted[0] : converted;

    if (previewBlob) {
      return { previewReady: true, url: URL.createObjectURL(previewBlob) };
    }
  } catch {
    // Keep the HEIC selected even when browser-side conversion is unavailable.
  }

  return { previewReady: false, url: URL.createObjectURL(file) };
}

function revokeSelectedUploadUrls(item: SelectedUpload) {
  URL.revokeObjectURL(item.url);
  if (item.posterUrl) {
    URL.revokeObjectURL(item.posterUrl);
  }
}

function HeicPreview({ className }: { className: string }) {
  return (
    <span className={`${className} grid place-items-center bg-[#f1efeb] text-ink/62`}>
      <span className="flex flex-col items-center gap-1">
        <ImagePlus aria-hidden="true" size={24} strokeWidth={1.9} />
        <span className="text-[10px] font-black">HEIC</span>
      </span>
    </span>
  );
}

function readVideoDuration(file: File) {
  return new Promise<number>((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const video = document.createElement("video");
    const timeoutId = window.setTimeout(() => {
      cleanup();
      reject(new Error("Timed out reading video metadata."));
    }, 8000);

    function cleanup() {
      window.clearTimeout(timeoutId);
      URL.revokeObjectURL(url);
    }

    function finish(duration: number) {
      cleanup();
      resolve(duration);
    }

    video.preload = "metadata";
    video.muted = true;
    video.playsInline = true;
    video.onloadedmetadata = () => {
      if (Number.isFinite(video.duration)) {
        finish(video.duration);
        return;
      }

      video.currentTime = Number.MAX_SAFE_INTEGER;
    };
    video.ontimeupdate = () => finish(Number.isFinite(video.duration) ? video.duration : 0);
    video.onerror = () => {
      cleanup();
      reject(new Error("Unable to read video metadata."));
    };
    video.src = url;
    video.load();
  });
}

async function readMediaMetadata(file: File): Promise<MediaMetadata> {
  if (isVideoFile(file)) {
    return readVideoMetadata(file);
  }

  return readImageMetadata(file);
}

async function readImageMetadata(file: File): Promise<MediaMetadata> {
  const exifrMetadata = await readExifrMetadata(file);

  if (exifrMetadata.coordinates || exifrMetadata.date) {
    return exifrMetadata;
  }

  if (isHeicFile(file)) {
    try {
      return readHeicExif(await file.arrayBuffer());
    } catch {
      return {};
    }
  }

  if (!file.type.includes("jpeg") && !file.type.includes("jpg")) {
    return {};
  }

  try {
    return readJpegExif(await file.arrayBuffer());
  } catch {
    return {};
  }
}

async function readExifrMetadata(file: File): Promise<MediaMetadata> {
  try {
    const exifr = await import("exifr");
    const metadata = await exifr.parse(file, {
      exif: true,
      gps: true,
    });

    if (!metadata) {
      return {};
    }

    const latitude = firstFiniteNumber(metadata.latitude, metadata.GPSLatitude);
    const longitude = firstFiniteNumber(metadata.longitude, metadata.GPSLongitude);
    const dateValue = metadata.DateTimeOriginal ?? metadata.CreateDate ?? metadata.ModifyDate ?? metadata.DateTime;

    return {
      coordinates:
        typeof latitude === "number" && typeof longitude === "number" && Math.abs(latitude) <= 90 && Math.abs(longitude) <= 180
          ? [longitude, latitude]
          : undefined,
      date: normalizeMetadataDate(dateValue),
    };
  } catch {
    return {};
  }
}

function firstFiniteNumber(...values: unknown[]) {
  for (const value of values) {
    if (typeof value === "number" && Number.isFinite(value)) {
      return value;
    }

    if (Array.isArray(value)) {
      const decimal = degreesToDecimal(value.map((item) => Number(item)));
      if (Number.isFinite(decimal)) {
        return decimal;
      }
    }
  }

  return undefined;
}

function normalizeMetadataDate(value: unknown) {
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value.toISOString().slice(0, 10);
  }

  if (typeof value === "string") {
    const normalized = normalizeExifDate(value) || value.match(/\d{4}-\d{2}-\d{2}/)?.[0];
    if (normalized) {
      return normalized;
    }
  }

  return undefined;
}

function readHeicExif(buffer: ArrayBuffer): MediaMetadata {
  const view = new DataView(buffer);
  const exifOffset = findAsciiInBuffer(view, "Exif\u0000\u0000");

  if (exifOffset >= 0) {
    return readTiffExif(view, exifOffset + 6);
  }

  const text = new TextDecoder("latin1").decode(buffer);
  return {
    coordinates: readIso6709Coordinates(text) ?? readGpsCoordinatesFromText(text),
    date: readVideoDateString(text),
  };
}

async function readVideoMetadata(file: File): Promise<MediaMetadata> {
  if (!/\.(m4v|mov|mp4)$/i.test(file.name) && !/(quicktime|mp4)/i.test(file.type)) {
    return {};
  }

  try {
    const buffer = await file.arrayBuffer();
    const text = new TextDecoder("latin1").decode(buffer);
    const atomText = extractMp4MetadataText(buffer);
    const searchableText = `${atomText}\n${text}`;
    const coordinates = readIso6709Coordinates(searchableText) ?? readGpsCoordinatesFromText(searchableText) ?? readLooseCoordinatePair(searchableText);
    const textDate = readVideoDateString(searchableText);
    const atomDate = readMp4CreationDate(buffer);

    return {
      coordinates,
      date: textDate ?? atomDate,
    };
  } catch {
    return {};
  }
}

function extractMp4MetadataText(buffer: ArrayBuffer) {
  const view = new DataView(buffer);
  const values: string[] = [];
  collectMp4TextAtoms(view, 0, view.byteLength, 0, values);
  return values.join("\n");
}

function collectMp4TextAtoms(view: DataView, start: number, end: number, depth: number, values: string[]) {
  if (depth > 8) {
    return;
  }

  let offset = start;

  while (offset + 8 <= end) {
    const size = view.getUint32(offset);
    const type = readAscii(view, offset + 4, 4);
    const headerSize = size === 1 ? 16 : 8;
    const atomSize = size === 1 && offset + 16 <= end ? Number(view.getBigUint64(offset + 8)) : size || end - offset;
    const contentStart = offset + headerSize;
    const contentEnd = Math.min(offset + atomSize, end);

    if (atomSize < headerSize || contentStart > end || contentEnd <= contentStart) {
      break;
    }

    if (["moov", "trak", "mdia", "minf", "stbl", "udta", "meta", "ilst", "keys"].includes(type)) {
      collectMp4TextAtoms(view, type === "meta" ? Math.min(contentStart + 4, contentEnd) : contentStart, contentEnd, depth + 1, values);
    } else if (isLikelyMetadataAtom(type, contentEnd - contentStart)) {
      const value = extractPrintableText(view, contentStart, contentEnd);
      if (value) {
        values.push(type, value);
      }
    }

    offset += atomSize;
  }
}

function isLikelyMetadataAtom(type: string, size: number) {
  return size > 0 && size < 4096 && (type === "data" || type === "loci" || type.startsWith("©") || /^[a-zA-Z0-9._-]{4}$/.test(type));
}

function extractPrintableText(view: DataView, start: number, end: number) {
  const bytes = Array.from({ length: end - start }, (_, index) => view.getUint8(start + index));
  const strings: string[] = [];
  let current = "";

  bytes.forEach((byte) => {
    if (byte >= 32 && byte <= 126) {
      current += String.fromCharCode(byte);
      return;
    }

    if (current.length >= 4) {
      strings.push(current);
    }
    current = "";
  });

  if (current.length >= 4) {
    strings.push(current);
  }

  return strings.join(" ");
}

function readIso6709Coordinates(text: string): [number, number] | undefined {
  const matches = text.matchAll(/([+-]\d{2,3}(?:\.\d+)?)([+-]\d{2,3}(?:\.\d+)?)(?:[+-]\d+(?:\.\d+)?)?\/?/g);

  for (const match of matches) {
    const latitude = Number(match[1]);
    const longitude = Number(match[2]);

    if (Number.isFinite(latitude) && Number.isFinite(longitude) && Math.abs(latitude) <= 90 && Math.abs(longitude) <= 180) {
      return [longitude, latitude];
    }
  }

  return undefined;
}

function readGpsCoordinatesFromText(text: string): [number, number] | undefined {
  const decimalPair = text.match(/GPSLatitude[^+-\d]{0,80}([+-]?\d{1,2}(?:\.\d+)?)[\s\S]{0,220}?GPSLongitude[^+-\d]{0,80}([+-]?\d{1,3}(?:\.\d+)?)/i);
  const reversedDecimalPair = text.match(/GPSLongitude[^+-\d]{0,80}([+-]?\d{1,3}(?:\.\d+)?)[\s\S]{0,220}?GPSLatitude[^+-\d]{0,80}([+-]?\d{1,2}(?:\.\d+)?)/i);
  const nmeaPair = text.match(/([NS])\s*(\d{1,2}(?:\.\d+)?)[^\dEW+-]{0,20}([EW])\s*(\d{1,3}(?:\.\d+)?)/i);
  const latitudeRef = text.match(/GPSLatitudeRef[^NSEW]{0,40}([NS])/i)?.[1];
  const longitudeRef = text.match(/GPSLongitudeRef[^NSEW]{0,40}([EW])/i)?.[1];

  if (decimalPair) {
    return normalizeTextCoordinates(Number(decimalPair[1]), Number(decimalPair[2]), latitudeRef, longitudeRef);
  }

  if (reversedDecimalPair) {
    return normalizeTextCoordinates(Number(reversedDecimalPair[2]), Number(reversedDecimalPair[1]), latitudeRef, longitudeRef);
  }

  if (nmeaPair) {
    return normalizeTextCoordinates(Number(nmeaPair[2]), Number(nmeaPair[4]), nmeaPair[1], nmeaPair[3]);
  }

  return undefined;
}

function readLooseCoordinatePair(text: string): [number, number] | undefined {
  const locationSections = text.match(/(?:location|gps|geo|coordinates?)[\s\S]{0,260}/gi) ?? [];

  for (const section of locationSections) {
    const pair = section.match(/([+-]?\d{1,2}(?:\.\d+)?)[,\s]+([+-]?\d{1,3}(?:\.\d+)?)/);

    if (!pair) {
      continue;
    }

    const coordinates = normalizeTextCoordinates(Number(pair[1]), Number(pair[2]));

    if (coordinates) {
      return coordinates;
    }
  }

  return undefined;
}

function normalizeTextCoordinates(latitude: number, longitude: number, latitudeRef?: string, longitudeRef?: string): [number, number] | undefined {
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude) || Math.abs(latitude) > 90 || Math.abs(longitude) > 180) {
    return undefined;
  }

  const normalizedLatitude = latitude * (latitudeRef?.toUpperCase() === "S" ? -1 : 1);
  const normalizedLongitude = longitude * (longitudeRef?.toUpperCase() === "W" ? -1 : 1);
  return [normalizedLongitude, normalizedLatitude];
}

function readVideoDateString(text: string) {
  const match = text.match(/\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}:\d{2}(?:Z|[+-]\d{2}:?\d{2})?/);
  return match?.[0]?.slice(0, 10);
}

function readMp4CreationDate(buffer: ArrayBuffer) {
  const view = new DataView(buffer);
  const seconds = findMvhdCreationSeconds(view, 0, view.byteLength, 0);

  if (!seconds || seconds < 2082844800) {
    return undefined;
  }

  const timestamp = (seconds - 2082844800) * 1000;
  const date = new Date(timestamp);

  if (Number.isNaN(date.getTime())) {
    return undefined;
  }

  return date.toISOString().slice(0, 10);
}

function findMvhdCreationSeconds(view: DataView, start: number, end: number, depth: number): number | undefined {
  if (depth > 5) {
    return undefined;
  }

  let offset = start;

  while (offset + 8 <= end) {
    const size = view.getUint32(offset);
    const type = readAscii(view, offset + 4, 4);
    const headerSize = size === 1 ? 16 : 8;
    const atomSize = size === 1 && offset + 16 <= end ? Number(view.getBigUint64(offset + 8)) : size || end - offset;
    const contentStart = offset + headerSize;
    const contentEnd = Math.min(offset + atomSize, end);

    if (atomSize < headerSize || contentStart > end || contentEnd <= contentStart) {
      break;
    }

    if (type === "mvhd" && contentStart + 8 <= contentEnd) {
      const version = view.getUint8(contentStart);
      if (version === 1 && contentStart + 16 <= contentEnd) {
        return Number(view.getBigUint64(contentStart + 4));
      }
      return view.getUint32(contentStart + 4);
    }

    if (["moov", "trak", "mdia", "minf", "stbl", "udta"].includes(type)) {
      const result = findMvhdCreationSeconds(view, contentStart, contentEnd, depth + 1);
      if (result) {
        return result;
      }
    }

    offset += atomSize;
  }

  return undefined;
}

function readJpegExif(buffer: ArrayBuffer): MediaMetadata {
  const view = new DataView(buffer);

  if (view.getUint16(0) !== 0xffd8) {
    return {};
  }

  let offset = 2;

  while (offset < view.byteLength) {
    const marker = view.getUint16(offset);
    offset += 2;

    if (marker !== 0xffe1) {
      offset += view.getUint16(offset);
      continue;
    }

    const length = view.getUint16(offset);
    const exifStart = offset + 2;
    const header = readAscii(view, exifStart, 6);

    if (header !== "Exif\u0000\u0000") {
      offset += length;
      continue;
    }

    return readTiffExif(view, exifStart + 6);
  }

  return {};
}

function readTiffExif(view: DataView, tiffStart: number): MediaMetadata {
  const little = view.getUint16(tiffStart) === 0x4949;
  const firstIfdOffset = view.getUint32(tiffStart + 4, little);
  const root = readIfd(view, tiffStart, tiffStart + firstIfdOffset, little);
  const exifOffset = root.get(0x8769)?.numberValue;
  const gpsOffset = root.get(0x8825)?.numberValue;
  const exif = exifOffset ? readIfd(view, tiffStart, tiffStart + exifOffset, little) : new Map<number, ExifValue>();
  const gps = gpsOffset ? readIfd(view, tiffStart, tiffStart + gpsOffset, little) : new Map<number, ExifValue>();
  const rawDate = exif.get(0x9003)?.stringValue ?? root.get(0x0132)?.stringValue;
  const coordinates = readGpsCoordinates(gps);

  return {
    coordinates,
    date: rawDate ? normalizeExifDate(rawDate) : undefined,
  };
}

type ExifValue = {
  numberValue?: number;
  rationals?: number[];
  stringValue?: string;
};

function readIfd(view: DataView, tiffStart: number, ifdOffset: number, little: boolean) {
  const values = new Map<number, ExifValue>();
  const entries = view.getUint16(ifdOffset, little);

  for (let index = 0; index < entries; index += 1) {
    const entry = ifdOffset + 2 + index * 12;
    const tag = view.getUint16(entry, little);
    const type = view.getUint16(entry + 2, little);
    const count = view.getUint32(entry + 4, little);
    const valueOffset = entry + 8;
    const valueSize = typeSize(type) * count;
    const valueStart = valueSize > 4 ? tiffStart + view.getUint32(valueOffset, little) : valueOffset;

    if (type === 2) {
      values.set(tag, { stringValue: readAscii(view, valueStart, count).replace(/\u0000/g, "").trim() });
    } else if (type === 3) {
      values.set(tag, { numberValue: view.getUint16(valueStart, little) });
    } else if (type === 4) {
      values.set(tag, { numberValue: view.getUint32(valueStart, little) });
    } else if (type === 5) {
      const rationals = Array.from({ length: count }, (_, rationalIndex) => {
        const rationalOffset = valueStart + rationalIndex * 8;
        const numerator = view.getUint32(rationalOffset, little);
        const denominator = view.getUint32(rationalOffset + 4, little);
        return denominator ? numerator / denominator : 0;
      });
      values.set(tag, { numberValue: rationals[0], rationals });
    }
  }

  return values;
}

function readGpsCoordinates(gps: Map<number, ExifValue>): [number, number] | undefined {
  const latRef = gps.get(1)?.stringValue;
  const lat = gps.get(2)?.rationals;
  const lngRef = gps.get(3)?.stringValue;
  const lng = gps.get(4)?.rationals;

  if (!latRef || !lat || !lngRef || !lng) {
    return undefined;
  }

  const latitude = degreesToDecimal(lat) * (latRef.toUpperCase().startsWith("S") ? -1 : 1);
  const longitude = degreesToDecimal(lng) * (lngRef.toUpperCase().startsWith("W") ? -1 : 1);

  return [longitude, latitude];
}

function degreesToDecimal(parts: number[]) {
  return (parts[0] ?? 0) + (parts[1] ?? 0) / 60 + (parts[2] ?? 0) / 3600;
}

function typeSize(type: number) {
  if (type === 2) return 1;
  if (type === 3) return 2;
  if (type === 4) return 4;
  if (type === 5) return 8;
  return 1;
}

function readAscii(view: DataView, offset: number, length: number) {
  return Array.from({ length }, (_, index) => String.fromCharCode(view.getUint8(offset + index))).join("");
}

function findAsciiInBuffer(view: DataView, pattern: string) {
  const patternBytes = Array.from(pattern, (character) => character.charCodeAt(0));

  for (let offset = 0; offset <= view.byteLength - patternBytes.length; offset += 1) {
    const matches = patternBytes.every((byte, index) => view.getUint8(offset + index) === byte);
    if (matches) {
      return offset;
    }
  }

  return -1;
}

function normalizeExifDate(value: string) {
  const match = value.match(/^(\d{4}):(\d{2}):(\d{2})/);
  return match ? `${match[1]}-${match[2]}-${match[3]}` : "";
}

function fallbackDateFromFile(file: File) {
  if (!file.lastModified) {
    return "";
  }

  return new Date(file.lastModified).toISOString().slice(0, 10);
}

function decidePostLocation(metadataItems: MediaMetadata[]): MediaMetadata {
  const coordinateItems = metadataItems.filter((item): item is MediaMetadata & { coordinates: [number, number] } => Boolean(item.coordinates));

  if (coordinateItems.length) {
    const cluster = largestCoordinateCluster(coordinateItems.map((item) => item.coordinates));
    return {
      coordinates: averageCoordinates(cluster),
    };
  }

  return {
    location: mostCommonLocation(metadataItems.map((item) => item.location)),
  };
}

function largestCoordinateCluster(coordinates: Array<[number, number]>) {
  if (coordinates.length <= 1) {
    return coordinates;
  }

  const clusters = coordinates.map((center) => coordinates.filter((coordinate) => distanceBetweenCoordinates(center, coordinate) <= 2.5));

  return clusters.sort((first, second) => second.length - first.length)[0] ?? coordinates;
}

function averageCoordinates(coordinates: Array<[number, number]>): [number, number] {
  const totals = coordinates.reduce(
    (sum, coordinate) => ({
      latitude: sum.latitude + coordinate[1],
      longitude: sum.longitude + coordinate[0],
    }),
    { latitude: 0, longitude: 0 },
  );

  return [totals.longitude / coordinates.length, totals.latitude / coordinates.length];
}

function distanceBetweenCoordinates(first: [number, number], second: [number, number]) {
  const earthRadiusKilometers = 6371;
  const latitudeDelta = toRadians(second[1] - first[1]);
  const longitudeDelta = toRadians(second[0] - first[0]);
  const firstLatitude = toRadians(first[1]);
  const secondLatitude = toRadians(second[1]);
  const halfChordLength =
    Math.sin(latitudeDelta / 2) ** 2 + Math.cos(firstLatitude) * Math.cos(secondLatitude) * Math.sin(longitudeDelta / 2) ** 2;

  return 2 * earthRadiusKilometers * Math.atan2(Math.sqrt(halfChordLength), Math.sqrt(1 - halfChordLength));
}

function toRadians(value: number) {
  return (value * Math.PI) / 180;
}

function mostCommonLocation(locations: Array<string | undefined>) {
  const counts = new Map<string, { count: number; firstIndex: number; location: string }>();

  locations.forEach((location, index) => {
    const trimmed = location?.trim();

    if (!trimmed) {
      return;
    }

    const key = trimmed.toLowerCase();
    const current = counts.get(key);

    if (current) {
      current.count += 1;
      return;
    }

    counts.set(key, { count: 1, firstIndex: index, location: trimmed });
  });

  return [...counts.values()].sort((first, second) => second.count - first.count || first.firstIndex - second.firstIndex)[0]?.location;
}

function successFromPost(post: AppPost): PostedSuccess {
  return {
    dateLabel: post.dateLabel,
    description: post.caption,
    href: `/posts/${post.id}`,
    imageUrl: post.imageUrl,
    location: post.location,
    mediaType: post.mediaTypes[0],
    profilePhotoUrl: post.profilePhotoUrl,
    tags: post.tags,
    title: post.title,
    username: post.username === "traveler" ? "You" : post.username,
  };
}

async function sharePostedSuccess(post: PostedSuccess) {
  const url = post.href ? `${window.location.origin}${post.href}` : window.location.href;

  if (navigator.share) {
    await navigator.share({
      text: post.location,
      title: post.title,
      url,
    });
    return;
  }

  await navigator.clipboard?.writeText(url);
}

function formatCoordinates([longitude, latitude]: [number, number]) {
  return `${latitude.toFixed(5)}, ${longitude.toFixed(5)}`;
}

async function reverseGeocodeCoordinates([longitude, latitude]: [number, number]) {
  const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;

  if (!token) {
    return undefined;
  }

  const params = new URLSearchParams({
    access_token: token,
    language: "en",
    limit: "1",
    types: "locality,place,region,country",
  });

  try {
    const response = await fetch(`https://api.mapbox.com/geocoding/v5/mapbox.places/${longitude},${latitude}.json?${params}`);
    const data = (await response.json()) as {
      features?: Array<{
        place_name?: string;
        text?: string;
      }>;
    };

    return data.features?.[0]?.place_name ?? data.features?.[0]?.text;
  } catch {
    return undefined;
  }
}

async function geocodePlace(place: string) {
  const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;

  if (!token || !place.trim()) {
    return undefined;
  }

  const params = new URLSearchParams({
    access_token: token,
    language: "en",
    limit: "1",
    types: "poi,address,neighborhood,locality,place,region,country",
  });

  try {
    const response = await fetch(`https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(place)}.json?${params}`);
    const data = (await response.json()) as { features?: Array<{ center?: [number, number] }> };
    return data.features?.[0]?.center;
  } catch {
    return undefined;
  }
}

function formatPublishError(error: unknown) {
  if (error instanceof Error) {
    return error.message;
  }

  if (error && typeof error === "object") {
    const candidate = error as { message?: unknown; details?: unknown; code?: unknown };
    const message = typeof candidate.message === "string" ? candidate.message : undefined;
    const details = typeof candidate.details === "string" ? candidate.details : undefined;
    const code = typeof candidate.code === "string" ? candidate.code : undefined;

    return [message, details, code].filter(Boolean).join(" ") || "Unable to publish this post.";
  }

  return "Unable to publish this post.";
}
