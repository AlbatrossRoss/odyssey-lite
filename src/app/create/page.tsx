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
  kind: "image" | "video";
  metadata: MediaMetadata;
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

export default function CreatePage() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const currentCoordinatesRef = useRef<[number, number] | undefined>(undefined);
  const currentLocationRef = useRef("");
  const selectedMediaRef = useRef<SelectedUpload[]>([]);
  const [selectedMedia, setSelectedMedia] = useState<SelectedUpload[]>([]);
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
    return () => {
      selectedMediaRef.current.forEach((item) => URL.revokeObjectURL(item.url));
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

    const metadata = await readMediaMetadata(file);
    const nextCoordinates = metadata.coordinates;
    const nextLocation = nextCoordinates ? await reverseGeocodeCoordinates(nextCoordinates) : metadata.location;
    const nextDate = metadata.date ?? fallbackDateFromFile(file);
    const nextMedia = await Promise.all(
      mediaFiles.map(async (item) => ({
        file: item,
        id: `${item.name}-${item.lastModified}-${item.size}`,
        kind: isVideoFile(item) ? ("video" as const) : ("image" as const),
        metadata: item === file ? metadata : await readMediaMetadata(item),
        url: URL.createObjectURL(item),
      })),
    );

    setSelectedMedia((current) => [...current, ...nextMedia]);
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

    const resolvedCoordinates = coordinates ?? (location.trim() ? await geocodePlace(location) : undefined);

    if (!resolvedCoordinates) {
      setMessage("Add a location before sharing.");
      return;
    }

    setStatus("sharing");

    try {
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
    selectedMedia.forEach((item) => URL.revokeObjectURL(item.url));

    setSelectedMedia([]);
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

        <div className="app-scroll h-[calc(100%-128px)] overflow-y-auto px-3 pb-32">
          <input
            accept="image/*,video/*"
            className="hidden"
            multiple
            onChange={(event) => void handleUpload(event.target.files)}
            ref={fileInputRef}
            type="file"
          />

          <button
            aria-label="Choose recommendation media"
            className="relative mt-3 block h-[246px] w-full overflow-hidden rounded-[10px] bg-shell text-ink/46 shadow-[0_10px_24px_rgba(24,35,31,0.08)]"
            onClick={() => fileInputRef.current?.click()}
            type="button"
          >
            {selectedMedia[0] ? (
              <MediaPreview className="h-full w-full object-cover" item={selectedMedia[0]} />
            ) : (
              <span className="grid h-full place-items-center">
                <ImagePlus aria-hidden="true" size={34} />
              </span>
            )}
            {!selectedMedia[0] ? (
              <span className="absolute bottom-4 right-4 grid h-11 w-11 place-items-center rounded-full bg-ink/70 text-white backdrop-blur">
                <ImagePlus aria-hidden="true" size={18} />
              </span>
            ) : null}
            {selectedMedia.length > 1 ? (
              <span className="absolute right-4 top-4 rounded-full bg-ink/58 px-2.5 py-1 text-xs font-black text-white">
                {selectedMedia.length}
              </span>
            ) : null}
          </button>

          {selectedMedia.length ? (
            <section className="mt-3">
              <p className="px-1 text-xs font-semibold text-ink/46">Drag to rearrange</p>
              <div className="no-scrollbar -mx-1 mt-1 flex gap-2 overflow-x-auto px-1 py-1.5">
                {selectedMedia.map((item, index) => (
                  <button
                    aria-label={index === 0 ? "Cover media" : `Media ${index + 1}`}
                    className={`relative h-16 w-16 shrink-0 touch-none overflow-hidden rounded-[10px] bg-shell ring-1 transition ${
                      index === 0 ? "ring-2 ring-moss" : "ring-ink/8"
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
                    onPointerUp={finishMediaDrag}
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
                  className="grid h-16 w-16 shrink-0 place-items-center rounded-[10px] bg-[#f1efeb] text-ink/56 ring-1 ring-ink/6"
                  onClick={() => fileInputRef.current?.click()}
                  type="button"
                >
                  <ImagePlus aria-hidden="true" size={22} />
                </button>
              </div>
            </section>
          ) : null}

          <section className="mt-5 space-y-5">
            <label className="block">
              <span className="mb-2 block text-sm font-black text-ink">Recommendation</span>
              <span className="block rounded-[9px] border border-ink/12 bg-white px-4 py-3 shadow-sm">
                <input
                  className="w-full bg-transparent text-base font-semibold text-ink outline-none placeholder:text-ink/34"
                  maxLength={80}
                  onChange={(event) => setRecommendation(event.target.value)}
                  placeholder="Sunrise from Areopagus Hill"
                  value={recommendation}
                />
              </span>
              <span className="mt-1 block text-right text-xs font-bold text-ink/46">{recommendation.length}/80</span>
            </label>

            <label className="block">
              <span className="mb-2 block text-sm font-black text-ink">Description</span>
              <span className="block rounded-[9px] border border-ink/12 bg-white px-4 py-3 shadow-sm">
                <textarea
                  className="min-h-[132px] w-full resize-none bg-transparent text-sm font-semibold leading-relaxed text-ink outline-none placeholder:text-ink/34"
                  maxLength={1000}
                  onChange={(event) => setDescription(event.target.value)}
                  placeholder="What should friends know before they go?"
                  value={description}
                />
              </span>
              <span className="mt-1 block text-right text-xs font-bold text-ink/46">{description.length}/1000</span>
            </label>

            <section>
              <h2 className="mb-3 text-sm font-black text-ink">Add tags</h2>
              <div className="flex flex-wrap gap-2">
                {postTagOptions.map((tag) => {
                  const isSelected = selectedTags.includes(tag);

                  return (
                    <button
                      className={`flex h-8 items-center rounded-full px-3 text-xs font-normal ring-1 transition ${
                        isSelected ? "bg-moss text-white ring-moss" : "bg-[#f1efeb] text-ink/72 ring-ink/5"
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
          </section>

          <div className="mt-6 divide-y divide-ink/8 border-y border-ink/8">
            <ReviewSection action="Edit" label="Location">
              <div className="space-y-2">
                <label className="flex items-center gap-2 text-sm font-normal text-ink">
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
                </label>
                {locationSuggestions.length ? (
                  <div className="overflow-hidden rounded-[16px] border border-ink/8 bg-white py-1 shadow-soft">
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
              </div>
            </ReviewSection>

            <ReviewSection action="Edit" label="Date">
              <label className="flex items-center gap-2 text-sm font-normal text-ink">
                <Calendar aria-hidden="true" size={15} />
                <input
                  className="min-w-0 flex-1 bg-transparent font-normal outline-none"
                  onChange={(event) => setDate(event.target.value)}
                  type="date"
                  value={date}
                />
              </label>
            </ReviewSection>
          </div>

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
            {status === "sharing" ? "Posting..." : "Post Recommendation"}
          </button>
        </footer>
      </section>
    </MobileFrame>
  );
}

function ReviewSection({ action, children, label }: { action?: string; children: React.ReactNode; label: string }) {
  return (
    <section className="py-5">
      <div className="mb-3 flex items-center justify-between gap-3">
        <h2 className="text-sm font-black text-ink">{label}</h2>
        {action ? <span className="text-sm font-semibold text-ink/64">{action}</span> : null}
      </div>
      {children}
    </section>
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
      <section className="safe-top-bar flex h-full flex-col bg-white px-3 pb-5 text-ink">
        <div className="flex flex-1 flex-col items-center justify-center">
          <div className="mb-4 text-center">
            <p className="text-sm font-black">Posted!</p>
            <div className="relative mx-auto mt-4 grid h-16 w-16 place-items-center rounded-full bg-[#9bc58f] text-white shadow-[0_12px_30px_rgba(77,111,65,0.22)]">
              <Check aria-hidden="true" size={30} strokeWidth={2.8} />
            </div>
            <p className="mx-auto mt-4 max-w-[230px] text-sm font-semibold leading-tight text-ink/78">Your recommendation is live and ready to inspire others.</p>
          </div>

          <article className="w-full overflow-hidden rounded-[10px] bg-white shadow-soft">
            <SuccessMedia imageUrl={post.imageUrl} mediaType={post.mediaType} />
            <div className="relative px-3 pb-4 pt-3">
              <div className="-mt-10 mb-3 flex items-end gap-2">
                <div className="grid h-12 w-12 shrink-0 place-items-center overflow-hidden rounded-full border-2 border-white bg-shell shadow-sm">
                  {post.profilePhotoUrl ? <img alt="" className="h-full w-full object-cover" src={post.profilePhotoUrl} /> : <span className="text-sm font-black">Y</span>}
                </div>
                <div className="min-w-[64px] rounded-full bg-white/95 px-3 py-1.5 shadow-sm">
                  <p className="whitespace-nowrap text-[11px] font-black leading-none">{post.username}</p>
                  <p className="mt-1 whitespace-nowrap text-[9px] font-semibold leading-none text-ink/54">just now</p>
                </div>
              </div>
              <h2 className="text-xl font-black leading-tight">{post.title}</h2>
              <p className="mt-2 text-xs font-semibold leading-snug text-ink/56">{post.location}</p>
              <p className="mt-1 text-xs font-semibold text-ink/46">{post.dateLabel}</p>
              <p className="mt-3 line-clamp-3 text-xs font-semibold leading-relaxed text-ink/70">{post.description}</p>
              {post.tags.length ? (
                <div className="mt-3 flex flex-wrap gap-2">
                  {post.tags.map((tag) => (
                    <span className="rounded-full bg-[#f1efeb] px-2.5 py-1 text-[10px] font-normal text-ink/72" key={tag}>
                      {tag}
                    </span>
                  ))}
                </div>
              ) : null}
            </div>
          </article>
        </div>

        <div className="space-y-3">
          <button className="flex h-14 w-full items-center justify-center gap-2 rounded-[9px] bg-moss text-base font-black text-white shadow-lift" onClick={onView} type="button">
            <Send aria-hidden="true" size={17} />
            View Trip
          </button>
          <button className="flex h-14 w-full items-center justify-center gap-2 rounded-[9px] bg-[#f5f2ed] text-base font-black text-ink" onClick={onShare} type="button">
            <Share2 aria-hidden="true" size={17} />
            Share Trip
          </button>
          <button className="mx-auto block h-10 px-6 text-sm font-black text-moss" onClick={onDone} type="button">
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
      <div className="grid aspect-[1.55] w-full place-items-center bg-shell text-ink/36">
        <ImagePlus aria-hidden="true" size={34} />
      </div>
    );
  }

  if (mediaType === "video") {
    return <video aria-label="Posted trip preview" autoPlay className="aspect-[1.55] w-full object-cover" loop muted playsInline src={imageUrl} />;
  }

  return <img alt="" className="aspect-[1.55] w-full object-cover" src={imageUrl} />;
}

function MediaPreview({ className, item }: { className: string; item: SelectedUpload }) {
  if (item.kind === "video") {
    return <video aria-label="Selected video preview" autoPlay className={className} loop muted playsInline src={item.url} />;
  }

  return <img alt="" className={className} src={item.url} />;
}

function isSupportedMediaFile(file: File) {
  return file.type.startsWith("image/") || isVideoFile(file);
}

function isVideoFile(file: File) {
  return file.type.startsWith("video/") || videoFileExtensions.test(file.name);
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
  if (!file.type.includes("jpeg") && !file.type.includes("jpg")) {
    return {};
  }

  try {
    return readJpegExif(await file.arrayBuffer());
  } catch {
    return {};
  }
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
