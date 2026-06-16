"use client";

import { ArrowLeft, ArrowRight, Calendar, Camera, ChevronDown, GripVertical, ImagePlus, Lightbulb, MapPin, MoreHorizontal, Pencil, Plus, Route, Send, Video, X } from "lucide-react";
import mapboxgl from "mapbox-gl";
import type { Dispatch, ReactNode, SetStateAction } from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { MobileFrame } from "@/components/MobileFrame";
import { readAccountSessionId } from "@/lib/accounts";
import { uploadPostMedia } from "@/lib/media";
import { createAppPost, type AppPostMediaType } from "@/lib/posts";
import { postTagOptions, type AppPostTag } from "@/lib/postTags";

type MediaMetadata = {
  coordinates?: [number, number];
  date?: string;
  geocodeDebug?: ReverseGeocodeResult;
  location?: string;
};

type ReverseGeocodeFeature = {
  center?: [number, number];
  id?: string;
  place_name?: string;
  place_type?: string[];
  properties?: {
    category?: string;
    maki?: string;
  };
  relevance?: number;
  text?: string;
};

type ReverseGeocodeResult = {
  features: ReverseGeocodeFeature[];
  lookups: Record<ReverseGeocodeLookupType, ReverseGeocodeFeature[]>;
  query: [number, number];
  selectedLocation?: string;
};

type ReverseGeocodeLookupType = "poi" | "locality" | "place" | "region" | "country";

type TripMemory = {
  file: File;
  id: string;
  isHeic: boolean;
  kind: "image" | "video";
  metadata: MediaMetadata;
  posterUrl?: string;
  previewReady: boolean;
  url: string;
};

type TripStop = {
  assignmentLocation: string;
  coverUrl: string | null;
  coverIsHeic: boolean;
  coverPreviewReady: boolean;
  dateLabel: string;
  endDate?: string;
  id: string;
  isManual?: boolean;
  memories: TripMemory[];
  photoCount: number;
  startDate?: string;
  title: string;
  videoCount: number;
};

type ManualTripStop = {
  endDate?: string;
  id: string;
  startDate?: string;
  title: string;
};

type TripStopDraft = {
  stops: TripStop[];
  unsorted: TripMemory[];
};

type TripRecommendationDraft = {
  description: string;
  id: string;
  mediaIds: string[];
  tags: AppPostTag[];
  title: string;
};

type PublishedTripMedia = {
  type: AppPostMediaType;
  url: string;
};

const videoFileExtensions = /\.(avi|m4v|mov|mp4|webm)$/i;
const heicFileExtensions = /\.(heic|heif)$/i;
const preferredStopNamePattern =
  /\b(national park|state park|provincial park|regional park|park|national forest|forest|preserve|reserve|monument|wilderness|recreation area|conservation area|wildlife refuge|trail|falls|lake|mount|mountain|canyon|beach|island)\b/i;
const stateAbbreviations: Record<string, string> = {
  alabama: "AL",
  alaska: "AK",
  arizona: "AZ",
  arkansas: "AR",
  california: "CA",
  colorado: "CO",
  connecticut: "CT",
  delaware: "DE",
  florida: "FL",
  georgia: "GA",
  hawaii: "HI",
  idaho: "ID",
  illinois: "IL",
  indiana: "IN",
  iowa: "IA",
  kansas: "KS",
  kentucky: "KY",
  louisiana: "LA",
  maine: "ME",
  maryland: "MD",
  massachusetts: "MA",
  michigan: "MI",
  minnesota: "MN",
  mississippi: "MS",
  missouri: "MO",
  montana: "MT",
  nebraska: "NE",
  nevada: "NV",
  "new hampshire": "NH",
  "new jersey": "NJ",
  "new mexico": "NM",
  "new york": "NY",
  "north carolina": "NC",
  "north dakota": "ND",
  ohio: "OH",
  oklahoma: "OK",
  oregon: "OR",
  pennsylvania: "PA",
  "rhode island": "RI",
  "south carolina": "SC",
  "south dakota": "SD",
  tennessee: "TN",
  texas: "TX",
  utah: "UT",
  vermont: "VT",
  virginia: "VA",
  washington: "WA",
  "west virginia": "WV",
  wisconsin: "WI",
  wyoming: "WY",
};

export default function CreateTripPage() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const memoriesRef = useRef<TripMemory[]>([]);
  const [manualStops, setManualStops] = useState<ManualTripStop[]>([]);
  const [memories, setMemories] = useState<TripMemory[]>([]);
  const [coverMemoryId, setCoverMemoryId] = useState("");
  const [recommendationsByStop, setRecommendationsByStop] = useState<Record<string, TripRecommendationDraft[]>>({});
  const [tripDescription, setTripDescription] = useState("");
  const [tripEndDate, setTripEndDate] = useState("");
  const [tripStartDate, setTripStartDate] = useState("");
  const [tripTitle, setTripTitle] = useState("");
  const [step, setStep] = useState<1 | 2 | 3 | 4 | 5>(1);
  const [publishMessage, setPublishMessage] = useState("");
  const [status, setStatus] = useState<"idle" | "publishing" | "reading">("idle");

  const stopDraft = useMemo(() => buildTripStops(memories, manualStops), [manualStops, memories]);

  useEffect(() => {
    memoriesRef.current = memories;
  }, [memories]);

  useEffect(() => {
    return () => {
      memoriesRef.current.forEach(revokeTripMemoryUrls);
    };
  }, []);

  async function handleMediaSelect(files: FileList | null) {
    const mediaFiles = Array.from(files ?? []).filter(isSupportedMediaFile);

    if (!mediaFiles.length) {
      return;
    }

    setStatus("reading");

    const nextMemories = await Promise.all(
      mediaFiles.map(async (file) => {
        const metadata = await readFileMetadata(file);
        const coordinates = metadata.coordinates;
        const geocode = coordinates ? await reverseGeocodeCoordinates(coordinates) : undefined;
        const location = geocode?.selectedLocation ?? metadata.location;

        return {
          file,
          id: `${file.name}-${file.lastModified}-${file.size}`,
          isHeic: isHeicFile(file),
          kind: isVideoFile(file) ? ("video" as const) : ("image" as const),
          metadata: {
            ...metadata,
            date: metadata.date ?? fallbackDateFromFile(file),
            geocodeDebug: geocode,
            location,
          },
          ...(await createPreview(file)),
        };
      }),
    );

    setMemories((current) => [...current, ...nextMemories]);
    setCoverMemoryId((current) => current || nextMemories[0]?.id || "");
    setStatus("idle");
  }

  async function publishTrip() {
    const accountId = readAccountSessionId();
    const cleanedTitle = tripTitle.trim();

    setPublishMessage("");

    if (!accountId) {
      setPublishMessage("Choose or create an account before publishing.");
      return;
    }

    if (!cleanedTitle) {
      setPublishMessage("Add a trip title before publishing.");
      setStep(4);
      return;
    }

    if (!memories.length) {
      setPublishMessage("Add at least one memory before publishing.");
      setStep(1);
      return;
    }

    setStatus("publishing");

    try {
      const uploadedMedia = new Map<string, PublishedTripMedia>();

      for (const memory of memories) {
        const url = await uploadPostMedia(memory.file, accountId);
        uploadedMedia.set(memory.id, {
          type: memory.kind,
          url,
        });
      }

      const allMedia = memories.map((memory) => uploadedMedia.get(memory.id)).filter((media): media is PublishedTripMedia => Boolean(media));
      const coverMedia = uploadedMedia.get(coverMemoryId) ?? allMedia[0] ?? null;
      const fallbackCoordinates =
        averageCoordinates(memories.map((memory) => memory.metadata.coordinates)) ??
        stopDraft.stops.map((stop) => averageCoordinates(stop.memories.map((memory) => memory.metadata.coordinates))).find(Boolean) ??
        ([-98.5795, 39.8283] as [number, number]);
      const dateLabel = formatDateRangeWithYear(tripStartDate, tripEndDate) || "Just now";
      const locationSummary = stopDraft.stops.map((stop) => stop.title).filter(Boolean).join(", ");
      const recommendationTags = uniqueRecommendationTags(recommendationsByStop);
      const tripPost = await createAppPost({
        accountId,
        caption: tripDescription.trim() || `${cleanedTitle} with ${stopDraft.stops.length} ${stopDraft.stops.length === 1 ? "stop" : "stops"}.`,
        coordinates: fallbackCoordinates,
        dateLabel,
        imageUrl: coverMedia?.url ?? null,
        location: locationSummary || "Trip",
        mediaTypes: allMedia.map((media) => media.type),
        mediaUrls: allMedia.map((media) => media.url),
        tags: recommendationTags.length ? recommendationTags : ["Experience"],
        title: cleanedTitle,
        type: "trip",
        visibility: "Public",
      });

      for (const stop of stopDraft.stops) {
        const stopMedia = stop.memories.map((memory) => uploadedMedia.get(memory.id)).filter((media): media is PublishedTripMedia => Boolean(media));
        const stopCoordinates = averageCoordinates(stop.memories.map((memory) => memory.metadata.coordinates)) ?? fallbackCoordinates;
        const stopDateLabel = formatDateRangeWithYear(stop.startDate, stop.endDate) || stop.dateLabel || dateLabel;

        await createAppPost({
          accountId,
          caption: `Trip stop from ${cleanedTitle}.`,
          coordinates: stopCoordinates,
          dateLabel: stopDateLabel,
          imageUrl: stopMedia[0]?.url ?? coverMedia?.url ?? null,
          location: stop.title,
          mediaTypes: stopMedia.map((media) => media.type),
          mediaUrls: stopMedia.map((media) => media.url),
          tags: ["Experience"],
          title: stop.title,
          type: "experience",
          visibility: "Public",
        });

        const stopRecommendations = recommendationsByStop[stop.id] ?? [];

        for (const recommendation of stopRecommendations) {
          const recommendationTitle = recommendation.title.trim();

          if (!recommendationTitle) {
            continue;
          }

          const recommendationMedia = recommendation.mediaIds
            .map((mediaId) => uploadedMedia.get(mediaId))
            .filter((media): media is PublishedTripMedia => Boolean(media));
          const recommendationMemories = recommendation.mediaIds
            .map((mediaId) => memories.find((memory) => memory.id === mediaId))
            .filter((memory): memory is TripMemory => Boolean(memory));
          const recommendationCoordinates = averageCoordinates(recommendationMemories.map((memory) => memory.metadata.coordinates)) ?? stopCoordinates;
          const recommendationDate = recommendationMemories.find((memory) => memory.metadata.date)?.metadata.date;

          await createAppPost({
            accountId,
            caption: recommendation.description.trim() || `A recommendation from ${stop.title}.`,
            coordinates: recommendationCoordinates,
            dateLabel: formatDateRangeWithYear(recommendationDate, recommendationDate) || stopDateLabel,
            imageUrl: recommendationMedia[0]?.url ?? stopMedia[0]?.url ?? coverMedia?.url ?? null,
            location: stop.title,
            mediaTypes: recommendationMedia.map((media) => media.type),
            mediaUrls: recommendationMedia.map((media) => media.url),
            tags: recommendation.tags.length ? recommendation.tags : ["Experience"],
            title: recommendationTitle,
            type: "experience",
            visibility: "Public",
          });
        }
      }

      clearTripPostCaches(accountId);
      router.push(`/trips/${tripPost.id}`);
    } catch (error) {
      setPublishMessage(error instanceof Error ? error.message : "Unable to publish this trip.");
    } finally {
      setStatus("idle");
    }
  }

  function removeMemory(memoryId: string) {
    setMemories((current) => {
      const memory = current.find((item) => item.id === memoryId);
      if (memory) {
        revokeTripMemoryUrls(memory);
      }
      return current.filter((item) => item.id !== memoryId);
    });
    setCoverMemoryId((current) => (current === memoryId ? "" : current));
  }

  function moveMemoryToStop(memoryId: string, stopTitle: string) {
    setMemories((current) =>
      current.map((memory) =>
        memory.id === memoryId
          ? {
              ...memory,
              metadata: {
                ...memory.metadata,
                location: stopTitle,
              },
            }
          : memory,
      ),
    );
  }

  function renameStop(memoryIds: string[], title: string, stopId?: string) {
    const nextTitle = title.trim();

    if (!nextTitle) {
      return;
    }

    if (stopId) {
      setManualStops((current) => current.map((stop) => (stop.id === stopId ? { ...stop, title: nextTitle } : stop)));
    }

    setMemories((current) =>
      current.map((memory) =>
        memoryIds.includes(memory.id)
          ? {
              ...memory,
              metadata: {
                ...memory.metadata,
                location: nextTitle,
              },
            }
          : memory,
      ),
    );
  }

  function deleteStop(memoryIds: string[], stopId: string, title: string) {
    setManualStops((current) => current.filter((stop) => stop.id !== stopId && normalizeStopTitle(stop.title) !== normalizeStopTitle(title)));

    if (!memoryIds.length) {
      return;
    }

    setMemories((current) =>
      current.map((memory) =>
        memoryIds.includes(memory.id)
          ? {
              ...memory,
              metadata: {
                ...memory.metadata,
                location: undefined,
              },
            }
          : memory,
      ),
    );
  }

  function addManualStop(stop: { endDate?: string; startDate?: string; title: string }) {
    const title = stop.title.trim();

    if (!title) {
      return;
    }

    setManualStops((current) => [
      ...current,
      {
        endDate: stop.endDate,
        id: `manual-${Date.now()}-${title}`,
        startDate: stop.startDate,
        title,
      },
    ]);
  }

  return (
    <MobileFrame>
      <section className="relative h-full overflow-hidden bg-white text-ink">
        <TripHeader onBack={() => setStep(step === 5 ? 4 : step === 4 ? 3 : step === 3 ? 2 : 1)} onCancel={() => router.push("/explore")} step={step} />

        {step === 1 ? (
          <TripMediaStep
            memories={memories}
            onAddMedia={() => fileInputRef.current?.click()}
            onMediaSelect={handleMediaSelect}
            onNext={() => setStep(2)}
            onRemoveMemory={removeMemory}
            status={status}
            fileInputRef={fileInputRef}
          />
        ) : step === 2 ? (
          <TripStopsStep
            onAddStop={addManualStop}
            onDeleteStop={deleteStop}
            onMoveMemory={moveMemoryToStop}
            onRenameStop={renameStop}
            onReview={() => setStep(3)}
            stops={stopDraft.stops}
            unsorted={stopDraft.unsorted}
          />
        ) : step === 3 ? (
          <TripRecommendationsStep
            onNext={() => setStep(4)}
            recommendationsByStop={recommendationsByStop}
            setRecommendationsByStop={setRecommendationsByStop}
            stops={stopDraft.stops}
          />
        ) : (
          step === 4 ? (
            <TripDetailsStep
              coverMemoryId={coverMemoryId}
              description={tripDescription}
              endDate={tripEndDate}
              memories={memories}
              onNext={() => setStep(5)}
              setCoverMemoryId={setCoverMemoryId}
              setDescription={setTripDescription}
              setEndDate={setTripEndDate}
              setStartDate={setTripStartDate}
              startDate={tripStartDate}
              stops={stopDraft.stops}
              tripTitle={tripTitle}
              updateTripTitle={setTripTitle}
            />
          ) : (
            <TripReviewStep
              coverMemoryId={coverMemoryId}
              description={tripDescription}
              endDate={tripEndDate}
              memories={memories}
              recommendationsByStop={recommendationsByStop}
              startDate={tripStartDate}
              stops={stopDraft.stops}
              tripTitle={tripTitle}
              onPublish={publishTrip}
              publishMessage={publishMessage}
              publishing={status === "publishing"}
            />
          )
        )}
      </section>
    </MobileFrame>
  );
}

