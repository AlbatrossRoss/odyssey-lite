"use client";

import {
  ArrowLeft,
  Calendar,
  Check,
  ChevronRight,
  Eye,
  ImagePlus,
  Lock,
  MapPin,
  MoreHorizontal,
  Play,
  Plus,
  Sparkles,
  Users,
  X,
} from "lucide-react";
import { type ReactNode, useEffect, useMemo, useRef, useState } from "react";
import { BottomNav } from "@/components/BottomNav";
import { MobileFrame } from "@/components/MobileFrame";
import { boards } from "@/lib/data";
import { addPublicExperience } from "@/lib/publicExperienceStore";

type Stop = {
  id: string;
  name: string;
  photoCount: number;
  note: string;
  imageUrl: string;
};

type HighlightTag = {
  id: string;
  label: string;
  stopId?: string;
};

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

const media = [
  "https://images.unsplash.com/photo-1559825481-12a05cc00344?auto=format&fit=crop&w=500&q=75",
  "https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=500&q=75",
  "https://images.unsplash.com/photo-1542259009477-d625272157b7?auto=format&fit=crop&w=500&q=75",
  "https://images.unsplash.com/photo-1500534314209-a25ddb2bd429?auto=format&fit=crop&w=500&q=75",
  "https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?auto=format&fit=crop&w=500&q=75",
  "https://images.unsplash.com/photo-1500375592092-40eb2168fd21?auto=format&fit=crop&w=500&q=75",
  "https://images.unsplash.com/photo-1518548419970-58e3b4079ab2?auto=format&fit=crop&w=500&q=75",
  "https://images.unsplash.com/photo-1501785888041-af3ef285b470?auto=format&fit=crop&w=500&q=75",
  "https://images.unsplash.com/photo-1503899036084-c55cdd92da26?auto=format&fit=crop&w=500&q=75",
];

const initialStops: Stop[] = [
  {
    id: "kona",
    name: "Kona",
    photoCount: 12,
    note: "Night dive, coffee stops, slow beach morning",
    imageUrl: media[0],
  },
  {
    id: "volcanoes",
    name: "Volcanoes National Park",
    photoCount: 18,
    note: "Crater drive and lava fields",
    imageUrl: media[5],
  },
  {
    id: "maui",
    name: "Maui",
    photoCount: 25,
    note: "Road to Hana, Haleakala, Wailea",
    imageUrl: media[3],
  },
];

const steps = ["Media", "Trip", "Organize", "Stops", "Highlights", "Preview", "Published"];
const visibilityOptions = [
  { label: "Friends", icon: Users },
  { label: "Private", icon: Lock },
  { label: "Public", icon: Eye },
];

