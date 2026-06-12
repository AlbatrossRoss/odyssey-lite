"use client";

import { Calendar, Check, ImagePlus, MapPin, Play, Share2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { BottomNav } from "@/components/BottomNav";
import { MobileFrame } from "@/components/MobileFrame";
import { readAccountSessionId } from "@/lib/accounts";
import { createAppPost } from "@/lib/posts";

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

export default function CreatePage() {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [selectedMedia, setSelectedMedia] = useState<SelectedUpload | null>(null);
  const [title, setTitle] = useState("");
  const [location, setLocation] = useState("");
  const [date, setDate] = useState("");
  const [coordinates, setCoordinates] = useState<[number, number] | undefined>();
  const [metadataNote, setMetadataNote] = useState("Choose a photo or video to read date and location metadata.");
  const [status, setStatus] = useState<"idle" | "reading" | "sharing" | "published">("idle");
  const [message, setMessage] = useState("");

  useEffect(() => {
    return () => {
      if (selectedMedia) {
        URL.revokeObjectURL(selectedMedia.url);
      }
    };
  }, [selectedMedia]);

  async function handleUpload(files: FileList | null) {
    const file = Array.from(files ?? []).find((item) => item.type.startsWith("image/") || item.type.startsWith("video/"));

    if (!file) {
      return;
    }

    setStatus("reading");
    setMessage("");

    if (selectedMedia) {
      URL.revokeObjectURL(selectedMedia.url);
    }

    const metadata = await readMediaMetadata(file);
    const nextCoordinates = metadata.coordinates;
    const nextLocation = nextCoordinates ? await reverseGeocodeCoordinates(nextCoordinates) : metadata.location;
    const nextDate = metadata.date ?? fallbackDateFromFile(file);

    setSelectedMedia({
      file,
      id: `${file.name}-${file.lastModified}`,
      kind: file.type.startsWith("video/") ? "video" : "image",
      metadata,
      url: URL.createObjectURL(file),
    });
    setCoordinates(nextCoordinates);
    setDate(nextDate);
    setLocation(nextLocation ?? "");
    setTitle((current) => current || file.name.replace(/\.[^.]+$/, "").replace(/[-_]/g, " "));
    setMetadataNote(
      nextCoordinates && nextDate
        ? "Using date and location metadata from this file."
        : nextCoordinates
          ? "Using location metadata from this file. Date metadata was not available, so file date is shown."
          : nextDate
            ? "Using file date. Location metadata was not available."
            : "No embedded date or location metadata was available. Add the details below.",
    );
    setStatus("idle");
  }

  async function shareRecommendation() {
    setMessage("");

    if (!selectedMedia) {
      setMessage("Choose a photo or video before sharing.");
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
      await createAppPost({
        accountId,
        caption: "Posted from Odyssey Lite.",
        coordinates: resolvedCoordinates,
        dateLabel: date || "Just now",
        imageUrl: await fileToDataUrl(selectedMedia.file),
        location: location.trim() || formatCoordinates(resolvedCoordinates),
        title: title.trim() || "New recommendation",
        type: "experience",
        visibility: "Public",
      });

      setStatus("published");
      setMessage("Posted to Explore, your profile, and the map.");
    } catch (error) {
      setStatus("idle");
      setMessage(formatPublishError(error));
    }
  }

  function resetPost() {
    if (selectedMedia) {
      URL.revokeObjectURL(selectedMedia.url);
    }

    setSelectedMedia(null);
    setTitle("");
    setLocation("");
    setDate("");
    setCoordinates(undefined);
    setMetadataNote("Choose a photo or video to read date and location metadata.");
    setStatus("idle");
    setMessage("");
  }

  return (
    <MobileFrame>
      <section className="relative h-full overflow-hidden bg-white pb-24">
        <header className="border-b border-ink/8 bg-white px-5 pb-4 pt-7">
          <p className="text-xs font-black uppercase tracking-[0.18em] text-coral">Create</p>
          <h1 className="mt-1 text-2xl font-black text-ink">Post a rec</h1>
        </header>

        <div className="app-scroll h-[calc(100%-168px)] overflow-y-auto pb-8">
          <input
            accept="image/*,video/*"
            className="hidden"
            onChange={(event) => void handleUpload(event.target.files)}
            ref={fileInputRef}
            type="file"
          />

          <section className="space-y-5 px-5 py-5">
            <button
              className="relative flex aspect-square w-full flex-col items-center justify-center overflow-hidden rounded-[10px] border border-dashed border-ink/16 bg-shell text-center"
              onClick={() => fileInputRef.current?.click()}
              type="button"
            >
              {selectedMedia ? (
                <>
                  <MediaPreview className="absolute inset-0 h-full w-full object-cover" item={selectedMedia} />
                  <span className="absolute inset-0 bg-ink/18" />
                  {selectedMedia.kind === "video" ? (
                    <span className="absolute left-4 top-4 grid h-10 w-10 place-items-center rounded-full bg-black/45 text-white">
                      <Play aria-hidden="true" fill="currentColor" size={18} />
                    </span>
                  ) : null}
                  <span className="absolute bottom-4 right-4 rounded-full bg-white px-4 py-2 text-sm font-black text-ink shadow-lift">
                    Change
                  </span>
                </>
              ) : (
                <>
                  <span className="grid h-16 w-16 place-items-center rounded-full bg-white text-ink shadow-lift">
                    <ImagePlus aria-hidden="true" size={28} />
                  </span>
                  <span className="mt-5 block text-xl font-black text-ink">Choose from camera roll</span>
                  <span className="mt-2 block max-w-64 text-sm font-semibold leading-relaxed text-ink/50">
                    Odyssey will check the file for date and location metadata.
                  </span>
                </>
              )}
            </button>

            <p className="rounded-[20px] bg-shell px-4 py-3 text-sm font-semibold leading-relaxed text-ink/56">
              {status === "reading" ? "Reading metadata..." : metadataNote}
            </p>

            {selectedMedia ? (
              <section className="overflow-hidden rounded-[28px] bg-white shadow-soft ring-1 ring-ink/8">
                <ReviewField label="Title">
                  <input
                    className="w-full bg-transparent text-base font-bold text-ink outline-none placeholder:text-ink/28"
                    onChange={(event) => setTitle(event.target.value)}
                    placeholder="Add a title"
                    value={title}
                  />
                </ReviewField>
                <ReviewField label="Location">
                  <div className="flex items-center gap-2">
                    <MapPin aria-hidden="true" className="text-coral" size={17} />
                    <input
                      className="w-full bg-transparent text-sm font-bold text-ink outline-none placeholder:text-ink/28"
                      onChange={(event) => {
                        setLocation(event.target.value);
                        setCoordinates(undefined);
                      }}
                      placeholder="Add a location"
                      value={location}
                    />
                  </div>
                </ReviewField>
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
              </section>
            ) : null}

            {status === "published" ? (
              <div className="rounded-[26px] bg-ink p-5 text-white shadow-soft">
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

            {message ? <p className="rounded-2xl bg-coral/10 px-4 py-3 text-sm font-bold text-coral">{message}</p> : null}
          </section>
        </div>

        <footer className="absolute inset-x-0 bottom-[84px] z-50 bg-white px-5 py-3 shadow-[0_-12px_30px_rgba(24,35,31,0.08)]">
          <button
            className="flex h-16 w-full items-center justify-center gap-2 rounded-full bg-ink px-5 text-base font-black text-white shadow-lift"
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
    <label className="block border-b border-ink/8 px-4 py-4 last:border-b-0">
      <span className="mb-2 block text-[11px] font-black uppercase tracking-[0.12em] text-ink/38">{label}</span>
      {children}
    </label>
  );
}

function MediaPreview({ className, item }: { className: string; item: SelectedUpload }) {
  if (item.kind === "video") {
    return <video className={className} muted playsInline src={item.url} />;
  }

  return <img alt="" className={className} src={item.url} />;
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
    types: "poi,neighborhood,locality,place,region,country",
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
    types: "poi,neighborhood,locality,place,region,country,address",
  });

  try {
    const response = await fetch(`https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(place)}.json?${params}`);
    const data = (await response.json()) as { features?: Array<{ center?: [number, number] }> };
    return data.features?.[0]?.center;
  } catch {
    return undefined;
  }
}

function fileToDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.addEventListener("load", () => resolve(String(reader.result ?? "")));
    reader.addEventListener("error", () => reject(reader.error));
    reader.readAsDataURL(file);
  });
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