function TripHeader({ onBack, onCancel, step }: { onBack: () => void; onCancel: () => void; step: 1 | 2 | 3 | 4 | 5 }) {
  return (
    <header className="safe-top-bar bg-white px-3 pb-4">
      <div className="grid grid-cols-[4.5rem_1fr_4.5rem] items-start">
        {step === 1 ? (
          <button aria-label="Cancel trip post" className="-ml-1 flex h-10 w-10 items-center justify-center rounded-full text-ink" onClick={onCancel} type="button">
            <X aria-hidden="true" size={21} />
          </button>
        ) : (
          <button className="h-10 text-left text-sm font-semibold text-ink" onClick={onBack} type="button">
            Back
          </button>
        )}
        <div className="text-center">
          <h1 className="text-base font-black">Add Trip</h1>
          <p className="mt-0.5 text-xs font-semibold text-ink/56">{step} of 5</p>
        </div>
        <span />
      </div>
      <div className="mx-auto mt-4 grid max-w-[172px] grid-cols-5 gap-2">
        {Array.from({ length: 5 }, (_, index) => (
          <span className={`h-1 rounded-full ${index < step ? "bg-moss" : "bg-[#e7e2dc]"}`} key={index} />
        ))}
      </div>
    </header>
  );
}

function TripMediaStep({
  fileInputRef,
  memories,
  onAddMedia,
  onMediaSelect,
  onNext,
  onRemoveMemory,
  status,
}: {
  fileInputRef: React.RefObject<HTMLInputElement | null>;
  memories: TripMemory[];
  onAddMedia: () => void;
  onMediaSelect: (files: FileList | null) => void;
  onNext: () => void;
  onRemoveMemory: (memoryId: string) => void;
  status: "idle" | "publishing" | "reading";
}) {
  return (
    <>
      <main className="app-scroll h-[calc(100%-132px)] overflow-y-auto px-3 pb-32 pt-2">
        <input
          accept="image/*,video/*,.heic,.heif,.mov,.mp4,.m4v"
          className="hidden"
          multiple
          onChange={(event) => onMediaSelect(event.target.files)}
          ref={fileInputRef}
          type="file"
        />

        <section>
          <h2 className="text-[25px] font-black leading-tight">Add your photos & videos</h2>
          <p className="mt-2 max-w-[260px] text-sm font-semibold leading-relaxed text-ink/72">
            The more you add, the better we can build your trip.
          </p>
        </section>

        <section className="mt-8 grid grid-cols-3 gap-3">
          {memories.map((memory, index) => (
            <div className="relative aspect-square overflow-hidden rounded-[10px] bg-shell shadow-sm" key={memory.id}>
              {memory.kind === "video" ? (
                memory.posterUrl ? (
                  <img alt="" className="h-full w-full object-cover" src={memory.posterUrl} />
                ) : (
                  <video aria-label={`Trip memory ${index + 1}`} className="h-full w-full object-cover" muted playsInline preload="metadata" src={memory.url} />
                )
              ) : memory.isHeic && !memory.previewReady ? (
                <HeicPreview />
              ) : (
                <img alt="" className="h-full w-full object-cover" src={memory.url} />
              )}
              <button
                aria-label={`Remove trip memory ${index + 1}`}
                className="absolute right-1.5 top-1.5 grid h-6 w-6 place-items-center rounded-full bg-ink/62 text-white shadow-sm backdrop-blur"
                onClick={() => onRemoveMemory(memory.id)}
                type="button"
              >
                <X aria-hidden="true" size={13} strokeWidth={3} />
              </button>
              {memory.kind === "video" ? (
                <span className="absolute bottom-1.5 right-1.5 grid h-6 w-6 place-items-center rounded-[7px] bg-ink/50 text-white backdrop-blur">
                  <Video aria-hidden="true" size={13} />
                </span>
              ) : null}
            </div>
          ))}

          <button
            className="grid aspect-square place-items-center rounded-[10px] border border-dashed border-ink/18 bg-[#fbfaf7] text-ink shadow-sm"
            onClick={onAddMedia}
            type="button"
          >
            <span className="flex flex-col items-center gap-2">
              <ImagePlus aria-hidden="true" size={28} strokeWidth={1.9} />
              <span className="text-xs font-black">Add</span>
            </span>
          </button>
        </section>

        {status === "reading" ? <p className="mt-3 text-xs font-bold text-ink/46">Reading dates and locations...</p> : null}
      </main>

      <footer className="create-share-bar absolute inset-x-0 z-50 bg-white px-3 py-3">
        <button
          className="flex h-16 w-full items-center justify-center gap-4 rounded-[9px] bg-moss px-5 text-base font-black text-white shadow-lift disabled:opacity-40"
          disabled={!memories.length || status === "reading"}
          onClick={onNext}
          type="button"
        >
          Next
          <ArrowRight aria-hidden="true" size={20} />
        </button>
      </footer>
    </>
  );
}