export default function CreatePage() {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [step, setStep] = useState(0);
  const [postType, setPostType] = useState<"trip" | "experience">("trip");
  const [selectedMedia, setSelectedMedia] = useState([0, 1, 2, 3, 4, 5]);
  const [experienceMedia, setExperienceMedia] = useState<SelectedUpload[]>([]);
  const [isReadingMetadata, setIsReadingMetadata] = useState(false);
  const [tripName, setTripName] = useState("Hawaii 2026");
  const [experienceTitle, setExperienceTitle] = useState("");
  const [experienceLocation, setExperienceLocation] = useState("");
  const [experienceDate, setExperienceDate] = useState("");
  const [experienceCoordinates, setExperienceCoordinates] = useState<[number, number] | undefined>();
  const [metadataNote, setMetadataNote] = useState("Select media to check for date and location metadata.");
  const [tripDates, setTripDates] = useState("May 10 - May 24, 2026");
  const [visibility, setVisibility] = useState("Friends");
  const [associatedBoard, setAssociatedBoard] = useState("hawaii-2026");
  const [stops, setStops] = useState(initialStops);
  const [tags, setTags] = useState<HighlightTag[]>([
    { id: "favorite", label: "Favorite Experience", stopId: "kona" },
    { id: "hidden", label: "Hidden Gem" },
    { id: "photo", label: "Best Photo Spot", stopId: "maui" },
  ]);

  const visibleSteps = postType === "experience" ? ["Media", "Details", "Published"] : steps;
  const progress = useMemo(() => {
    if (postType === "experience") {
      return step === 0 ? 33 : step === 6 ? 100 : 66;
    }

    return ((step + 1) / steps.length) * 100;
  }, [postType, step]);
  const coverImage = media[selectedMedia[0] ?? 0];
  const selectedBoard = boards.find((board) => board.slug === associatedBoard);
  const firstExperienceMedia = experienceMedia[0];

  useEffect(() => {
    return () => {
      experienceMedia.forEach((item) => URL.revokeObjectURL(item.url));
    };
  }, [experienceMedia]);

  async function next() {
    if (postType === "experience") {
      if (step === 1) {
        await shareExperiencePost();
        setStep(6);
        return;
      }

      setStep(1);
      return;
    }

    setStep((current) => Math.min(current + 1, steps.length - 1));
  }

  function back() {
    if (postType === "experience" && step === 6) {
      setStep(1);
      return;
    }

    setStep((current) => Math.max(current - 1, 0));
  }

  function resetCreate() {
    setStep(0);
    setExperienceTitle("");
    setExperienceCoordinates(undefined);
  }

  function toggleMedia(index: number) {
    setSelectedMedia((current) =>
      current.includes(index) ? current.filter((item) => item !== index) : [...current, index],
    );
  }

  async function handleUpload(files: FileList | null) {
    const pickedFiles = Array.from(files ?? []).filter((file) => file.type.startsWith("image/") || file.type.startsWith("video/"));

    if (!pickedFiles.length) {
      return;
    }

    setIsReadingMetadata(true);
    const uploads: SelectedUpload[] = await Promise.all(
      pickedFiles.map(async (file, index) => ({
        file,
        id: `${file.name}-${file.lastModified}-${index}`,
        kind: (file.type.startsWith("video/") ? "video" : "image") as SelectedUpload["kind"],
        metadata: await readMediaMetadata(file),
        url: URL.createObjectURL(file),
      })),
    );

    experienceMedia.forEach((item) => URL.revokeObjectURL(item.url));
    setExperienceMedia(uploads);
    await applyBestMediaMetadata(uploads);
    setIsReadingMetadata(false);
  }

  async function applyBestMediaMetadata(uploads: SelectedUpload[]) {
    const upload = uploads.find((item) => item.metadata.coordinates || item.metadata.date) ?? uploads[0];

    if (!upload) {
      setExperienceLocation("");
      setExperienceDate("");
      setExperienceCoordinates(undefined);
      setMetadataNote("No media selected yet.");
      return;
    }

    const date = upload.metadata.date ?? fallbackDateFromFile(upload.file);
    const place = upload.metadata.coordinates ? await reverseGeocodeCoordinates(upload.metadata.coordinates) : undefined;
    const location = place ?? upload.metadata.location ?? "";

    setExperienceDate(date);
    setExperienceLocation(location);
    setExperienceCoordinates(upload.metadata.coordinates);

    const mediaPosition = uploads.indexOf(upload) + 1;
    const sourceLabel = mediaPosition === 1 ? "first selected file" : `selected file ${mediaPosition}`;

    if (upload.metadata.date && location) {
      setMetadataNote(`Using date and location metadata from your ${sourceLabel}.`);
    } else if (location) {
      setMetadataNote(`Using location metadata from your ${sourceLabel}. Date metadata was not available, so file date is shown.`);
    } else if (upload.metadata.date) {
      setMetadataNote(`Using date metadata from your ${sourceLabel}. Location metadata was not available.`);
    } else {
      setMetadataNote("No embedded location metadata was available in the selected files. File date is shown if your browser provided one.");
    }
  }

  async function shareExperiencePost() {
    if (visibility !== "Public" || !experienceMedia.length) {
      return;
    }

    const coordinates = experienceCoordinates ?? (experienceLocation ? await geocodePlace(experienceLocation) : undefined);

    if (!coordinates) {
      return;
    }

    const id = `public-${Date.now()}`;

    addPublicExperience({
      alsoExperiencedBy: [],
      caption: "Posted from Odyssey Lite.",
      coordinates,
      createdAt: new Date().toISOString(),
      highlight: "New public post",
      id,
      imageUrl: await fileToDataUrl(experienceMedia[0].file),
      island: experienceLocation || "Public post",
      location: experienceLocation || formatCoordinates(coordinates),
      name: experienceTitle.trim() || "New experience",
      slug: id,
      tripId: "public-post",
      userId: "maya",
      visibility: "Public",
    });
  }

  function renameStop(stopId: string) {
    const current = stops.find((stop) => stop.id === stopId);
    const nextName = window.prompt("Rename stop", current?.name);

    if (!nextName?.trim()) {
      return;
    }

    setStops((currentStops) =>
      currentStops.map((stop) => (stop.id === stopId ? { ...stop, name: nextName.trim() } : stop)),
    );
  }

  function deleteStop(stopId: string) {
    setStops((currentStops) => currentStops.filter((stop) => stop.id !== stopId));
    setTags((currentTags) => currentTags.map((tag) => (tag.stopId === stopId ? { ...tag, stopId: undefined } : tag)));
  }

  function addStop() {
    const name = window.prompt("New stop name", "New stop");

    if (!name?.trim()) {
      return;
    }

    setStops((currentStops) => [
      ...currentStops,
      {
        id: `stop-${Date.now()}`,
        name: name.trim(),
        photoCount: 0,
        note: "Add a quick note",
        imageUrl: media[1],
      },
    ]);
  }

  function assignTag(tagId: string, stopId: string) {
    setTags((currentTags) =>
      currentTags.map((tag) => (tag.id === tagId ? { ...tag, stopId: tag.stopId === stopId ? undefined : stopId } : tag)),
    );
  }

  const canContinue = postType === "experience" ? experienceMedia.length > 0 && (step !== 1 || experienceTitle.trim().length > 0) : selectedMedia.length > 0;
  const headerTitle = postType === "experience" ? visibleSteps[step === 6 ? 2 : step] : steps[step];

  return (
    <MobileFrame>
      <section className={`relative h-full pb-24 ${postType === "experience" ? "bg-white" : "bg-shell"}`}>
        <header className="bg-white px-5 pb-3 pt-6">
          <div className="mb-3 flex items-center justify-between border-b border-ink/8 pb-3">
            <button
              aria-label="Back"
              className="grid h-10 w-10 place-items-center rounded-full bg-white text-ink"
              onClick={step === 0 ? undefined : back}
              type="button"
            >
              <ArrowLeft aria-hidden="true" size={19} />
            </button>
            <div className="text-center">
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-coral">Create</p>
              <h1 className="text-lg font-black text-ink">{headerTitle}</h1>
            </div>
            {postType === "experience" && step === 1 ? (
              <button className="text-sm font-black text-[#4676d8]" disabled={!canContinue} onClick={next} type="button">
                Share
              </button>
            ) : (
              <button aria-label="More" className="grid h-10 w-10 place-items-center rounded-full bg-white text-ink" type="button">
                <MoreHorizontal aria-hidden="true" size={19} />
              </button>
            )}
          </div>
          {postType === "trip" ? (
            <div className="h-1.5 overflow-hidden rounded-full bg-shell">
              <div className="h-full rounded-full bg-ink transition-all" style={{ width: `${progress}%` }} />
            </div>
          ) : null}
        </header>

        <div className={`h-[calc(100%-94px)] overflow-y-auto pb-5 ${postType === "experience" ? "" : "px-5"}`}>
          {step === 0 ? (
            <section className={postType === "experience" ? "px-5" : ""}>
              <div className="mb-4 grid grid-cols-2 gap-2 rounded-[22px] bg-white p-1 shadow-soft">
                {[
                  ["trip", "Post a trip"],
                  ["experience", "Post an experience"],
                ].map(([value, label]) => (
                  <button
                    className={`rounded-[18px] px-3 py-3 text-sm font-black transition ${
                      postType === value ? "bg-ink text-white" : "text-ink/56"
                    }`}
                    key={value}
                    onClick={() => setPostType(value as "trip" | "experience")}
                    type="button"
                  >
                    {label}
                  </button>
                ))}
              </div>
              {postType === "experience" ? (
                <ExperienceMediaPicker
                  fileInputRef={fileInputRef}
                  isReadingMetadata={isReadingMetadata}
                  media={experienceMedia}
                  metadataNote={metadataNote}
                  onUpload={handleUpload}
                />
              ) : (
                <TripMediaPicker selectedMedia={selectedMedia} toggleMedia={toggleMedia} />
              )}
            </section>
          ) : null}

          {step === 1 && postType === "experience" ? (
            <ExperienceDetails
              date={experienceDate}
              location={experienceLocation}
              media={experienceMedia}
              metadataNote={metadataNote}
              onDateChange={setExperienceDate}
              onLocationChange={setExperienceLocation}
              onTitleChange={setExperienceTitle}
              onVisibilityChange={setVisibility}
              title={experienceTitle}
              visibility={visibility}
            />
          ) : null}

          {step === 1 && postType === "trip" ? (
            <section className="space-y-4">
              <div className="overflow-hidden rounded-[28px] bg-white shadow-soft">
                <img alt="" className="h-44 w-full object-cover" src={coverImage} />
                <div className="space-y-4 p-4">
                  <Field label="Trip name">
                    <input
                      className="w-full bg-transparent text-lg font-black text-ink outline-none"
                      onChange={(event) => setTripName(event.target.value)}
                      value={tripName}
                    />
                  </Field>
                  <Field label="Dates">
                    <div className="flex items-center gap-2">
                      <Calendar aria-hidden="true" className="text-coral" size={17} />
                      <input
                        className="w-full bg-transparent text-sm font-bold text-ink outline-none"
                        onChange={(event) => setTripDates(event.target.value)}
                        value={tripDates}
                      />
                    </div>
                  </Field>
                  <Field label="Visibility">
                    <VisibilityPicker onChange={setVisibility} value={visibility} />
                  </Field>
                  <Field label="Associated board">
                    <select
                      className="w-full rounded-2xl border border-ink/8 bg-shell px-3 py-3 text-sm font-bold text-ink outline-none"
                      onChange={(event) => setAssociatedBoard(event.target.value)}
                      value={associatedBoard}
                    >
                      <option value="">No board</option>
                      {boards.map((board) => (
                        <option key={board.slug} value={board.slug}>
                          {board.title}
                        </option>
                      ))}
                    </select>
                    {selectedBoard ? (
                      <p className="mt-2 text-xs font-semibold text-ink/50">
                        Prefilled from {selectedBoard.title}: destination context and saved places.
                      </p>
                    ) : null}
                  </Field>
                </div>
              </div>
            </section>
          ) : null}

          {step === 2 ? (
            <section className="space-y-4">
              <div className="rounded-[28px] bg-ink p-5 text-white shadow-soft">
                <Sparkles aria-hidden="true" className="mb-3 text-coral" size={24} />
                <h2 className="text-2xl font-black">We found {stops.length} stops</h2>
                <p className="mt-1 text-sm font-semibold text-white/68">
                  Odyssey grouped your media by time and location. Keep, rename, merge, or remove anything.
                </p>
              </div>
              {stops.map((stop) => (
                <StopRow key={stop.id} onDelete={() => deleteStop(stop.id)} onRename={() => renameStop(stop.id)} stop={stop} />
              ))}
              <button
                className="flex w-full items-center justify-center gap-2 rounded-full bg-white px-4 py-4 text-sm font-black text-ink shadow-lift"
                onClick={addStop}
                type="button"
              >
                <Plus aria-hidden="true" size={18} />
                Add stop
              </button>
            </section>
          ) : null}

          {step === 3 ? (
            <section className="space-y-3">
              <h2 className="text-2xl font-black text-ink">Review stops</h2>
              <p className="text-sm font-semibold leading-relaxed text-ink/54">
                Keep it light. Move or remove media only if Odyssey guessed wrong.
              </p>
              {stops.map((stop, index) => (
                <article className="overflow-hidden rounded-[26px] bg-white shadow-soft" key={stop.id}>
                  <div className="flex gap-3 p-3">
                    <img alt="" className="h-24 w-24 rounded-[20px] object-cover" src={stop.imageUrl} />
                    <div className="min-w-0 flex-1 py-1">
                      <p className="text-xs font-black uppercase tracking-[0.14em] text-coral">Stop {index + 1}</p>
                      <h3 className="text-lg font-black text-ink">{stop.name}</h3>
                      <p className="mt-1 text-sm font-bold text-ink/54">{stop.photoCount} photos</p>
                    </div>
                  </div>
                  <textarea
                    className="mx-3 mb-3 min-h-16 w-[calc(100%-24px)] resize-none rounded-[18px] bg-shell px-3 py-2 text-sm font-semibold text-ink outline-none"
                    onChange={(event) =>
                      setStops((currentStops) =>
                        currentStops.map((item) => (item.id === stop.id ? { ...item, note: event.target.value } : item)),
                      )
                    }
                    value={stop.note}
                  />
                </article>
              ))}
            </section>
          ) : null}

          {step === 4 ? (
            <section className="space-y-4">
              <h2 className="text-2xl font-black text-ink">Add highlights</h2>
              <p className="text-sm font-semibold leading-relaxed text-ink/54">
                Tap a tag, then tap a stop. Each highlight can only be used once per trip.
              </p>
              <div className="grid gap-2">
                {tags.map((tag) => {
                  const assignedStop = stops.find((stop) => stop.id === tag.stopId);

                  return (
                    <article className="rounded-[24px] bg-white p-3 shadow-soft" key={tag.id}>
                      <p className="text-sm font-black text-ink">{tag.label}</p>
                      <p className="mt-1 text-xs font-semibold text-ink/48">
                        {assignedStop ? `Assigned to ${assignedStop.name}` : "Choose one stop"}
                      </p>
                      <div className="mt-3 flex gap-2 overflow-x-auto">
                        {stops.map((stop) => (
                          <button
                            className={`shrink-0 rounded-full px-3 py-2 text-xs font-black ${
                              tag.stopId === stop.id ? "bg-ink text-white" : "bg-shell text-ink/62"
                            }`}
                            key={stop.id}
                            onClick={() => assignTag(tag.id, stop.id)}
                            type="button"
                          >
                            {stop.name}
                          </button>
                        ))}
                      </div>
                    </article>
                  );
                })}
              </div>
            </section>
          ) : null}

          {step === 5 ? (
            <section className="space-y-4">
              <article className="overflow-hidden rounded-[30px] bg-white shadow-soft">
                <img alt="" className="h-56 w-full object-cover" src={coverImage} />
                <div className="p-4">
                  <p className="text-xs font-black uppercase tracking-[0.16em] text-coral">Publish preview</p>
                  <h2 className="mt-1 text-3xl font-black text-ink">{tripName}</h2>
                  <p className="mt-1 text-sm font-bold text-ink/54">{tripDates}</p>
                  <div className="mt-4 space-y-2">
                    {stops.map((stop) => (
                      <div className="flex items-center justify-between rounded-2xl bg-shell px-3 py-2" key={stop.id}>
                        <span className="text-sm font-black text-ink">{stop.name}</span>
                        <span className="text-xs font-bold text-ink/50">{stop.photoCount} photos</span>
                      </div>
                    ))}
                  </div>
                  <div className="mt-4 flex flex-wrap gap-2">
                    {tags
                      .filter((tag) => tag.stopId)
                      .map((tag) => (
                        <span className="rounded-full bg-coral/12 px-3 py-2 text-xs font-black text-coral" key={tag.id}>
                          {tag.label}
                        </span>
                      ))}
                  </div>
                </div>
              </article>
            </section>
          ) : null}

          {step === 6 ? (
            <PublishedScreen
              date={postType === "experience" ? experienceDate : tripDates}
              imageUrl={postType === "experience" ? firstExperienceMedia?.url : coverImage}
              isExperience={postType === "experience"}
              location={postType === "experience" ? experienceLocation : "Hawaii"}
              mediaCount={postType === "experience" ? experienceMedia.length : selectedMedia.length}
              stopCount={stops.length}
              title={postType === "experience" ? experienceTitle : tripName}
            />
          ) : null}
        </div>

        {step < 6 ? (
          <footer className="absolute inset-x-0 bottom-[86px] z-50 px-5">
            <div className="flex gap-3 rounded-full bg-white/94 p-2 shadow-soft backdrop-blur-xl">
              <button
                aria-label="Cancel post"
                className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-shell text-ink"
                onClick={resetCreate}
                type="button"
              >
                <X aria-hidden="true" size={18} />
              </button>
              <button
                aria-label={postType === "experience" && step === 1 ? "Share experience" : step === 5 ? "Publish Trip" : "Next step"}
                className="flex h-12 flex-1 items-center justify-center gap-2 rounded-full bg-ink text-sm font-black text-white disabled:cursor-not-allowed disabled:bg-ink/35"
                disabled={!canContinue}
                onClick={next}
                type="button"
              >
                {postType === "experience" && step === 1 ? "Share" : step === 5 ? "Publish Trip" : "Next"}
                <ChevronRight aria-hidden="true" size={18} />
              </button>
            </div>
          </footer>
        ) : (
          <footer className="absolute inset-x-0 bottom-[86px] z-50 px-5">
            <button
              className="flex h-14 w-full items-center justify-center gap-2 rounded-full bg-ink text-sm font-black text-white shadow-soft"
              onClick={resetCreate}
              type="button"
            >
              <Eye aria-hidden="true" size={18} />
              Create another post
            </button>
          </footer>
        )}

        <BottomNav activeTab="Create" />
      </section>
    </MobileFrame>
  );
}

