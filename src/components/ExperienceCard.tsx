"use client";

import { Bookmark, MapPin } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import type { Experience } from "@/lib/data";
import { getTrip, getUser, users } from "@/lib/data";
import { readSavedSlugs, writeSavedSlugs } from "@/lib/saveStore";

type ExperienceCardProps = {
  experience: Experience;
  active?: boolean;
  onSelect?: (experience: Experience) => void;
};

export function ExperienceCard({ experience, active = false, onSelect }: ExperienceCardProps) {
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
      className={`relative h-[258px] w-[122px] shrink-0 overflow-hidden rounded-[18px] bg-ink shadow-soft ring-2 transition ${
        active ? "ring-coral" : "ring-transparent"
      }`}
      onMouseEnter={() => onSelect?.(experience)}
    >
      <Link aria-label={experience.name} href={`/experience/${experience.slug}`}>
        <img alt={experience.name} className="absolute inset-0 h-full w-full object-cover" src={experience.imageUrl} />
        <span className="absolute inset-0 bg-gradient-to-b from-ink/32 via-ink/10 to-ink/82" />
      </Link>
      <button
        aria-label={`Select ${experience.name}`}
        className="absolute inset-x-0 top-0 flex items-start gap-2 p-2.5 text-left text-white"
        onClick={() => onSelect?.(experience)}
        type="button"
      >
        <img alt="" className="h-8 w-8 rounded-full border border-white/30 object-cover" src={user?.avatarUrl} />
        <div className="min-w-0 flex-1 pt-0.5">
          <p className="truncate text-xs font-extrabold leading-tight">{user?.name}</p>
          <p className="truncate text-[10px] font-semibold text-white/72">{trip?.date ?? "Recent trip"}</p>
        </div>
        <span className="text-base font-black leading-none text-white/88">...</span>
      </button>

      <div className="absolute inset-x-0 bottom-0 p-2.5 text-white">
        <Link className="block" href={`/experience/${experience.slug}`}>
          <p className="mb-3 line-clamp-4 text-[13px] font-semibold italic leading-snug text-white drop-shadow">
            {experience.caption}
          </p>
          <p className="flex items-start gap-1 text-[10px] font-extrabold leading-tight">
            <MapPin aria-hidden="true" className="mt-0.5 shrink-0" size={12} />
            <span>
              {experience.name}
              <span className="block text-white/82">{experience.island}</span>
            </span>
          </p>
        </Link>
        <div className="mt-3 flex items-center justify-between">
          <div className="flex -space-x-2">
            {[user, ...also].filter(Boolean).map((person) => (
              <img
                alt=""
                className="h-6 w-6 rounded-full border-2 border-white object-cover"
                key={person!.id}
                src={person!.avatarUrl}
              />
            ))}
          </div>
          <button
            aria-label={saved ? "Saved to Board" : "Save"}
            className="flex h-9 w-9 items-center justify-center rounded-full bg-white text-ink shadow-lift transition hover:scale-105"
            onClick={handleSave}
            type="button"
          >
            <Bookmark aria-hidden="true" fill={saved ? "currentColor" : "none"} size={17} />
          </button>
        </div>
      </div>
    </article>
  );
}
