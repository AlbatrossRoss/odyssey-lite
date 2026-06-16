"use client";

import { ArrowLeft, Bookmark, ExternalLink, MapPin, UsersRound } from "lucide-react";
import Link from "next/link";
import { notFound, useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { MapboxMap } from "@/components/MapboxMap";
import { MobileFrame } from "@/components/MobileFrame";
import { getExperience, getTrip, getUser, users } from "@/lib/data";
import { readSavedSlugs, writeSavedSlugs } from "@/lib/saveStore";

export default function ExperienceDetailPage() {
  const params = useParams<{ slug: string }>();
  const experience = getExperience(params.slug);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (experience) {
      setSaved(readSavedSlugs().includes(experience.slug));
    }
  }, [experience]);

  if (!experience) {
    notFound();
  }

  const detailExperience = experience;
  const friend = getUser(detailExperience.userId);
  const trip = getTrip(detailExperience.tripId);
  const also = users.filter((user) => detailExperience.alsoExperiencedBy.includes(user.id));

  function handleSave() {
    const current = readSavedSlugs();
    const next = current.includes(detailExperience.slug)
      ? current.filter((slug) => slug !== detailExperience.slug)
      : [...current, detailExperience.slug];
    writeSavedSlugs(next);
    setSaved(next.includes(detailExperience.slug));
  }

  return (
    <MobileFrame>
      <article className="h-full overflow-y-auto bg-shell pb-8">
        <div className="relative h-[390px]">
          <img alt={detailExperience.name} className="h-full w-full object-cover" src={detailExperience.imageUrl} />
          <div className="absolute inset-0 bg-gradient-to-b from-ink/32 via-transparent to-ink/72" />
          <Link
            aria-label="Back to Hawaii"
            className="safe-top-control absolute left-4 flex h-11 w-11 items-center justify-center rounded-full bg-ink/42 text-white shadow-lift backdrop-blur"
            href="/explore"
          >
            <ArrowLeft aria-hidden="true" size={20} />
          </Link>
          <div className="absolute bottom-6 left-5 right-5 text-white">
            <p className="mb-2 flex items-center gap-1 text-sm font-bold text-white/86">
              <MapPin aria-hidden="true" size={15} />
              {detailExperience.location}
            </p>
            <h1 className="text-4xl font-black leading-none">{detailExperience.name}</h1>
          </div>
        </div>
        <div className="-mt-5 space-y-4 rounded-t-[34px] bg-shell px-5 pb-8 pt-5">
          <section className="rounded-[28px] bg-white p-4 shadow-soft">
            <div className="mb-3 flex items-center gap-3">
              <img alt="" className="h-11 w-11 rounded-full object-cover" src={friend?.avatarUrl} />
              <div>
                <h2 className="text-base font-extrabold text-ink">{friend?.name} recommends this</h2>
                <p className="text-xs font-semibold text-ink/50">{friend?.handle} · saved from a real trip</p>
              </div>
            </div>
            <p className="text-[15px] leading-relaxed text-ink/72">{detailExperience.caption}</p>
            {detailExperience.highlight ? (
              <p className="mt-3 rounded-2xl bg-coral/12 px-3 py-2 text-sm font-bold text-coral">{detailExperience.highlight}</p>
            ) : null}
          </section>

          <section className="rounded-[28px] bg-white p-4 shadow-soft">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.18em] text-moss">Original trip</p>
                <h2 className="mt-1 text-lg font-extrabold text-ink">{trip?.title}</h2>
                <p className="text-sm font-semibold text-ink/52">{trip?.destination} · {trip?.date}</p>
              </div>
              <ExternalLink aria-hidden="true" className="text-coral" size={20} />
            </div>
          </section>

          <section className="rounded-[28px] bg-white p-4 shadow-soft">
            <h2 className="mb-3 flex items-center gap-2 text-lg font-extrabold text-ink">
              <UsersRound aria-hidden="true" size={19} />
              Also experienced by
            </h2>
            <div className="flex -space-x-3">
              {also.map((user) => (
                <img
                  alt={user.name}
                  className="h-12 w-12 rounded-full border-4 border-white object-cover"
                  key={user.id}
                  src={user.avatarUrl}
                />
              ))}
            </div>
          </section>

          <MapboxMap
            className="h-56 overflow-hidden rounded-[28px] shadow-soft"
            experiences={[detailExperience]}
            selectedSlug={detailExperience.slug}
            zoom={10.4}
          />

          <button
            className={`flex h-14 w-full items-center justify-center gap-2 rounded-full text-base font-extrabold shadow-lift ${
              saved ? "bg-ink text-white" : "bg-coral text-white"
            }`}
            onClick={handleSave}
            type="button"
          >
            <Bookmark aria-hidden="true" fill={saved ? "currentColor" : "none"} size={19} />
            {saved ? "Saved to Hawaii 2026" : "Save to Board"}
          </button>
        </div>
      </article>
    </MobileFrame>
  );
}