function TripMediaPicker({
  selectedMedia,
  toggleMedia,
}: {
  selectedMedia: number[];
  toggleMedia: (index: number) => void;
}) {
  return (
    <>
      <div className="mb-4 flex items-end justify-between">
        <div>
          <h2 className="text-2xl font-black text-ink">Select media</h2>
          <p className="text-sm font-semibold text-ink/54">{selectedMedia.length} selected</p>
        </div>
        <button className="flex items-center gap-1 rounded-full bg-white px-3 py-2 text-xs font-black text-ink shadow-lift" type="button">
          <ImagePlus aria-hidden="true" size={15} />
          Camera roll
        </button>
      </div>
      <div className="grid grid-cols-3 gap-2">
        {media.map((image, index) => {
          const selected = selectedMedia.includes(index);

          return (
            <button
              className="relative aspect-square overflow-hidden rounded-[18px] bg-ink"
              key={image}
              onClick={() => toggleMedia(index)}
              type="button"
            >
              <img alt="" className="h-full w-full object-cover" src={image} />
              <span className={`absolute inset-0 ${selected ? "bg-ink/18 ring-4 ring-inset ring-white" : ""}`} />
              {selected ? (
                <span className="absolute right-2 top-2 grid h-6 w-6 place-items-center rounded-full bg-ink text-xs font-black text-white">
                  {selectedMedia.indexOf(index) + 1}
                </span>
              ) : null}
            </button>
          );
        })}
      </div>
    </>
  );
}

