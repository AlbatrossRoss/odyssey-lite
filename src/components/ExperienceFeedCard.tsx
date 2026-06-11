"use client";

import { Bookmark, MapPin } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import type { Experience } from "@/lib/data";
import { getTrip, getUser, users } from "@/lib/data";
import { readSavedSlugs, writeSavedSlugs } from "@/lib/saveStore";

type ExperienceFeedCardProps = {
  experience: Experience;
  active?: boolean;
  onSelect?: (experience: Experience) => void;
};

export function ExperienceFeedCard({ experience, active = false, onSelect }: ExperienceFeedCardProps) {
  const user = getUser(experience.userId);
  const trip = getTrip(experience.tripId);
  const also = users.filter((item) => experience.alsoExperiencedBy.includes(item.id)).slice(0, 3);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    setSaved(readSavedSlugs().includes(experience.slug));
  }, [experience.slug]);

  function handleSave() {
    const current = readSavedSlugs();
    const next = current.includes(experience.slug)
      ? current.filter((slug) => slug !== experience.slug)
      : [...current, experience.slug];
    writeSavedSlugs(next);
    setSaved(next.includes(experience.slug));
  }

  return (
    <article
      className={`overflow-hidden rounded-[28px] bg-white shadow-soft ring-2 transition ${
        active ? "ring-coral" : "ring-transparent"
      }`}
      onMouseEnter={() => onSelect?.(experience)}
    >
      <button className="flex w-full items-center gap-3 p-3 text-left" onClick={() => onSelect?.(experience)} type="button">
        <img alt="" className="h-11 w-11 rounded-full object-cover" src={user?.avatarUrl} />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-extrabold text-ink">{user?.name}</p>
          <p className="truncate text-xs font-semibold text-ink/50">{trip?.date ?? "Recent trip"} · {experience.island}</p>
        </div>
        <span className="text-xl font-black leading-none text-ink/38">...</span>
      </button>
      <Link className="relative block aspect-[9/13] bg-ink" href={`/experience/${experience.slug}`}>
        <img alt={experience.name} className="absolute inset-0 h-full w-full object-cover" src={experience.imageUrl} />
        <span className="absolute inset-0 bg-gradient-to-b from-transparent via-ink/5 to-ink/68" />
        <span className="absolute bottom-4 left-4 right-4 text-white">
          <span className="block text-lg font-semibold italic leading-snug drop-shadow">{experience.caption}</span>
          <span className="mt-4 flex items-start gap-1.5 text-sm font-extrabold leading-tight">
            <MapPin aria-hidden="true" className="mt-0.5 shrink-0" size={16} />
            <span>
              {experience.name}
              <span className="block text-white/82">{experience.location}</span>
            </span>
          </span>
        </span>
      </Link>
      <div className="flex items-center justify-between p-3">
        <div className="flex -space-x-2">
          {[user, ...also].filter(Boolean).map((person) => (
            <img
              alt=""
              className="h-8 w-8 rounded-full border-2 border-white object-cover"
              key={person!.id}
              src={person!.avatarUrl}
            />
          ))}
        </div>
        <button
          aria-label={saved ? "Saved to Board" : "Save"}
          className={`flex h-11 w-11 items-center justify-center rounded-full shadow-lift ${
            saved ? "bg-ink text-white" : "bg-shell text-ink"
          }`}
          onClick={handleSave}
          type="button"
        >
          <Bookmark aria-hidden="true" fill={saved ? "currentColor" : "none"} size={19} />
        </button>
      </div>
    </article>
  );
}