function TripStopsStep({
  onAddStop,
  onDeleteStop,
  onMoveMemory,
  onRenameStop,
  onReview,
  stops,
  unsorted,
}: {
  onAddStop: (stop: { endDate?: string; startDate?: string; title: string }) => void;
  onDeleteStop: (memoryIds: string[], stopId: string, title: string) => void;
  onMoveMemory: (memoryId: string, stopTitle: string) => void;
  onRenameStop: (memoryIds: string[], title: string, stopId?: string) => void;
  onReview: () => void;
  stops: TripStop[];
  unsorted: TripMemory[];
}) {
  const unsortedPhotoCount = unsorted.filter((item) => item.kind === "image").length;
  const unsortedVideoCount = unsorted.filter((item) => item.kind === "video").length;
  const [dragOverStopId, setDragOverStopId] = useState<string | null>(null);
  const [editingStop, setEditingStop] = useState<TripStop | null>(null);
  const [editStopEndDate, setEditStopEndDate] = useState("");
  const [editStopStartDate, setEditStopStartDate] = useState("");
  const [editStopTitle, setEditStopTitle] = useState("");
  const [isAddingStop, setIsAddingStop] = useState(false);
  const [newStopEndDate, setNewStopEndDate] = useState("");
  const [newStopStartDate, setNewStopStartDate] = useState("");
  const [newStopTitle, setNewStopTitle] = useState("");
  const [selectedMemory, setSelectedMemory] = useState<TripMemory | null>(null);
  const [stopDateOverrides, setStopDateOverrides] = useState<Record<string, { endDate?: string; startDate?: string }>>({});

  function handleDrop(stop: TripStop, memoryId: string) {
    setDragOverStopId(null);

    if (!memoryId) {
      return;
    }

    if (stop.memories.some((memory) => memory.id === memoryId)) {
      return;
    }
    onMoveMemory(memoryId, stop.assignmentLocation);
  }

  function startEditingStop(stop: TripStop) {
    const override = stopDateOverrides[stopDateKey(stop.title)];
    setEditingStop(stop);
    setEditStopEndDate(override?.endDate ?? stop.endDate ?? "");
    setEditStopStartDate(override?.startDate ?? stop.startDate ?? "");
    setEditStopTitle(stop.title);
  }

  function closeEditStop() {
    setEditingStop(null);
    setEditStopEndDate("");
    setEditStopStartDate("");
    setEditStopTitle("");
  }

  function saveStopEdits() {
    if (!editingStop) {
      return;
    }

    const nextTitle = editStopTitle.trim();

    if (nextTitle && nextTitle !== editingStop.title) {
      onRenameStop(editingStop.memories.map((memory) => memory.id), nextTitle, editingStop.id);
    }

    setStopDateOverrides((current) => {
      const next = { ...current };
      delete next[stopDateKey(editingStop.title)];
      next[stopDateKey(nextTitle || editingStop.title)] = {
        endDate: editStopEndDate || undefined,
        startDate: editStopStartDate || undefined,
      };
      return next;
    });
    closeEditStop();
  }

  function deleteEditingStop() {
    if (!editingStop) {
      return;
    }

    onDeleteStop(editingStop.memories.map((memory) => memory.id), editingStop.id, editingStop.title);
    setStopDateOverrides((current) => {
      const next = { ...current };
      delete next[stopDateKey(editingStop.title)];
      return next;
    });
    closeEditStop();
  }

  function closeAddStop() {
    setIsAddingStop(false);
    setNewStopEndDate("");
    setNewStopStartDate("");
    setNewStopTitle("");
  }

  function submitAddStop() {
    if (!newStopTitle.trim()) {
      return;
    }

    onAddStop({
      endDate: newStopEndDate || undefined,
      startDate: newStopStartDate || undefined,
      title: newStopTitle,
    });
    closeAddStop();
  }

  return (
    <>
      <main className="app-scroll h-[calc(100%-132px)] overflow-y-auto px-3 pb-48 pt-2">
        <section>
          <h2 className="text-[25px] font-black leading-tight">
            {stops.length ? `We found ${stops.length} ${stops.length === 1 ? "stop" : "stops"}` : "Review your memories"}
          </h2>
          <p className="mt-2 max-w-[285px] text-sm font-semibold leading-relaxed text-ink/72">
            Review, rename, and drag photos to the correct stop.
          </p>
        </section>

        <section className="mt-5 space-y-2">
          {stops.map((stop, index) => {
            const isDragTarget = dragOverStopId === stop.id;
            const dateOverride = stopDateOverrides[stopDateKey(stop.title)];
            const dateLabel = dateOverride ? formatManualStopDateRange(dateOverride.startDate, dateOverride.endDate) : stop.dateLabel;

            return (
              <article
                className={`rounded-[14px] border bg-white p-3 shadow-[0_8px_22px_rgba(24,35,31,0.07)] transition ${isDragTarget ? "border-moss bg-[#f7fbf6]" : "border-ink/8"}`}
                key={stop.id}
                onDragEnter={(event) => {
                  event.preventDefault();
                  setDragOverStopId(stop.id);
                }}
                onDragLeave={() => setDragOverStopId(null)}
                onDragOver={(event) => {
                  event.preventDefault();
                  event.dataTransfer.dropEffect = "move";
                  setDragOverStopId(stop.id);
                }}
                onDrop={(event) => {
                  event.preventDefault();
                  const memoryId = event.dataTransfer.getData("text/plain");
                  if (memoryId) {
                    handleDrop(stop, memoryId);
                  }
                }}
              >
                <div className="flex items-start gap-2">
                  <span className="mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-full bg-moss text-xs font-black text-white shadow-sm">
                    {index + 1}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="w-full text-left">
                      <span className="block truncate text-[15px] font-black leading-tight text-ink">{stop.title}</span>
                    </div>
                    <span className="mt-1 block text-xs font-semibold text-ink/42">
                      {formatMediaCount(stop.photoCount, "photo")}{stop.videoCount ? `, ${formatMediaCount(stop.videoCount, "video")}` : ""}
                    </span>
                    {dateLabel ? <span className="mt-0.5 block text-xs font-semibold text-ink/38">{dateLabel}</span> : null}
                  </div>
                  <button aria-label={`Rename ${stop.title}`} className="grid h-8 w-8 shrink-0 place-items-center rounded-full text-ink/70" onClick={() => startEditingStop(stop)} type="button">
                    <Pencil aria-hidden="true" size={16} />
                  </button>
                </div>

                <div className="mt-3 flex gap-2 overflow-x-auto pb-1 [-webkit-overflow-scrolling:touch]">
                  {stop.memories.map((memory, memoryIndex) => (
                    <button
                      aria-label={`Show reverse geocoding data for ${stop.title} memory ${memoryIndex + 1}`}
                      className="relative h-[74px] w-[74px] shrink-0 overflow-hidden rounded-[9px] bg-shell"
                      data-memory-id={memory.id}
                      draggable
                      key={memory.id}
                      onClick={() => setSelectedMemory(memory)}
                      onDragStart={(event) => {
                        event.dataTransfer.effectAllowed = "move";
                        event.dataTransfer.setData("text/plain", memory.id);
                      }}
                      type="button"
                    >
                      <MemoryPreview memory={memory} />
                      {memory.kind === "video" ? (
                        <span className="absolute bottom-1 right-1 grid h-5 w-5 place-items-center rounded-[6px] bg-ink/50 text-white backdrop-blur">
                          <Video aria-hidden="true" size={11} />
                        </span>
                      ) : null}
                    </button>
                  ))}
                </div>

              </article>
            );
          })}
        </section>

        {unsorted.length ? (
          <section className="mt-6">
            <div className="mb-3 flex items-end justify-between gap-3">
              <div>
                <h3 className="text-base font-black text-ink">Unsorted memories</h3>
                <p className="mt-1 text-xs font-semibold text-ink/52">
                  No location data found · {formatMediaCount(unsortedPhotoCount, "photo")}{unsortedVideoCount ? `, ${formatMediaCount(unsortedVideoCount, "video")}` : ""}
                </p>
              </div>
            </div>
            <div className="grid grid-cols-4 gap-2">
              {unsorted.map((memory, index) => (
                <button
                  aria-label={`Show reverse geocoding data for unsorted memory ${index + 1}`}
                  className="aspect-square overflow-hidden rounded-[9px] bg-shell"
                  data-memory-id={memory.id}
                  draggable
                  key={memory.id}
                  onClick={() => setSelectedMemory(memory)}
                  onDragStart={(event) => {
                    event.dataTransfer.effectAllowed = "move";
                    event.dataTransfer.setData("text/plain", memory.id);
                  }}
                  type="button"
                >
                  <MemoryPreview memory={memory} />
                </button>
              ))}
            </div>
          </section>
        ) : null}
      </main>

      {selectedMemory ? (
        <section className="fixed inset-x-0 bottom-0 z-[70] mx-auto max-w-[430px] rounded-t-[18px] bg-white p-4 shadow-[0_-16px_44px_rgba(24,35,31,0.18)]">
          <div className="mb-3 flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h3 className="truncate text-base font-black text-ink">Reverse geocoding data</h3>
              <p className="mt-1 truncate text-xs font-semibold text-ink/52">{selectedMemory.file.name}</p>
            </div>
            <button className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-[#f5f2ed] text-ink" onClick={() => setSelectedMemory(null)} type="button">
              <X aria-hidden="true" size={17} />
            </button>
          </div>
          <div className="mb-3 grid grid-cols-[72px_1fr] gap-3">
            <div className="aspect-square overflow-hidden rounded-[10px] bg-shell">
              <MemoryPreview memory={selectedMemory} />
            </div>
            <div className="min-w-0 text-xs font-semibold leading-relaxed text-ink/66">
              <p className="truncate"><span className="font-black text-ink">Chosen:</span> {selectedMemory.metadata.location ?? "None"}</p>
              <p><span className="font-black text-ink">Date:</span> {selectedMemory.metadata.date || "None"}</p>
              <p className="truncate"><span className="font-black text-ink">GPS:</span> {formatDebugCoordinates(selectedMemory.metadata.coordinates)}</p>
            </div>
          </div>
          <pre className="max-h-56 overflow-auto rounded-[10px] bg-[#f5f2ed] p-3 text-[10px] font-semibold leading-relaxed text-ink/72">
            {JSON.stringify(selectedMemory.metadata.geocodeDebug ?? { message: "No Mapbox reverse geocoding data was returned for this file." }, null, 2)}
          </pre>
        </section>
      ) : null}

      {isAddingStop ? (
        <section className="fixed inset-0 z-[80] flex items-center justify-center bg-ink/24 px-3">
          <div className="w-full max-w-[430px] rounded-[16px] bg-white p-4 shadow-[0_18px_48px_rgba(24,35,31,0.22)]">
            <div className="mb-4 flex items-center justify-between gap-3">
              <h3 className="text-lg font-black text-ink">Add Stop</h3>
              <button className="grid h-9 w-9 place-items-center rounded-full bg-[#f5f2ed] text-ink" onClick={closeAddStop} type="button">
                <X aria-hidden="true" size={17} />
              </button>
            </div>

            <label className="block">
              <span className="mb-2 block text-sm font-black text-ink">Stop title</span>
              <input
                autoFocus
                className="h-12 w-full rounded-[9px] border border-ink/12 bg-white px-3 text-base font-semibold text-ink outline-none focus:border-moss"
                onChange={(event) => setNewStopTitle(event.target.value)}
                placeholder="e.g. Kona"
                value={newStopTitle}
              />
            </label>

            <div className="mt-4 grid grid-cols-2 gap-3">
              <label className="block">
                <span className="mb-2 block text-sm font-black text-ink">Start date</span>
                <input
                  className="h-11 w-full rounded-[9px] border border-ink/12 bg-white px-3 text-sm font-semibold text-ink outline-none focus:border-moss"
                  onChange={(event) => setNewStopStartDate(event.target.value)}
                  type="date"
                  value={newStopStartDate}
                />
              </label>
              <label className="block">
                <span className="mb-2 block text-sm font-black text-ink">End date</span>
                <input
                  className="h-11 w-full rounded-[9px] border border-ink/12 bg-white px-3 text-sm font-semibold text-ink outline-none focus:border-moss"
                  onChange={(event) => setNewStopEndDate(event.target.value)}
                  type="date"
                  value={newStopEndDate}
                />
              </label>
            </div>

            <button
              className="mt-5 flex h-12 w-full items-center justify-center rounded-[9px] bg-moss px-4 text-base font-black text-white disabled:opacity-40"
              disabled={!newStopTitle.trim()}
              onClick={submitAddStop}
              type="button"
            >
              Add Stop
            </button>
          </div>
        </section>
      ) : null}

      {editingStop ? (
        <section className="fixed inset-0 z-[80] flex items-center justify-center bg-ink/24 px-3">
          <div className="w-full max-w-[430px] rounded-[16px] bg-white p-4 shadow-[0_18px_48px_rgba(24,35,31,0.22)]">
            <div className="mb-4 flex items-center justify-between gap-3">
              <h3 className="text-lg font-black text-ink">Edit Stop</h3>
              <button className="grid h-9 w-9 place-items-center rounded-full bg-[#f5f2ed] text-ink" onClick={closeEditStop} type="button">
                <X aria-hidden="true" size={17} />
              </button>
            </div>

            <label className="block">
              <span className="mb-2 block text-sm font-black text-ink">Stop title</span>
              <input
                autoFocus
                className="h-12 w-full rounded-[9px] border border-ink/12 bg-white px-3 text-base font-semibold text-ink outline-none focus:border-moss"
                onChange={(event) => setEditStopTitle(event.target.value)}
                value={editStopTitle}
              />
            </label>

            <div className="mt-4 grid grid-cols-2 gap-3">
              <label className="block">
                <span className="mb-2 block text-sm font-black text-ink">Start date</span>
                <input
                  className="h-11 w-full rounded-[9px] border border-ink/12 bg-white px-3 text-sm font-semibold text-ink outline-none focus:border-moss"
                  onChange={(event) => setEditStopStartDate(event.target.value)}
                  type="date"
                  value={editStopStartDate}
                />
              </label>
              <label className="block">
                <span className="mb-2 block text-sm font-black text-ink">End date</span>
                <input
                  className="h-11 w-full rounded-[9px] border border-ink/12 bg-white px-3 text-sm font-semibold text-ink outline-none focus:border-moss"
                  onChange={(event) => setEditStopEndDate(event.target.value)}
                  type="date"
                  value={editStopEndDate}
                />
              </label>
            </div>

            <div className="mt-5 grid grid-cols-[1fr_1.4fr] gap-3">
              <button className="h-12 rounded-[9px] bg-[#f5f2ed] px-4 text-base font-black text-red-700" onClick={deleteEditingStop} type="button">
                Delete
              </button>
              <button
                className="h-12 rounded-[9px] bg-moss px-4 text-base font-black text-white disabled:opacity-40"
                disabled={!editStopTitle.trim()}
                onClick={saveStopEdits}
                type="button"
              >
                Save
              </button>
            </div>
          </div>
        </section>
      ) : null}

      <footer className="absolute inset-x-0 bottom-0 z-50 space-y-3 bg-white px-3 pb-[calc(var(--safe-area-bottom)+1rem)] pt-3">
        <button className="flex h-12 w-full items-center justify-center gap-2 rounded-[9px] bg-[#f5f2ed] text-base font-black text-ink" onClick={() => setIsAddingStop(true)} type="button">
          <Plus aria-hidden="true" size={18} />
          Add Stop
        </button>
        <button
          className="flex h-16 w-full items-center justify-center gap-4 rounded-[9px] bg-moss px-5 text-base font-black text-white shadow-lift disabled:bg-moss/35 disabled:shadow-none"
          disabled={unsorted.length > 0}
          onClick={onReview}
          type="button"
        >
          Next
          <ArrowRight aria-hidden="true" size={20} />
        </button>
      </footer>
    </>
  );
}

function TripRecommendationsStep({
  onNext,
  recommendationsByStop,
  setRecommendationsByStop,
  stops,
}: {
  onNext: () => void;
  recommendationsByStop: Record<string, TripRecommendationDraft[]>;
  setRecommendationsByStop: Dispatch<SetStateAction<Record<string, TripRecommendationDraft[]>>>;
  stops: TripStop[];
}) {
  const [expandedStopIds, setExpandedStopIds] = useState<Set<string>>(() => new Set(stops[0]?.id ? [stops[0].id] : []));
  const [activeRecommendationStop, setActiveRecommendationStop] = useState<TripStop | null>(null);
  const [showTips, setShowTips] = useState(false);

  function toggleStop(stopId: string) {
    setExpandedStopIds((current) => {
      const next = new Set(current);

      if (next.has(stopId)) {
        next.delete(stopId);
      } else {
        next.add(stopId);
      }

      return next;
    });
  }

  return (
    <>
      <main className="app-scroll h-[calc(100%-132px)] overflow-y-auto px-3 pb-28 pt-2">
        <section className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-[25px] font-black leading-tight">Add recommendations</h2>
            <p className="mt-2 max-w-[285px] text-sm font-semibold leading-relaxed text-ink/72">
              Add the best places, activities, and experiences you recommend at each stop.
            </p>
          </div>
          <button className="mt-1 flex h-8 shrink-0 items-center gap-1 rounded-full bg-[#e8efe3] px-3 text-xs font-black text-moss" onClick={() => setShowTips(true)} type="button">
            <Lightbulb aria-hidden="true" size={13} />
            Tips
          </button>
        </section>

        <section className="mt-5 space-y-3">
          {stops.map((stop, index) => {
            const isExpanded = expandedStopIds.has(stop.id);
            const recommendations = recommendationsByStop[stop.id] ?? [];
            const sampleRecommendation = index === 0 && recommendations.length === 0 ? sampleRecommendationForStop(stop) : null;

            return (
              <article className="rounded-[14px] border border-ink/8 bg-white p-3 shadow-[0_8px_22px_rgba(24,35,31,0.07)]" key={stop.id}>
                <button className="flex w-full items-start gap-2 text-left" onClick={() => toggleStop(stop.id)} type="button">
                  <span className="mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-full bg-moss text-xs font-black text-white shadow-sm">{index + 1}</span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[15px] font-black leading-tight text-ink">{stop.title}</span>
                    {stop.dateLabel ? <span className="mt-1 block text-xs font-semibold text-ink/42">{stop.dateLabel}</span> : null}
                  </span>
                  <ChevronDown aria-hidden="true" className={`mt-1 shrink-0 text-ink/64 transition-transform ${isExpanded ? "rotate-180" : ""}`} size={18} />
                </button>

                {isExpanded ? (
                  <div className="mt-4">
                    <p className="mb-3 text-xs font-semibold text-ink/52">
                      {recommendations.length} {recommendations.length === 1 ? "recommendation" : "recommendations"}
                    </p>
                    <div className="space-y-3">
                      {recommendations.map((recommendation) => {
                        const recommendationMemory = stop.memories.find((memory) => memory.id === recommendation.mediaIds[0]) ?? stop.memories[0];

                        return (
                          <RecommendationRow key={recommendation.id} memory={recommendationMemory} recommendation={recommendation} />
                        );
                      })}
                      {sampleRecommendation ? (
                        <article className="grid grid-cols-[18px_56px_1fr_28px] items-center gap-2 opacity-45" key={sampleRecommendation.id}>
                          <GripVertical aria-hidden="true" className="text-ink/38" size={16} />
                          <div className="h-14 w-14 overflow-hidden rounded-[8px] bg-shell">
                            {sampleRecommendation.memory ? <MemoryPreview memory={sampleRecommendation.memory} /> : <ImagePlus aria-hidden="true" className="m-auto mt-4 text-ink/34" size={20} />}
                          </div>
                          <div className="min-w-0">
                            <h3 className="line-clamp-2 text-sm font-black leading-tight text-ink">{sampleRecommendation.title}</h3>
                            <p className="mt-0.5 line-clamp-2 text-xs font-semibold leading-snug text-ink/52">{sampleRecommendation.description}</p>
                          </div>
                          <button aria-label={`Edit ${sampleRecommendation.title}`} className="grid h-8 w-8 place-items-center rounded-full text-ink/70" type="button">
                            <MoreHorizontal aria-hidden="true" size={18} />
                          </button>
                        </article>
                      ) : null}
                    </div>

                    <button
                      className="mt-4 flex h-12 w-full items-center justify-center gap-2 rounded-[9px] border border-dashed border-moss bg-white text-sm font-black text-ink"
                      onClick={() => setActiveRecommendationStop(stop)}
                      type="button"
                    >
                      <Plus aria-hidden="true" size={17} />
                      Add Recommendation
                    </button>
                  </div>
                ) : null}
              </article>
            );
          })}
        </section>
      </main>

      {activeRecommendationStop ? (
        <AddRecommendationPanel
          onAdd={(recommendation) => {
            setRecommendationsByStop((current) => ({
              ...current,
              [activeRecommendationStop.id]: [...(current[activeRecommendationStop.id] ?? []), recommendation],
            }));
            setActiveRecommendationStop(null);
          }}
          onClose={() => setActiveRecommendationStop(null)}
          stop={activeRecommendationStop}
        />
      ) : null}

      {showTips ? (
        <section className="fixed inset-0 z-[95] flex items-center justify-center bg-ink/24 px-4">
          <div className="w-full max-w-[360px] rounded-[18px] bg-white p-5 shadow-[0_18px_48px_rgba(24,35,31,0.22)]">
            <div className="mb-3 flex items-start justify-between gap-3">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.14em] text-moss">Tips</p>
                <h3 className="mt-1 text-xl font-black leading-tight text-ink">Add map-worthy moments</h3>
              </div>
              <button aria-label="Close tips" className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-[#f5f2ed] text-ink" onClick={() => setShowTips(false)} type="button">
                <X aria-hidden="true" size={17} />
              </button>
            </div>
            <p className="text-sm font-semibold leading-relaxed text-ink/68">
              Recommendations are the places, meals, hikes, views, stays, and experiences from your trip that friends can discover on the map.
            </p>
            <p className="mt-3 text-sm font-semibold leading-relaxed text-ink/68">
              Add the highlights under each stop so your trip becomes easy to browse, save, and follow later.
            </p>
            <button className="mt-5 h-12 w-full rounded-[9px] bg-moss text-base font-black text-white" onClick={() => setShowTips(false)} type="button">
              Got it
            </button>
          </div>
        </section>
      ) : null}

      <footer className="absolute inset-x-0 bottom-0 z-50 bg-white px-3 pb-[calc(var(--safe-area-bottom)+1rem)] pt-3">
        <button className="flex h-16 w-full items-center justify-center gap-4 rounded-[9px] bg-moss px-5 text-base font-black text-white shadow-lift" onClick={onNext} type="button">
          Next
          <ArrowRight aria-hidden="true" size={20} />
        </button>
      </footer>
    </>
  );
}

function sampleRecommendationForStop(stop: TripStop) {
  return {
    description: "Add a short description of what made this place worth recommending.",
    id: `${stop.id}-sample-recommendation`,
    memory: stop.memories[0],
    title: "Example recommendation title",
  };
}

function RecommendationRow({ memory, recommendation }: { memory?: TripMemory; recommendation: TripRecommendationDraft }) {
  return (
    <article className="grid grid-cols-[18px_56px_1fr_28px] items-center gap-2">
      <GripVertical aria-hidden="true" className="text-ink/38" size={16} />
      <div className="h-14 w-14 overflow-hidden rounded-[8px] bg-shell">
        {memory ? <MemoryPreview memory={memory} /> : <ImagePlus aria-hidden="true" className="m-auto mt-4 text-ink/34" size={20} />}
      </div>
      <div className="min-w-0">
        <h3 className="line-clamp-2 text-sm font-black leading-tight text-ink">{recommendation.title}</h3>
        {recommendation.description ? <p className="mt-0.5 line-clamp-2 text-xs font-semibold leading-snug text-ink/52">{recommendation.description}</p> : null}
      </div>
      <button aria-label={`Edit ${recommendation.title}`} className="grid h-8 w-8 place-items-center rounded-full text-ink/70" type="button">
        <MoreHorizontal aria-hidden="true" size={18} />
      </button>
    </article>
  );
}

function AddRecommendationPanel({ onAdd, onClose, stop }: { onAdd: (recommendation: TripRecommendationDraft) => void; onClose: () => void; stop: TripStop }) {
  const [description, setDescription] = useState("");
  const [selectedMediaIds, setSelectedMediaIds] = useState<Set<string>>(() => new Set(stop.memories[0]?.id ? [stop.memories[0].id] : []));
  const [selectedTags, setSelectedTags] = useState<AppPostTag[]>([]);
  const [title, setTitle] = useState("");

  function toggleMedia(memoryId: string) {
    setSelectedMediaIds((current) => {
      const next = new Set(current);

      if (next.has(memoryId)) {
        next.delete(memoryId);
      } else {
        next.add(memoryId);
      }

      return next;
    });
  }

  function toggleTag(tag: AppPostTag) {
    setSelectedTags((current) => (current.includes(tag) ? current.filter((item) => item !== tag) : [...current, tag]));
  }

  function addRecommendation() {
    const trimmedTitle = title.trim();

    if (!trimmedTitle || selectedMediaIds.size === 0) {
      return;
    }

    onAdd({
      description: description.trim(),
      id: `${stop.id}-recommendation-${Date.now()}`,
      mediaIds: Array.from(selectedMediaIds),
      tags: selectedTags,
      title: trimmedTitle,
    });
  }

  return (
    <section className="absolute inset-x-0 bottom-0 top-8 z-[90] flex flex-col overflow-hidden rounded-t-[24px] border border-ink/8 bg-white text-ink shadow-[0_-16px_42px_rgba(24,35,31,0.16)]">
      <header className="bg-white px-3 pb-4 pt-4">
        <div className="mx-auto mb-3 h-1 w-11 rounded-full bg-ink/14" />
        <div className="grid grid-cols-[3rem_1fr_3rem] items-start">
          <button aria-label="Back to recommendations" className="-ml-1 grid h-10 w-10 place-items-center rounded-full text-ink" onClick={onClose} type="button">
            <ArrowLeft aria-hidden="true" size={21} />
          </button>
          <div className="text-center">
            <h1 className="text-base font-black">Add Recommendation</h1>
            <p className="mt-1 truncate text-xs font-semibold text-ink/56">
              {stop.title}
              {stop.dateLabel ? ` · ${stop.dateLabel}` : ""}
            </p>
          </div>
          <span />
        </div>
      </header>

      <main className="app-scroll flex-1 overflow-y-auto px-3 pb-6 pt-1">
        <section>
          <p className="text-xs font-semibold text-ink/56">Select from your uploaded media</p>
          <div className="mt-4 grid grid-cols-3 gap-2.5">
            {stop.memories.map((memory, index) => {
              const isSelected = selectedMediaIds.has(memory.id);

              return (
                <button
                  aria-label={`Select media ${index + 1}`}
                  className={`relative aspect-square overflow-hidden rounded-[9px] bg-shell ${isSelected ? "ring-2 ring-moss ring-offset-2" : ""}`}
                  key={memory.id}
                  onClick={() => toggleMedia(memory.id)}
                  type="button"
                >
                  <MemoryPreview memory={memory} />
                  <span className={`absolute right-1.5 top-1.5 grid h-6 w-6 place-items-center rounded-full text-xs font-black shadow-sm ${isSelected ? "bg-moss text-white" : "bg-white/76 text-ink/48"}`}>
                    {isSelected ? "✓" : ""}
                  </span>
                  {memory.kind === "video" ? (
                    <span className="absolute bottom-1.5 right-1.5 grid h-6 w-6 place-items-center rounded-[7px] bg-ink/50 text-white backdrop-blur">
                      <Video aria-hidden="true" size={13} />
                    </span>
                  ) : null}
                </button>
              );
            })}
          </div>
        </section>

        <section className="mt-8">
          <label className="block">
            <span className="mb-2 block text-sm font-normal text-ink">Recommendation title</span>
            <input
              className="h-12 w-full rounded-[9px] border border-ink/12 bg-white px-3 text-base font-semibold text-ink outline-none focus:border-moss"
              maxLength={80}
              onChange={(event) => setTitle(event.target.value)}
              placeholder="e.g. Manta Ray Night Dive"
              value={title}
            />
            <span className="mt-1 block text-right text-xs font-bold text-ink/42">{title.length}/80</span>
          </label>

          <label className="mt-4 block">
            <span className="mb-2 block text-sm font-normal text-ink">Description</span>
            <textarea
              className="min-h-[106px] w-full resize-none rounded-[9px] border border-ink/12 bg-white px-3 py-3 text-sm font-semibold leading-relaxed text-ink outline-none placeholder:text-ink/34 focus:border-moss"
              maxLength={300}
              onChange={(event) => setDescription(event.target.value)}
              placeholder="Share what makes this place or experience special."
              value={description}
            />
            <span className="mt-1 block text-right text-xs font-bold text-ink/42">{description.length}/300</span>
          </label>

          <div className="mt-4">
            <p className="mb-2 text-sm font-normal text-ink">Tags</p>
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
          </div>
        </section>
      </main>

      <footer className="bg-white px-3 pb-[calc(var(--safe-area-bottom)+1rem)] pt-3">
        <button
          className="flex h-16 w-full items-center justify-center rounded-[9px] bg-moss px-5 text-base font-black text-white shadow-lift disabled:opacity-40"
          disabled={!title.trim() || selectedMediaIds.size === 0}
          onClick={addRecommendation}
          type="button"
        >
          Add Recommendation
        </button>
      </footer>
    </section>
  );
}

function TripDetailsStep({
  coverMemoryId,
  description,
  endDate,
  memories,
  onNext,
  setCoverMemoryId,
  setDescription,
  setEndDate,
  setStartDate,
  startDate,
  stops,
  tripTitle,
  updateTripTitle,
}: {
  coverMemoryId: string;
  description: string;
  endDate: string;
  memories: TripMemory[];
  onNext: () => void;
  setCoverMemoryId: (memoryId: string) => void;
  setDescription: (description: string) => void;
  setEndDate: (date: string) => void;
  setStartDate: (date: string) => void;
  startDate: string;
  stops: TripStop[];
  tripTitle: string;
  updateTripTitle: (title: string) => void;
}) {
  const defaultDateRange = useMemo(() => tripDateBounds(stops, memories), [memories, stops]);
  const [isChoosingCover, setIsChoosingCover] = useState(false);
  const coverMemory = memories.find((memory) => memory.id === coverMemoryId) ?? memories[0];

  useEffect(() => {
    if (!coverMemoryId && memories[0]?.id) {
      setCoverMemoryId(memories[0].id);
    }
  }, [coverMemoryId, memories, setCoverMemoryId]);

  useEffect(() => {
    if (!startDate && defaultDateRange.startDate) {
      setStartDate(defaultDateRange.startDate);
    }

    if (!endDate && defaultDateRange.endDate) {
      setEndDate(defaultDateRange.endDate);
    }
  }, [defaultDateRange.endDate, defaultDateRange.startDate, endDate, setEndDate, setStartDate, startDate]);

  return (
    <>
      <main className="app-scroll h-[calc(100%-132px)] overflow-y-auto px-3 pb-28 pt-2">
        <section>
          <h2 className="text-[25px] font-black leading-tight">Trip details</h2>
          <p className="mt-2 max-w-[265px] text-sm font-semibold leading-relaxed text-ink/72">
            Add a few details to tell others about your adventure.
          </p>
        </section>

        <section className="mt-5 space-y-5">
          <label className="block">
            <span className="mb-2 block text-sm font-black text-ink">Trip title</span>
            <input
              className="h-12 w-full rounded-[9px] border border-ink/12 bg-white px-3 text-base font-semibold text-ink outline-none focus:border-moss"
              maxLength={80}
              onChange={(event) => updateTripTitle(event.target.value)}
              placeholder="10 Days in Hawaii"
              value={tripTitle}
            />
            <span className="mt-1 block text-right text-xs font-bold text-ink/42">{tripTitle.length}/80</span>
          </label>

          <label className="block">
            <span className="mb-2 block text-sm font-black text-ink">Dates</span>
            <div className="grid grid-cols-2 gap-2">
              <span className="flex h-12 items-center gap-2 rounded-[9px] border border-ink/12 bg-white px-3 text-sm font-semibold text-ink">
                <Calendar aria-hidden="true" className="shrink-0 text-ink/70" size={16} />
                <input
                  aria-label="Trip start date"
                  className="min-w-0 flex-1 bg-transparent outline-none"
                  onChange={(event) => setStartDate(event.target.value)}
                  type="date"
                  value={startDate}
                />
              </span>
              <span className="flex h-12 items-center gap-2 rounded-[9px] border border-ink/12 bg-white px-3 text-sm font-semibold text-ink">
                <Calendar aria-hidden="true" className="shrink-0 text-ink/70" size={16} />
                <input
                  aria-label="Trip end date"
                  className="min-w-0 flex-1 bg-transparent outline-none"
                  min={startDate || undefined}
                  onChange={(event) => setEndDate(event.target.value)}
                  type="date"
                  value={endDate}
                />
              </span>
            </div>
          </label>

          <label className="block">
            <span className="mb-2 block text-sm font-black text-ink">Description</span>
            <textarea
              className="min-h-[126px] w-full resize-none rounded-[9px] border border-ink/12 bg-white px-3 py-3 text-sm font-semibold leading-relaxed text-ink outline-none placeholder:text-ink/34 focus:border-moss"
              maxLength={1000}
              onChange={(event) => setDescription(event.target.value)}
              placeholder="Tell friends what made this trip special."
              value={description}
            />
            <span className="mt-1 block text-right text-xs font-bold text-ink/42">{description.length}/1000</span>
          </label>

          <section>
            <p className="mb-2 text-sm font-black text-ink">Cover photo</p>
            <div className="relative h-28 overflow-hidden rounded-[10px] bg-shell">
              {coverMemory ? <MemoryPreview memory={coverMemory} /> : <ImagePlus aria-hidden="true" className="m-auto mt-10 text-ink/34" size={28} />}
              {memories.length ? (
                <button className="absolute bottom-2 right-2 rounded-[8px] bg-white/82 px-3 py-2 text-xs font-black text-ink shadow-sm backdrop-blur" onClick={() => setIsChoosingCover(true)} type="button">
                  Change
                </button>
              ) : null}
            </div>
          </section>
        </section>
      </main>

      <footer className="absolute inset-x-0 bottom-0 z-50 bg-white px-3 pb-[calc(var(--safe-area-bottom)+1rem)] pt-3">
        <button
          className="flex h-16 w-full items-center justify-center gap-4 rounded-[9px] bg-moss px-5 text-base font-black text-white shadow-lift disabled:opacity-40"
          disabled={!tripTitle.trim()}
          onClick={onNext}
          type="button"
        >
          Next
          <ArrowRight aria-hidden="true" size={20} />
        </button>
      </footer>

      {isChoosingCover ? (
        <CoverPickerSheet
          coverMemoryId={coverMemory?.id ?? ""}
          memories={memories}
          onClose={() => setIsChoosingCover(false)}
          onSelect={(memoryId) => {
            setCoverMemoryId(memoryId);
            setIsChoosingCover(false);
          }}
        />
      ) : null}
    </>
  );
}

function TripReviewStep({
  coverMemoryId,
  description,
  endDate,
  memories,
  onPublish,
  publishMessage,
  publishing,
  recommendationsByStop,
  startDate,
  stops,
  tripTitle,
}: {
  coverMemoryId: string;
  description: string;
  endDate: string;
  memories: TripMemory[];
  onPublish: () => void;
  publishMessage: string;
  publishing: boolean;
  recommendationsByStop: Record<string, TripRecommendationDraft[]>;
  startDate: string;
  stops: TripStop[];
  tripTitle: string;
}) {
  const coverMemory = memories.find((memory) => memory.id === coverMemoryId) ?? memories[0];
  const recommendationCount = Object.values(recommendationsByStop).reduce((total, recommendations) => total + recommendations.length, 0);
  const photoCount = memories.filter((memory) => memory.kind === "image").length;
  const videoCount = memories.filter((memory) => memory.kind === "video").length;
  const locationSummary = stops.map((stop) => stop.title).filter(Boolean).join(", ");
  const dateLabel = formatDateRangeWithYear(startDate, endDate);
  const tripDays = countTripDays(startDate, endDate);
  const mapPoints = tripMapPreviewPoints(stops);
  const recommendationTags = uniqueRecommendationTags(recommendationsByStop);

  return (
    <>
      <main className="app-scroll h-[calc(100%-132px)] overflow-y-auto px-3 pb-28 pt-2">
        <section>
          <h2 className="text-[25px] font-black leading-tight">Review & publish</h2>
          <p className="mt-2 text-sm font-semibold leading-relaxed text-ink/72">Looks great! Ready to share your trip.</p>
        </section>

        <article className="mt-5 overflow-hidden rounded-[12px] border border-ink/8 bg-white shadow-[0_8px_22px_rgba(24,35,31,0.07)]">
          <div className="grid aspect-[1.67] grid-cols-[1.02fr_0.98fr] bg-shell">
            <div className="relative min-h-0 overflow-hidden">
              {coverMemory ? <MemoryPreview memory={coverMemory} /> : <ImagePlus aria-hidden="true" className="m-auto pt-16 text-ink/34" size={30} />}
              <div className="absolute inset-x-0 top-0 h-[68%] bg-gradient-to-b from-ink/72 via-ink/34 via-45% to-transparent" />
              <div className="absolute inset-x-0 top-0 h-16 bg-gradient-to-b from-ink/56 via-ink/24 to-transparent" />
              <div className="absolute left-3 right-3 top-3 text-white">
                <h3 className="text-lg font-semibold leading-tight">{tripTitle || "Untitled trip"}</h3>
                {dateLabel ? <p className="mt-1 text-sm font-bold text-white/84">{dateLabel}</p> : null}
              </div>
            </div>
            <TripPreviewMap points={mapPoints} />
          </div>

          <div className="space-y-4 p-4">
            {description.trim() ? <p className="text-sm font-semibold leading-relaxed text-ink">{description.trim()}</p> : null}
            <ReviewStat icon={<MapPin aria-hidden="true" size={17} />} text={`${stops.length} ${stops.length === 1 ? "stop" : "stops"}`} />
            <ReviewStat icon={<Lightbulb aria-hidden="true" size={17} />} text={`${recommendationCount} ${recommendationCount === 1 ? "recommendation" : "recommendations"}`} />
            <ReviewStat icon={<Camera aria-hidden="true" size={17} />} text={`${formatMediaCount(photoCount, "photo")}${videoCount ? `, ${formatMediaCount(videoCount, "video")}` : ""}`} />
            {tripDays ? <ReviewStat icon={<Calendar aria-hidden="true" size={17} />} text={`${tripDays} ${tripDays === 1 ? "day" : "days"}`} /> : null}
            {locationSummary ? <ReviewStat icon={<Route aria-hidden="true" size={17} />} text={locationSummary} /> : null}

            {recommendationTags.length ? (
              <section>
                <p className="mb-2 text-sm font-black text-ink">Tags</p>
                <div className="flex flex-wrap gap-2">
                  {recommendationTags.slice(0, 3).map((tag) => (
                    <span className="rounded-full bg-[#f1efeb] px-3 py-2 text-xs font-normal text-ink/72" key={tag}>
                      {tag}
                    </span>
                  ))}
                  {recommendationTags.length > 3 ? (
                    <span className="rounded-full bg-[#f1efeb] px-3 py-2 text-xs font-normal text-ink/72">+{recommendationTags.length - 3}</span>
                  ) : null}
                </div>
              </section>
            ) : null}
          </div>
        </article>
      </main>

      <footer className="absolute inset-x-0 bottom-0 z-50 bg-white px-3 pb-[calc(var(--safe-area-bottom)+1rem)] pt-3">
        {publishMessage ? <p className="mb-2 text-center text-xs font-bold text-coral">{publishMessage}</p> : null}
        <button
          className="flex h-16 w-full items-center justify-center gap-3 rounded-[9px] bg-moss px-5 text-base font-black text-white shadow-lift disabled:cursor-not-allowed disabled:opacity-55"
          disabled={publishing}
          onClick={onPublish}
          type="button"
        >
          <Send aria-hidden="true" size={19} />
          {publishing ? "Publishing..." : "Publish Trip"}
        </button>
      </footer>
    </>
  );
}

function ReviewStat({ icon, multiline = false, text }: { icon: ReactNode; multiline?: boolean; text: string }) {
  return (
    <div className="grid grid-cols-[20px_1fr] gap-3 text-sm font-semibold leading-relaxed text-ink">
      <span className="mt-0.5 text-ink/58">{icon}</span>
      <p className={multiline ? "whitespace-pre-line" : "truncate"}>{text}</p>
    </div>
  );
}

type TripPreviewMapPoint = {
  coordinates: [number, number];
  id: string;
  label: string;
  order: number;
};

function TripPreviewMap({ points }: { points: TripPreviewMapPoint[] }) {
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;
  const sortedPoints = [...points].sort((a, b) => a.order - b.order);

  useEffect(() => {
    if (!mapContainerRef.current || !token || !sortedPoints.length) {
      return;
    }

    mapboxgl.accessToken = token;
    const map = new mapboxgl.Map({
      attributionControl: false,
      center: sortedPoints[0].coordinates,
      container: mapContainerRef.current,
      interactive: false,
      style: "mapbox://styles/mapbox/outdoors-v12",
      zoom: sortedPoints.length > 1 ? 7 : 10,
    });

    map.on("load", () => {
      const routeCoordinates = sortedPoints.map((point) => point.coordinates);

      map.addSource("trip-preview-route", {
        data: {
          geometry: {
            coordinates: routeCoordinates,
            type: "LineString",
          },
          properties: {},
          type: "Feature",
        },
        type: "geojson",
      });

      map.addLayer({
        id: "trip-preview-route-shadow",
        paint: {
          "line-blur": 1.5,
          "line-color": "#ffffff",
          "line-opacity": 0.86,
          "line-width": 5,
        },
        source: "trip-preview-route",
        type: "line",
      });

      map.addLayer({
        id: "trip-preview-route-line",
        paint: {
          "line-color": "#1b5a37",
          "line-dasharray": [1.5, 1],
          "line-width": 2.4,
        },
        source: "trip-preview-route",
        type: "line",
      });

      sortedPoints.forEach((point, index) => {
        const element = document.createElement("span");
        element.className = "grid h-6 w-6 place-items-center rounded-full border-2 border-white bg-moss text-[11px] font-black text-white shadow-[0_4px_12px_rgba(24,35,31,0.24)]";
        element.textContent = String(index + 1);

        new mapboxgl.Marker({ element, anchor: "center" }).setLngLat(point.coordinates).addTo(map);
      });

      if (sortedPoints.length > 1) {
        const bounds = sortedPoints.reduce((nextBounds, point) => nextBounds.extend(point.coordinates), new mapboxgl.LngLatBounds(sortedPoints[0].coordinates, sortedPoints[0].coordinates));
        map.fitBounds(bounds, { duration: 0, padding: 36 });
      }
    });

    return () => map.remove();
  }, [sortedPoints, token]);

  return (
    <div className="relative min-h-0 overflow-hidden bg-[#dceadf]">
      {token && sortedPoints.length ? <div className="absolute inset-0" ref={mapContainerRef} /> : null}
      {!token || !sortedPoints.length ? <FallbackTripPreviewMap points={sortedPoints} /> : null}
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-l from-white/12 via-transparent to-ink/10" />
    </div>
  );
}

function FallbackTripPreviewMap({ points }: { points: TripPreviewMapPoint[] }) {
  const projectedPoints = projectTripMapPoints(points);
  const routePath = projectedPoints.map((point) => `${point.x},${point.y}`).join(" ");

  return (
      <svg aria-hidden="true" className="absolute inset-0 h-full w-full" preserveAspectRatio="none" viewBox="0 0 100 100">
        <defs>
          <linearGradient id="trip-preview-water" x1="0%" x2="100%" y1="0%" y2="100%">
            <stop offset="0%" stopColor="#cfe7e6" />
            <stop offset="100%" stopColor="#b7d4cc" />
          </linearGradient>
          <linearGradient id="trip-preview-land" x1="0%" x2="100%" y1="0%" y2="100%">
            <stop offset="0%" stopColor="#eff1d8" />
            <stop offset="55%" stopColor="#b9d69d" />
            <stop offset="100%" stopColor="#7eaf78" />
          </linearGradient>
        </defs>
        <rect fill="url(#trip-preview-water)" height="100" width="100" />
        <path d="M-8 80 C12 57 24 68 41 43 C58 17 75 25 109 5 L109 109 L-8 109 Z" fill="url(#trip-preview-land)" opacity="0.9" />
        <path d="M0 77 C16 60 29 66 43 45 C58 24 75 30 100 12" fill="none" opacity="0.24" stroke="#2f6b53" strokeWidth="5" />
        <path d="M5 91 C28 70 50 75 72 56 C85 44 91 31 105 22" fill="none" opacity="0.22" stroke="#ffffff" strokeWidth="3" />
        {routePath ? <polyline fill="none" points={routePath} stroke="#1d4f36" strokeDasharray="2.6 2.6" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.4" /> : null}
        {projectedPoints.map((point, index) => (
          <g key={point.id}>
            <circle cx={point.x} cy={point.y} fill="#ffffff" r="5.5" />
            <circle cx={point.x} cy={point.y} fill="#174f2e" r="4.1" />
            <text dominantBaseline="central" fill="#ffffff" fontFamily="ui-sans-serif, system-ui" fontSize="5" fontWeight="800" textAnchor="middle" x={point.x} y={point.y + 0.1}>
              {index + 1}
            </text>
          </g>
        ))}
      </svg>
  );
}

function CoverPickerSheet({
  coverMemoryId,
  memories,
  onClose,
  onSelect,
}: {
  coverMemoryId: string;
  memories: TripMemory[];
  onClose: () => void;
  onSelect: (memoryId: string) => void;
}) {
  return (
    <section className="fixed inset-0 z-[95] flex items-end bg-ink/24">
      <div className="w-full rounded-t-[18px] bg-white p-4 shadow-[0_-16px_44px_rgba(24,35,31,0.18)]">
        <div className="mb-4 flex items-center justify-between gap-3">
          <div>
            <h3 className="text-lg font-black text-ink">Choose cover</h3>
            <p className="mt-1 text-xs font-semibold text-ink/52">Select from your uploaded memories.</p>
          </div>
          <button aria-label="Close cover picker" className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-[#f5f2ed] text-ink" onClick={onClose} type="button">
            <X aria-hidden="true" size={17} />
          </button>
        </div>
        <div className="grid max-h-[340px] grid-cols-3 gap-2 overflow-y-auto pb-[calc(var(--safe-area-bottom)+0.5rem)]">
          {memories.map((memory, index) => {
            const isSelected = memory.id === coverMemoryId;

            return (
              <button
                aria-label={`Choose cover memory ${index + 1}`}
                className={`relative aspect-square overflow-hidden rounded-[9px] bg-shell ${isSelected ? "ring-2 ring-moss ring-offset-2" : ""}`}
                key={memory.id}
                onClick={() => onSelect(memory.id)}
                type="button"
              >
                <MemoryPreview memory={memory} />
                {isSelected ? <span className="absolute right-1.5 top-1.5 h-5 w-5 rounded-full bg-moss shadow-sm" /> : null}
              </button>
            );
          })}
        </div>
      </div>
    </section>
  );
}

function MemoryPreview({ memory }: { memory: TripMemory }) {
  return memory.kind === "video" && memory.posterUrl ? (
    <img alt="" className="h-full w-full object-cover" draggable={false} src={memory.posterUrl} />
  ) : memory.kind === "video" ? (
    <video className="h-full w-full object-cover" draggable={false} muted playsInline preload="metadata" src={memory.url} />
  ) : memory.isHeic && !memory.previewReady ? (
    <HeicPreview compact />
  ) : (
    <img alt="" className="h-full w-full object-cover" draggable={false} src={memory.url} />
  );
}

function HeicPreview({ compact = false }: { compact?: boolean }) {
  return (
    <div className="grid h-full w-full place-items-center bg-[#f1efeb] text-ink/62">
      <span className="flex flex-col items-center gap-1">
        <ImagePlus aria-hidden="true" size={compact ? 18 : 24} strokeWidth={1.9} />
        <span className="text-[10px] font-black">HEIC</span>
      </span>
    </div>
  );
}

function buildTripStops(memories: TripMemory[], manualStops: ManualTripStop[] = []): TripStopDraft {
  const sortedMemories = [...memories].sort((a, b) => compareOptionalDates(a.metadata.date, b.metadata.date));
  const groups: TripMemory[][] = [];
  const unsorted: TripMemory[] = [];

  sortedMemories.forEach((memory) => {
    if (!memory.metadata.location) {
      unsorted.push(memory);
      return;
    }

    const group = groups.find((items) => memoriesBelongTogether(items[0], memory));

    if (group) {
      group.push(memory);
      return;
    }

    groups.push([memory]);
  });

  const stops = groups.map((items, index) => {
    const dates = items.map((item) => item.metadata.date).filter((date): date is string => Boolean(date)).sort();
    const assignmentLocation = stopAssignmentLocationForGroup(items);
    const title = stopTitleForGroup(items);
    const photoCount = items.filter((item) => item.kind === "image").length;
    const videoCount = items.filter((item) => item.kind === "video").length;

    return {
      assignmentLocation,
      coverIsHeic: items[0]?.isHeic ?? false,
      coverPreviewReady: items[0]?.previewReady ?? false,
      coverUrl: items[0]?.posterUrl ?? items[0]?.url ?? null,
      dateLabel: dates[0] ? formatDateRange(dates[0], dates[dates.length - 1]) : "",
      endDate: dates[dates.length - 1],
      id: `${title}-${dates[0] ?? "undated"}-${index}`,
      memories: items,
      photoCount,
      startDate: dates[0],
      title,
      videoCount,
    };
  });

  const existingStopTitles = new Set(stops.map((stop) => normalizeStopTitle(stop.title)));
  const emptyManualStops = manualStops
    .filter((stop) => !existingStopTitles.has(normalizeStopTitle(stop.title)))
    .map((stop) => ({
      assignmentLocation: stop.title,
      coverIsHeic: false,
      coverPreviewReady: false,
      coverUrl: null,
      dateLabel: formatManualStopDateRange(stop.startDate, stop.endDate),
      endDate: stop.endDate,
      id: stop.id,
      memories: [],
      photoCount: 0,
      startDate: stop.startDate,
      title: cleanStopTitle(stop.title),
      videoCount: 0,
    }));

  return { stops: [...stops, ...emptyManualStops].sort(compareStopsByDate), unsorted };
}

function memoriesBelongTogether(a: TripMemory | undefined, b: TripMemory) {
  if (!a) {
    return false;
  }

  const aTitle = normalizeStopTitle(a.metadata.location ?? "");
  const bTitle = normalizeStopTitle(b.metadata.location ?? "");

  return Boolean(aTitle && bTitle && aTitle === bTitle);
}

function stopTitleForGroup(items: TripMemory[]) {
  const titleCounts = new Map<string, { count: number; firstIndex: number; title: string }>();

  items.forEach((item, index) => {
    if (!item.metadata.location) {
      return;
    }

    const title = cleanStopTitle(item.metadata.location);
    const key = title.toLowerCase();
    const current = titleCounts.get(key);

    if (current) {
      current.count += 1;
      return;
    }

    titleCounts.set(key, { count: 1, firstIndex: index, title });
  });

  const bestTitle = [...titleCounts.values()].sort((a, b) => b.count - a.count || a.firstIndex - b.firstIndex)[0]?.title;
  return bestTitle ?? "";
}

function stopAssignmentLocationForGroup(items: TripMemory[]) {
  const locationCounts = new Map<string, { count: number; firstIndex: number; location: string }>();

  items.forEach((item, index) => {
    const location = item.metadata.location;

    if (!location) {
      return;
    }

    const key = normalizeStopTitle(location);
    const current = locationCounts.get(key);

    if (current) {
      current.count += 1;
      return;
    }

    locationCounts.set(key, { count: 1, firstIndex: index, location });
  });

  return [...locationCounts.values()].sort((a, b) => b.count - a.count || a.firstIndex - b.firstIndex)[0]?.location ?? "";
}

function cleanStopTitle(location: string) {
  const cleanTitle = cleanFullLocationName(location);

  return cleanTitle.split(",")[0]?.trim() || cleanTitle || location;
}

function cleanFullLocationName(location: string) {
  return abbreviateStateNames(location)
    .replace(/\b(united states|usa|us)\b/gi, "")
    .replace(/\s{2,}/g, " ")
    .replace(/\s+,/g, ",")
    .replace(/,\s*$/g, "")
    .trim();
}

function abbreviateStateNames(location: string) {
  return location
    .split(",")
    .map((part) => {
      const trimmed = part.trim();
      return stateAbbreviations[trimmed.toLowerCase()] ?? trimmed;
    })
    .join(", ");
}

function normalizeStopTitle(location: string) {
  return cleanFullLocationName(location).toLowerCase();
}

function stopDateKey(title: string) {
  return normalizeStopTitle(title);
}

function compareOptionalDates(a?: string, b?: string) {
  if (!a && !b) {
    return 0;
  }

  if (!a) {
    return 1;
  }

  if (!b) {
    return -1;
  }

  return a.localeCompare(b);
}

function compareStopsByDate(a: TripStop, b: TripStop) {
  return compareOptionalDates(a.startDate, b.startDate);
}

function formatDebugCoordinates(coordinates?: [number, number]) {
  if (!coordinates) {
    return "None";
  }

  const [longitude, latitude] = coordinates;
  return `${latitude.toFixed(5)}, ${longitude.toFixed(5)}`;
}

function formatDateRange(start?: string, end?: string) {
  if (!start && !end) {
    return "";
  }

  if (!end || start === end) {
    return formatTripDate(start);
  }

  const startDate = parseLocalDate(start);
  const endDate = parseLocalDate(end);

  if (!startDate || !endDate) {
    return `${start} - ${end}`;
  }

  const month = new Intl.DateTimeFormat("en-US", { month: "short" });
  return `${month.format(startDate)} ${startDate.getDate()} - ${month.format(endDate)} ${endDate.getDate()}`;
}

function formatManualStopDateRange(start?: string, end?: string) {
  if (!start && !end) {
    return "";
  }

  return formatDateRange(start, end);
}

function tripDateBounds(stops: TripStop[], memories: TripMemory[]) {
  const stopDates = stops.flatMap((stop) => [stop.startDate, stop.endDate]);
  const memoryDates = memories.map((memory) => memory.metadata.date);
  const dates = [...stopDates, ...memoryDates].filter((date): date is string => Boolean(date)).sort();

  return {
    endDate: dates[dates.length - 1] ?? "",
    startDate: dates[0] ?? "",
  };
}

function formatDateRangeWithYear(start?: string, end?: string) {
  if (!start && !end) {
    return "";
  }

  const startDate = parseLocalDate(start);
  const endDate = parseLocalDate(end);

  if (!end || start === end || !endDate) {
    return startDate ? new Intl.DateTimeFormat("en-US", { day: "numeric", month: "short", year: "numeric" }).format(startDate) : start ?? "";
  }

  if (!startDate) {
    return endDate ? new Intl.DateTimeFormat("en-US", { day: "numeric", month: "short", year: "numeric" }).format(endDate) : end;
  }

  const sameYear = startDate.getFullYear() === endDate.getFullYear();
  const startFormat = new Intl.DateTimeFormat("en-US", { day: "numeric", month: "short", year: sameYear ? undefined : "numeric" });
  const endFormat = new Intl.DateTimeFormat("en-US", { day: "numeric", month: "short", year: "numeric" });

  return `${startFormat.format(startDate)} - ${endFormat.format(endDate)}`;
}

function countTripDays(start?: string, end?: string) {
  const startDate = parseLocalDate(start);
  const endDate = parseLocalDate(end || start);

  if (!startDate || !endDate) {
    return 0;
  }

  return Math.max(1, Math.round((endDate.getTime() - startDate.getTime()) / 86400000) + 1);
}

function uniqueRecommendationTags(recommendationsByStop: Record<string, TripRecommendationDraft[]>) {
  const tags = Object.values(recommendationsByStop).flatMap((recommendations) => recommendations.flatMap((recommendation) => recommendation.tags));
  return Array.from(new Set(tags));
}

function tripMapPreviewPoints(stops: TripStop[]): TripPreviewMapPoint[] {
  const points: TripPreviewMapPoint[] = [];

  stops.forEach((stop, stopIndex) => {
    const stopCoordinates = averageCoordinates(stop.memories.map((memory) => memory.metadata.coordinates));

    if (stopCoordinates) {
      points.push({
        coordinates: stopCoordinates,
        id: `${stop.id}-map-stop`,
        label: stop.title,
        order: stopIndex,
      });
    }
  });

  return points.length ? points : fallbackTripMapPoints(stops);
}

function averageCoordinates(coordinates: Array<[number, number] | undefined>): [number, number] | null {
  const validCoordinates = coordinates.filter((coordinate): coordinate is [number, number] => Boolean(coordinate));

  if (!validCoordinates.length) {
    return null;
  }

  const totals = validCoordinates.reduce(
    (sum, coordinate) => ({
      latitude: sum.latitude + coordinate[1],
      longitude: sum.longitude + coordinate[0],
    }),
    { latitude: 0, longitude: 0 },
  );

  return [totals.longitude / validCoordinates.length, totals.latitude / validCoordinates.length];
}

function clearTripPostCaches(accountId: string) {
  if (typeof window === "undefined") {
    return;
  }

  window.sessionStorage.removeItem("odyssey-app-posts-cache-v2");
  window.sessionStorage.removeItem(`odyssey-profile-posts-cache-v1-${accountId}`);
}

function fallbackTripMapPoints(stops: TripStop[]): TripPreviewMapPoint[] {
  const fallbackCoordinates: Array<[number, number]> = [
    [-156.45, 20.55],
    [-156.05, 20.8],
    [-155.6, 20.1],
    [-157.85, 21.35],
    [-159.5, 22.05],
  ];

  return stops.slice(0, fallbackCoordinates.length).map((stop, index) => ({
    coordinates: fallbackCoordinates[index],
    id: `${stop.id}-fallback-map-stop`,
    label: stop.title,
    order: index,
  }));
}

function projectTripMapPoints(points: TripPreviewMapPoint[]) {
  if (!points.length) {
    return [];
  }

  const longitudes = points.map((point) => point.coordinates[0]);
  const latitudes = points.map((point) => point.coordinates[1]);
  const minLongitude = Math.min(...longitudes);
  const maxLongitude = Math.max(...longitudes);
  const minLatitude = Math.min(...latitudes);
  const maxLatitude = Math.max(...latitudes);
  const longitudeRange = Math.max(0.01, maxLongitude - minLongitude);
  const latitudeRange = Math.max(0.01, maxLatitude - minLatitude);

  return points.map((point, index) => ({
    ...point,
    x: clamp(14 + ((point.coordinates[0] - minLongitude) / longitudeRange) * 72 + (points.length === 1 ? 22 : 0), 10, 90),
    y: clamp(86 - ((point.coordinates[1] - minLatitude) / latitudeRange) * 72 - (points.length === 1 ? 22 : 0), 10, 90),
    z: index,
  }));
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function formatTripDate(value?: string) {
  const date = parseLocalDate(value);

  if (!date) {
    return value ?? "";
  }

  return new Intl.DateTimeFormat("en-US", { day: "numeric", month: "short" }).format(date);
}

function parseLocalDate(value?: string) {
  if (!value) {
    return null;
  }

  const date = new Date(`${value}T12:00:00`);
  return Number.isNaN(date.getTime()) ? null : date;
}

function formatMediaCount(count: number, label: "photo" | "video") {
  return `${count} ${count === 1 ? label : `${label}s`}`;
}

async function createPreview(file: File) {
  if (isVideoFile(file)) {
    const url = URL.createObjectURL(file);
    return { posterUrl: await createVideoPosterUrl(url), previewReady: true, url };
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

function createVideoPosterUrl(videoUrl: string) {
  return new Promise<string | undefined>((resolve) => {
    const video = document.createElement("video");
    const canvas = document.createElement("canvas");
    const timeoutId = window.setTimeout(() => cleanup(), 5000);

    function cleanup(value?: string) {
      window.clearTimeout(timeoutId);
      video.removeAttribute("src");
      video.load();
      resolve(value);
    }

    video.muted = true;
    video.playsInline = true;
    video.preload = "metadata";
    video.onloadeddata = () => {
      try {
        video.currentTime = Math.min(0.1, Number.isFinite(video.duration) ? video.duration / 2 : 0.1);
      } catch {
        drawPoster();
      }
    };
    video.onseeked = drawPoster;
    video.onerror = () => cleanup();

    function drawPoster() {
      if (!video.videoWidth || !video.videoHeight) {
        cleanup();
        return;
      }

      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      canvas.getContext("2d")?.drawImage(video, 0, 0, canvas.width, canvas.height);
      canvas.toBlob((blob) => cleanup(blob ? URL.createObjectURL(blob) : undefined), "image/jpeg", 0.82);
    }

    video.src = videoUrl;
    video.load();
  });
}

function revokeTripMemoryUrls(memory: TripMemory) {
  URL.revokeObjectURL(memory.url);
  if (memory.posterUrl) {
    URL.revokeObjectURL(memory.posterUrl);
  }
}

async function readFileMetadata(file: File): Promise<MediaMetadata> {
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
      gps: true,
      exif: true,
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

async function reverseGeocodeCoordinates([longitude, latitude]: [number, number]) {
  const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;

  if (!token) {
    return undefined;
  }

  try {
    const [poiFeatures, localityFeatures, placeFeatures, regionFeatures, countryFeatures] = await Promise.all([
      fetchReverseGeocodeFeatures(longitude, latitude, "poi", 6, token),
      fetchReverseGeocodeFeatures(longitude, latitude, "locality", 3, token),
      fetchReverseGeocodeFeatures(longitude, latitude, "place", 3, token),
      fetchReverseGeocodeFeatures(longitude, latitude, "region", 3, token),
      fetchReverseGeocodeFeatures(longitude, latitude, "country", 1, token),
    ]);
    const lookups: Record<ReverseGeocodeLookupType, ReverseGeocodeFeature[]> = {
      country: countryFeatures,
      locality: localityFeatures,
      place: placeFeatures,
      poi: poiFeatures,
      region: regionFeatures,
    };
    const civicFeatures = [...localityFeatures, ...placeFeatures, ...regionFeatures, ...countryFeatures];
    const features = [...poiFeatures, ...civicFeatures];
    const selectedLocation = chooseStopLocationName(features, civicFeatures);

    return {
      features,
      lookups,
      query: [longitude, latitude] as [number, number],
      selectedLocation,
    };
  } catch {
    return undefined;
  }
}

async function fetchReverseGeocodeFeatures(longitude: number, latitude: number, types: string, limit: number, token: string) {
  const params = new URLSearchParams({
    access_token: token,
    language: "en",
    limit: String(limit),
    types,
  });
  const response = await fetch(`https://api.mapbox.com/geocoding/v5/mapbox.places/${longitude},${latitude}.json?${params}`);

  if (!response.ok) {
    return [];
  }

  const data = (await response.json()) as {
    features?: ReverseGeocodeFeature[];
  };

  return data.features ?? [];
}

function chooseStopLocationName(features: ReverseGeocodeFeature[], civicFeatures: ReverseGeocodeFeature[] = []) {
  const preferredFeature = features.find((feature) => {
    const text = `${feature.text ?? ""} ${feature.place_name ?? ""} ${feature.properties?.category ?? ""} ${feature.properties?.maki ?? ""}`;
    return preferredStopNamePattern.test(text);
  });
  const civicFeature = features.find((feature) => {
    const types = feature.place_type ?? [];
    return types.includes("locality") || types.includes("place") || types.includes("region") || types.includes("country");
  });
  const civicFallback = civicFeatures.find((item) => item.place_name || item.text);
  const feature = preferredFeature ?? civicFeature ?? civicFallback ?? features.find((item) => item.place_name || item.text);

  return feature?.place_name ?? feature?.text;
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