function ExperienceMediaPicker({
  fileInputRef,
  isReadingMetadata,
  media,
  metadataNote,
  onUpload,
}: {
  fileInputRef: React.RefObject<HTMLInputElement | null>;
  isReadingMetadata: boolean;
  media: SelectedUpload[];
  metadataNote: string;
  onUpload: (files: FileList | null) => void;
}) {
  return (
    <section className="space-y-4">
      <input
        accept="image/*,video/*"
        className="hidden"
        multiple
        onChange={(event) => onUpload(event.target.files)}
        ref={fileInputRef}
        type="file"
      />
      <button
        className="flex aspect-square w-full flex-col items-center justify-center rounded-[6px] border border-dashed border-ink/18 bg-shell px-5 text-center"
        onClick={() => fileInputRef.current?.click()}
        type="button"
      >
        <span className="grid h-16 w-16 place-items-center rounded-full bg-white text-ink shadow-lift">
          <ImagePlus aria-hidden="true" size={28} />
        </span>
        <h2 className="mt-5 text-xl font-black text-ink">Choose from camera roll</h2>
        <p className="mt-2 max-w-64 text-sm font-semibold leading-relaxed text-ink/50">
          Select one photo or video, or choose a small set for a carousel-style experience post.
        </p>
      </button>
      {media.length ? (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-sm font-black text-ink">{media.length} selected</p>
            <button
              className="rounded-full bg-shell px-3 py-2 text-xs font-black text-ink"
              onClick={() => fileInputRef.current?.click()}
              type="button"
            >
              Change
            </button>
          </div>
          <div className="grid grid-cols-3 gap-2">
            {media.map((item, index) => (
              <div className="relative aspect-square overflow-hidden rounded-[18px] bg-ink" key={item.id}>
                <MediaPreview className="h-full w-full object-cover" item={item} />
                {item.kind === "video" ? (
                  <span className="absolute left-2 top-2 grid h-7 w-7 place-items-center rounded-full bg-black/45 text-white">
                    <Play aria-hidden="true" fill="currentColor" size={13} />
                  </span>
                ) : null}
                <span className="absolute right-2 top-2 grid h-6 w-6 place-items-center rounded-full bg-white text-xs font-black text-ink">
                  {index + 1}
                </span>
              </div>
            ))}
          </div>
          <p className="border-t border-ink/8 px-1 pt-3 text-xs font-semibold leading-relaxed text-ink/52">
            {isReadingMetadata ? "Reading metadata..." : metadataNote}
          </p>
        </div>
      ) : null}
    </section>
  );
}

