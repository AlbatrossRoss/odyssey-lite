"use client";

import {
  ArrowLeft,
  Calendar,
  Check,
  ChevronRight,
  Eye,
  ImagePlus,
  MapPin,
  MoreHorizontal,
  Plus,
  Sparkles,
  X,
} from "lucide-react";
import { useMemo, useState } from "react";
import { BottomNav } from "@/components/BottomNav";
import { MobileFrame } from "@/components/MobileFrame";
import { boards } from "@/lib/data";

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
    note: "Road to Hana, Haleakalā, Wailea",
    imageUrl: media[3],
  },
];

const steps = ["Media", "Trip", "Organize", "Stops", "Highlights", "Preview", "Published"];

export default function CreatePage() {
  const [step, setStep] = useState(0);
  const [postType, setPostType] = useState<"trip" | "experience">("trip");
  const [selectedMedia, setSelectedMedia] = useState([0, 1, 2, 3, 4, 5]);
  const [tripName, setTripName] = useState("Hawaii 2026");
  const [tripDates, setTripDates] = useState("May 10 - May 24, 2026");
  const [visibility, setVisibility] = useState("Friends");
  const [associatedBoard, setAssociatedBoard] = useState("hawaii-2026");
  const [stops, setStops] = useState(initialStops);
  const [tags, setTags] = useState<HighlightTag[]>([
    { id: "favorite", label: "Favorite Experience", stopId: "kona" },
    { id: "hidden", label: "Hidden Gem" },
    { id: "photo", label: "Best Photo Spot", stopId: "maui" },
  ]);

  const progress = useMemo(() => ((step + 1) / steps.length) * 100, [step]);
  const coverImage = media[selectedMedia[0] ?? 0];
  const selectedBoard = boards.find((board) => board.slug === associatedBoard);

  function next() {
    setStep((current) => Math.min(current + 1, steps.length - 1));
  }

  function back() {
    setStep((current) => Math.max(current - 1, 0));
  }

  function toggleMedia(index: number) {
    setSelectedMedia((current) =>
      current.includes(index) ? current.filter((item) => item !== index) : [...current, index],
    );
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

  return (
    <MobileFrame>
      <section className="relative h-full bg-shell pb-24">
        <header className="px-5 pb-3 pt-6">
          <div className="mb-4 flex items-center justify-between">
            <button
              aria-label="Back"
              className="grid h-10 w-10 place-items-center rounded-full bg-white text-ink shadow-lift"
              onClick={step === 0 ? undefined : back}
              type="button"
            >
              <ArrowLeft aria-hidden="true" size={19} />
            </button>
            <div className="text-center">
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-coral">Create</p>
              <h1 className="text-lg font-black text-ink">{steps[step]}</h1>
            </div>
            <button
              aria-label="More"
              className="grid h-10 w-10 place-items-center rounded-full bg-white text-ink shadow-lift"
              type="button"
            >
              <MoreHorizontal aria-hidden="true" size={19} />
            </button>
          </div>
          <div className="h-1.5 overflow-hidden rounded-full bg-white">
            <div className="h-full rounded-full bg-ink transition-all" style={{ width: `${progress}%` }} />
          </div>
        </header>

        <div className="h-[calc(100%-94px)] overflow-y-auto px-5 pb-5">
          {step === 0 ? (
            <section>
              <div className="mb-4 grid grid-cols-2 gap-2 rounded-[22px] bg-white p-1 shadow-soft">
                {[
                  ["trip", "Post a trip"],
                  ["experience", "Post one experience"],
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
              <div className="mb-4 flex items-end justify-between">
                <div>
                  <h2 className="text-2xl font-black text-ink">Select media</h2>
                  <p className="text-sm font-semibold text-ink/54">{selectedMedia.length} selected</p>
                </div>
                <button
                  className="flex items-center gap-1 rounded-full bg-white px-3 py-2 text-xs font-black text-ink shadow-lift"
                  type="button"
                >
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
            </section>
          ) : null}

          {step === 1 ? (
            <section className="space-y-4">
              <div className="overflow-hidden rounded-[28px] bg-white shadow-soft">
                <img alt="" className="h-44 w-full object-cover" src={coverImage} />
                <div className="space-y-4 p-4">
                  <Field label={postType === "trip" ? "Trip name" : "Experience name"}>
                    <input
                      className="w-full bg-transparent text-lg font-black text-ink outline-none"
                      onChange={(event) => setTripName(event.target.value)}
                      value={postType === "trip" ? tripName : "Manta Ray Night Dive"}
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
                    <div className="flex gap-2">
                      {["Friends", "Private", "Public"].map((item) => (
                        <button
                          className={`rounded-full px-3 py-2 text-xs font-black ${
                            visibility === item ? "bg-ink text-white" : "bg-shell text-ink/62"
                          }`}
                          key={item}
                          onClick={() => setVisibility(item)}
                          type="button"
                        >
                          {item}
                        </button>
                      ))}
                    </div>
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
                  <h2 className="mt-1 text-3xl font-black text-ink">{postType === "trip" ? tripName : "Manta Ray Night Dive"}</h2>
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
            <section className="space-y-4">
              <div className="rounded-[30px] bg-ink p-5 text-white shadow-soft">
                <div className="mb-4 grid h-12 w-12 place-items-center rounded-full bg-white text-ink">
                  <Check aria-hidden="true" size={24} />
                </div>
                <p className="text-xs font-black uppercase tracking-[0.18em] text-coral">Published</p>
                <h2 className="mt-1 text-3xl font-black">{postType === "trip" ? tripName : "Manta Ray Night Dive"}</h2>
                <p className="mt-2 text-sm font-semibold leading-relaxed text-white/70">
                  Your trip is now visible in Odyssey and can contribute experiences to destination discovery.
                </p>
              </div>
              <article className="overflow-hidden rounded-[28px] bg-white shadow-soft">
                <img alt="" className="h-44 w-full object-cover" src={coverImage} />
                <div className="p-4">
                  <div className="mb-3 flex items-center gap-2 text-sm font-bold text-moss">
                    <MapPin aria-hidden="true" size={16} />
                    Hawaii
                  </div>
                  <h3 className="text-2xl font-black text-ink">{postType === "trip" ? tripName : "Manta Ray Night Dive"}</h3>
                  <p className="mt-1 text-sm font-semibold text-ink/54">{stops.length} stops · {selectedMedia.length} media</p>
                </div>
              </article>
            </section>
          ) : null}
        </div>

        {step < 6 ? (
          <footer className="absolute inset-x-0 bottom-[86px] z-50 px-5">
            <div className="flex gap-3 rounded-full bg-white/94 p-2 shadow-soft backdrop-blur-xl">
              <button
                aria-label="Cancel post"
                className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-shell text-ink"
                onClick={() => setStep(0)}
                type="button"
              >
                <X aria-hidden="true" size={18} />
              </button>
              <button
                aria-label={step === 5 ? "Publish Trip" : "Next step"}
                className="flex h-12 flex-1 items-center justify-center gap-2 rounded-full bg-ink text-sm font-black text-white"
                disabled={step === 0 && !selectedMedia.length}
                onClick={next}
                type="button"
              >
                {step === 5 ? "Publish Trip" : "Next"}
                <ChevronRight aria-hidden="true" size={18} />
              </button>
            </div>
          </footer>
        ) : (
          <footer className="absolute inset-x-0 bottom-[86px] z-50 px-5">
            <button
              className="flex h-14 w-full items-center justify-center gap-2 rounded-full bg-ink text-sm font-black text-white shadow-soft"
              onClick={() => setStep(0)}
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

function Field({ children, label }: { children: React.ReactNode; label: string }) {
  return (
    <label className="block rounded-[20px] bg-shell p-3">
      <span className="mb-2 block text-xs font-black uppercase tracking-[0.12em] text-ink/46">{label}</span>
      {children}
    </label>
  );
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
