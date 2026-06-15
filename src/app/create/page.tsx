"use client";

import { Calendar, Check, ImagePlus, MapPin, Share2, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { BottomNav } from "@/components/BottomNav";
import { MobileFrame } from "@/components/MobileFrame";
import { readAccountSessionId } from "@/lib/accounts";
import { writeActionBanner } from "@/lib/actionBanner";
import { uploadPostMedia } from "@/lib/media";
import { createAppPost } from "@/lib/posts";
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

const maxVideoDurationSeconds = 30;
const videoFileExtensions = /\.(avi|m4v|mov|mp4|webm)$/i;

export default function CreatePage() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const currentCoordinatesRef = useRef<[number, number] | undefined>(undefined);
  const currentLocationRef = useRef("");
  const [selectedMedia, setSelectedMedia] = useState<SelectedUpload[]>([]);
  const [recommendation, setRecommendation] = useState("");
  const [description, setDescription] = useState("");
  const [selectedTags, setSelectedTags] = useState<AppPostTag[]>([]);
  const [location, setLocation] = useState("");
  const [date, setDate] = useState("");
  const [coordinates, setCoordinates] = useState<[number, number] | undefined>();
  const [locationFocused, setLocationFocused] = useState(false);
  const [locationSuggestions, setLocationSuggestions] = useState<SearchSuggestion[]>([]);
  const [metadataNote, setMetadataNote] = useState("Choose photos or videos to read date and location metadata.");
  const [status, setStatus] = useState<"idle" | "reading" | "sharing" | "published">("idle");
  const [message, setMessage] = useState("");
  const showMetadataFields = selectedMedia.length > 0 || recommendation.trim().length > 0;
  const showDateField = selectedMedia.length > 0;
  const canShare =
    recommendation.trim().length > 0 && description.trim().length > 0 && location.trim().length > 0 && status !== "sharing" && status !== "reading";

  useEffect(() => {
    return () => {
      selectedMedia.forEach((item) => URL.revokeObjectURL(item.url));
    };
  }, [selectedMedia]);

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

    selectedMedia.forEach((item) => URL.revokeObjectURL(item.url));
    setSelectedMedia(nextMedia);
    if (nextCoordinates) {
      setCoordinates(nextCoordinates);
    }
    setDate(nextDate);
    setLocation((current) => nextLocation ?? current);
    setMetadataNote(
      nextCoordinates && nextDate
        ? "Using date and location metadata from the first selected item."
        : nextCoordinates
          ? "Using location metadata from the first selected item. Date metadata was not available, so file date is shown."
          : nextDate
            ? "Using file date. Location metadata was not available."
            : "No embedded date or location metadata was available. Add the details below.",
    );
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

      writeActionBanner({
        href: `/posts/${createdPost.id}`,
        imageUrl: createdPost.imageUrl,
        mediaType: createdPost.mediaTypes[0],
        message: "Posted to Explore",
        title: createdPost.title,
        type: "post-created",
      });
      setStatus("published");
      router.push("/explore");
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
    setMetadataNote("Choose photos or videos to read date and location metadata.");
    setStatus("idle");
    setMessage("");
  }

  function toggleTag(tag: AppPostTag) {
    setSelectedTags((current) => (current.includes(tag) ? current.filter((item) => item !== tag) : [...current, tag]));
  }

  return (
    <MobileFrame>
      <section className="relative h-full overflow-hidden bg-white pb-24 text-ink">
        <header className="safe-top-bar flex items-center justify-between border-b border-ink/8 bg-white px-5 pb-3">
          <button
            aria-label="Clear post"
            className="flex h-10 w-10 items-center justify-center rounded-full bg-shell text-ink"
            onClick={resetPost}
            type="button"
          >
            <X aria-hidden="true" size={21} />
          </button>
          <h1 className="text-lg font-black text-ink">Recommendation</h1>
          <span className="h-10 w-10" />
        </header>

        <div className="app-scroll h-[calc(100%-168px)] overflow-y-auto pb-8">
          <input
            accept="image/*,video/*"
            className="hidden"
            multiple
            onChange={(event) => void handleUpload(event.target.files)}
            ref={fileInputRef}
            type="file"
          />

            <section className="space-y-3 px-4 py-3">
              <div className="no-scrollbar flex gap-2 overflow-x-auto">
                {selectedMedia.map((item, index) => (
                  <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-[16px] bg-shell shadow-soft" key={item.id}>
                    <MediaPreview className="h-full w-full object-cover" item={item} />
                    <span className="absolute right-1 top-1 grid h-5 w-5 place-items-center rounded-full bg-coral text-[10px] font-black text-white">
                      {index + 1}
                    </span>
                  </div>
                ))}
                <button
                  className="grid h-16 w-16 shrink-0 place-items-center rounded-[16px] bg-shell text-ink/54"
                  onClick={() => fileInputRef.current?.click()}
                  type="button"
                >
                  <ImagePlus aria-hidden="true" size={22} />
                </button>
              </div>

              {selectedMedia.length || status === "reading" ? (
                <p className="rounded-[18px] bg-shell px-4 py-2 text-xs font-semibold leading-snug text-ink/56">
                  {status === "reading" ? "Reading metadata..." : metadataNote}
                </p>
              ) : null}

              <section className="overflow-hidden rounded-[28px] bg-white shadow-soft ring-1 ring-ink/8">
                <ReviewField label="Recommendation">
                  <input
                    className="h-10 w-full bg-transparent text-base font-bold text-ink outline-none placeholder:text-ink/28"
                    onChange={(event) => setRecommendation(event.target.value)}
                    placeholder="What are you recommending?"
                    value={recommendation}
                  />
                </ReviewField>
                <ReviewField label="Description">
                  <textarea
                    className="min-h-16 w-full resize-none bg-transparent text-sm font-semibold leading-relaxed text-ink outline-none placeholder:text-ink/28"
                    onChange={(event) => setDescription(event.target.value)}
                    placeholder="Add helpful details, tips, or context"
                    value={description}
                  />
                </ReviewField>
                {selectedTags.length ? (
                  <ReviewField label="Selected tags">
                    <div className="flex flex-wrap gap-2">
                      {selectedTags.map((tag) => (
                        <button
                          className="flex h-9 items-center gap-2 rounded-full bg-ink px-3 text-xs font-black text-white"
                          key={tag}
                          onClick={() => toggleTag(tag)}
                          type="button"
                        >
                          {tag}
                          <X aria-hidden="true" size={13} />
                        </button>
                      ))}
                    </div>
                  </ReviewField>
                ) : null}
                {showMetadataFields ? (
                  <ReviewField label="Location">
                    <div className="flex items-center gap-2">
                      <MapPin aria-hidden="true" className="text-coral" size={17} />
                      <div className="min-w-0 flex-1">
                        <input
                          className="w-full bg-transparent text-sm font-bold text-ink outline-none placeholder:text-ink/28"
                          onBlur={() => window.setTimeout(() => setLocationFocused(false), 140)}
                          onChange={(event) => {
                            setLocation(event.target.value);
                            setCoordinates(undefined);
                          }}
                          onFocus={() => setLocationFocused(true)}
                          placeholder="Add a location"
                          value={location}
                        />
                      </div>
                    </div>
                    {locationSuggestions.length ? (
                      <div className="mt-3 overflow-hidden rounded-[22px] border border-ink/8 bg-white py-1 shadow-soft">
                        {locationSuggestions.map((suggestion) => (
                          <button
                            className="flex w-full flex-col px-4 py-3 text-left transition hover:bg-shell"
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
                            {suggestion.description ? (
                              <span className="mt-0.5 line-clamp-1 text-xs font-semibold text-ink/54">{suggestion.description}</span>
                            ) : null}
                          </button>
                        ))}
                      </div>
                    ) : null}
                  </ReviewField>
                ) : null}
                {showDateField ? (
                  <ReviewField label="Date">
                    <div className="flex items-center gap-2">
                      <Calendar aria-hidden="true" className="text-coral" size={17} />
                      <input
                        className="w-full bg-transparent text-sm font-bold text-ink outline-none"
                        onChange={(event) => setDate(event.target.value)}
                        type="date"
                        value={date}
                      />
                    </div>
                  </ReviewField>
                ) : null}
              </section>

              <section className="rounded-[24px] bg-shell p-4">
                <h2 className="text-xs font-black uppercase tracking-[0.14em] text-ink/42">Tags</h2>
                <div className="mt-3 flex flex-wrap gap-2">
                  {postTagOptions
                    .filter((tag) => !selectedTags.includes(tag))
                    .map((tag) => (
                      <button
                        className="h-10 rounded-full bg-white px-4 text-sm font-black text-ink/56 shadow-sm"
                        key={tag}
                        onClick={() => toggleTag(tag)}
                        type="button"
                      >
                        {tag}
                      </button>
                    ))}
                </div>
              </section>
            </section>

            {status === "published" ? (
              <div className="mx-5 mt-5 rounded-[26px] bg-ink p-5 text-white shadow-soft">
                <div className="mb-3 grid h-11 w-11 place-items-center rounded-full bg-white text-ink">
                  <Check aria-hidden="true" size={22} />
                </div>
                <h2 className="text-2xl font-black">Posted</h2>
                <p className="mt-1 text-sm font-semibold leading-relaxed text-white/70">
                  Your rec is now available anywhere shared posts are loaded.
                </p>
                <button className="mt-4 rounded-full bg-white px-4 py-3 text-sm font-black text-ink" onClick={resetPost} type="button">
                  Post another rec
                </button>
              </div>
            ) : null}

          {message ? <p className="mx-5 mt-5 rounded-2xl bg-coral/10 px-4 py-3 text-sm font-bold text-coral">{message}</p> : null}
        </div>

          <footer className="create-share-bar absolute inset-x-0 z-50 bg-white px-5 py-3 shadow-[0_-12px_30px_rgba(24,35,31,0.08)]">
            <button
              className="flex h-16 w-full items-center justify-center gap-2 rounded-full bg-ink px-5 text-base font-black text-white shadow-lift disabled:opacity-40"
              disabled={!canShare}
              onClick={shareRecommendation}
              type="button"
            >
              <Share2 aria-hidden="true" size={19} />
              {status === "sharing" ? "Sharing..." : "Share"}
            </button>
          </footer>

        <BottomNav activeTab="Create" />
      </section>
    </MobileFrame>
  );
}

function ReviewField({ children, label }: { children: React.ReactNode; label: string }) {
  return (
    <label className="block border-b border-ink/8 px-4 py-3 last:border-b-0">
      <span className="mb-1 block text-[10px] font-black uppercase tracking-[0.12em] text-ink/38">{label}</span>
      {children}
    </label>
  );
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
    types: "poi,address,neighborhood,locality,place,region,country",
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