function ExperienceDetails({
  date,
  location,
  media,
  metadataNote,
  onDateChange,
  onLocationChange,
  onTitleChange,
  onVisibilityChange,
  title,
  visibility,
}: {
  date: string;
  location: string;
  media: SelectedUpload[];
  metadataNote: string;
  onDateChange: (value: string) => void;
  onLocationChange: (value: string) => void;
  onTitleChange: (value: string) => void;
  onVisibilityChange: (value: string) => void;
  title: string;
  visibility: string;
}) {
  const firstMedia = media[0];

  return (
    <section className="space-y-0">
      <article className="bg-white">
        <div className="relative aspect-square bg-ink">
          {firstMedia ? <MediaPreview className="h-full w-full object-cover" item={firstMedia} /> : null}
          {media.length > 1 ? (
            <span className="absolute right-3 top-3 rounded-full bg-black/45 px-3 py-1.5 text-xs font-black text-white">
              1/{media.length}
            </span>
          ) : null}
        </div>
        {media.length > 1 ? (
          <div className="no-scrollbar flex gap-2 overflow-x-auto border-b border-ink/8 px-4 py-3">
            {media.map((item) => (
              <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-[6px] bg-ink" key={item.id}>
                <MediaPreview className="h-full w-full object-cover" item={item} />
              </div>
            ))}
          </div>
        ) : null}
      </article>

      <section className="bg-white">
        <PlainField label="Experience title">
          <input
            autoFocus
            className="w-full bg-transparent text-base font-semibold text-ink outline-none placeholder:text-ink/28"
            onChange={(event) => onTitleChange(event.target.value)}
            placeholder="Add a title"
            value={title}
          />
        </PlainField>
        <div>
          <PlainField label="Location">
            <div className="flex items-center gap-2">
              <MapPin aria-hidden="true" className="text-coral" size={17} />
              <input
                className="w-full bg-transparent text-sm font-bold text-ink outline-none placeholder:text-ink/28"
                onChange={(event) => onLocationChange(event.target.value)}
                placeholder="No location metadata available"
                value={location}
              />
            </div>
          </PlainField>
          <PlainField label="Date">
            <div className="flex items-center gap-2">
              <Calendar aria-hidden="true" className="text-coral" size={17} />
              <input
                className="w-full bg-transparent text-sm font-bold text-ink outline-none"
                onChange={(event) => onDateChange(event.target.value)}
                type="date"
                value={date}
              />
            </div>
          </PlainField>
          <PlainField label="Visibility">
            <VisibilityPicker onChange={onVisibilityChange} value={visibility} />
          </PlainField>
        </div>
        <p className="px-5 py-3 text-xs font-semibold leading-relaxed text-ink/48">{metadataNote}</p>
      </section>
    </section>
  );
}

function PublishedScreen({
  date,
  imageUrl,
  isExperience,
  location,
  mediaCount,
  stopCount,
  title,
}: {
  date: string;
  imageUrl?: string;
  isExperience: boolean;
  location: string;
  mediaCount: number;
  stopCount: number;
  title: string;
}) {
  return (
    <section className="space-y-4">
      <div className="rounded-[30px] bg-ink p-5 text-white shadow-soft">
        <div className="mb-4 grid h-12 w-12 place-items-center rounded-full bg-white text-ink">
          <Check aria-hidden="true" size={24} />
        </div>
        <p className="text-xs font-black uppercase tracking-[0.18em] text-coral">Published</p>
        <h2 className="mt-1 text-3xl font-black">{title || (isExperience ? "New experience" : "New trip")}</h2>
        <p className="mt-2 text-sm font-semibold leading-relaxed text-white/70">
          {isExperience
            ? "Your experience is ready for the prototype feed once posting is connected to storage."
            : "Your trip is now visible in Odyssey and can contribute experiences to destination discovery."}
        </p>
      </div>
      <article className="overflow-hidden rounded-[28px] bg-white shadow-soft">
        {imageUrl ? <img alt="" className="h-44 w-full object-cover" src={imageUrl} /> : null}
        <div className="p-4">
          <div className="mb-3 flex items-center gap-2 text-sm font-bold text-moss">
            <MapPin aria-hidden="true" size={16} />
            {location || "Location unavailable"}
          </div>
          <h3 className="text-2xl font-black text-ink">{title || (isExperience ? "New experience" : "New trip")}</h3>
          <p className="mt-1 text-sm font-semibold text-ink/54">
            {isExperience ? `${mediaCount} media${date ? ` · ${date}` : ""}` : `${stopCount} stops · ${mediaCount} media`}
          </p>
        </div>
      </article>
    </section>
  );
}

function Field({ children, label }: { children: ReactNode; label: string }) {
  return (
    <label className="block rounded-[20px] bg-shell p-3">
      <span className="mb-2 block text-xs font-black uppercase tracking-[0.12em] text-ink/46">{label}</span>
      {children}
    </label>
  );
}

function PlainField({ children, label }: { children: ReactNode; label: string }) {
  return (
    <label className="block border-b border-ink/8 px-5 py-4">
      <span className="mb-2 block text-[11px] font-black uppercase tracking-[0.12em] text-ink/38">{label}</span>
      {children}
    </label>
  );
}

function VisibilityPicker({ onChange, value }: { onChange: (value: string) => void; value: string }) {
  return (
    <div className="grid grid-cols-3 gap-2">
      {visibilityOptions.map((item) => {
        const Icon = item.icon;

        return (
          <button
            className={`flex items-center justify-center gap-1.5 rounded-full px-3 py-2 text-xs font-black ${
              value === item.label ? "bg-ink text-white" : "bg-white text-ink/62 ring-1 ring-ink/8"
            }`}
            key={item.label}
            onClick={() => onChange(item.label)}
            type="button"
          >
            <Icon aria-hidden="true" size={14} />
            {item.label}
          </button>
        );
      })}
    </div>
  );
}

function MediaPreview({ className, item }: { className: string; item: SelectedUpload }) {
  if (item.kind === "video") {
    return <video className={className} controls muted playsInline src={item.url} />;
  }

  return <img alt="" className={className} src={item.url} />;
}

function StopRow({ onDelete, onRename, stop }: { onDelete: () => void; onRename: () => void; stop: Stop }) {
  return (
    <article className="flex items-center gap-3 rounded-[24px] bg-white p-3 shadow-soft">
      <img alt="" className="h-16 w-16 rounded-[18px] object-cover" src={stop.imageUrl} />
      <div className="min-w-0 flex-1">
        <h3 className="truncate text-base font-black text-ink">{stop.name}</h3>
        <p className="text-sm font-bold text-ink/54">{stop.photoCount} photos</p>
      </div>
      <div className="flex gap-1">
        <button className="rounded-full bg-shell px-3 py-2 text-xs font-black text-ink" onClick={onRename} type="button">
          Rename
        </button>
        <button className="grid h-9 w-9 place-items-center rounded-full bg-coral/12 text-coral" onClick={onDelete} type="button">
          <X aria-hidden="true" size={16} />
        </button>
      </div>
    </article>
  );
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
