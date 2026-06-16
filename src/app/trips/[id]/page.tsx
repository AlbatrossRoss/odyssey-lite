"use client";

import { useParams, useRouter } from "next/navigation";
import type { ReactNode } from "react";
import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, Calendar, Camera, Lightbulb, MapPin, Route, UserRound } from "lucide-react";
import { BottomNav } from "@/components/BottomNav";
import { MobileFrame } from "@/components/MobileFrame";
import { PostMediaPreview } from "@/components/PostMediaPreview";
import { fetchAppPostById, type AppPost } from "@/lib/posts";

export default function TripDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const [trip, setTrip] = useState<AppPost | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;

    fetchAppPostById(params.id)
      .then((post) => {
        if (active) {
          setTrip(post);
          setLoading(false);
        }
      })
      .catch(() => {
        if (active) {
          setLoading(false);
        }
      });

    return () => {
      active = false;
    };
  }, [params.id]);

  const media = useMemo(() => {
    if (!trip) {
      return [];
    }

    const urls = trip.mediaUrls.length ? trip.mediaUrls : trip.imageUrl ? [trip.imageUrl] : [];
    return urls.map((url, index) => ({
      type: trip.mediaTypes[index] ?? trip.mediaTypes[0] ?? "image",
      url,
    }));
  }, [trip]);

  if (loading) {
    return (
      <MobileFrame>
        <section className="flex h-full items-center justify-center bg-white text-sm font-bold text-ink/54">Loading trip...</section>
      </MobileFrame>
    );
  }

  if (!trip) {
    return (
      <MobileFrame>
        <section className="flex h-full flex-col items-center justify-center bg-white px-6 text-center">
          <h1 className="text-2xl font-black text-ink">Trip not found</h1>
          <button className="mt-4 rounded-full bg-ink px-5 py-3 text-sm font-black text-white" onClick={() => router.push("/explore")} type="button">
            Back to Explore
          </button>
        </section>
      </MobileFrame>
    );
  }

  const cover = media[0];
  const stopNames = trip.location.split(",").map((location) => location.trim()).filter(Boolean);
  const mediaCount = media.length || (trip.imageUrl ? 1 : 0);

  return (
    <MobileFrame>
      <section className="relative h-full overflow-hidden bg-[#fbfaf7] text-ink">
        <main className="app-scroll h-full overflow-y-auto pb-[calc(var(--nav-height)+var(--safe-area-bottom)+1.25rem)]">
          <section className="relative bg-ink">
            <button
              aria-label="Back"
              className="safe-top-bar absolute left-3 top-0 z-20 flex h-11 w-11 items-center justify-center rounded-full text-white"
              onClick={() => router.back()}
              type="button"
            >
              <ArrowLeft aria-hidden="true" size={22} />
            </button>
            <div className="relative aspect-[0.82] max-h-[520px] min-h-[390px] overflow-hidden bg-shell">
              {cover ? (
                <PostMediaPreview alt={trip.title} className="h-full w-full object-cover" mediaType={cover.type} src={cover.url} />
              ) : (
                <div className="flex h-full items-center justify-center bg-shell text-ink/38">
                  <Route aria-hidden="true" size={42} />
                </div>
              )}
              <div className="absolute inset-x-0 bottom-0 h-[58%] bg-gradient-to-t from-ink via-ink/68 to-transparent" />
              <div className="absolute inset-x-0 bottom-0 p-5 pb-6 text-white">
                <p className="text-sm font-bold text-white/76">@{trip.username}</p>
                <h1 className="mt-2 text-[34px] font-semibold leading-[0.98]">{trip.title}</h1>
                <p className="mt-3 flex items-center gap-2 text-sm font-bold text-white/86">
                  <Calendar aria-hidden="true" size={16} />
                  {trip.dateLabel}
                </p>
              </div>
            </div>
          </section>

          <section className="-mt-4 rounded-t-[24px] bg-[#fbfaf7] px-4 pb-8 pt-5">
            {trip.caption ? <p className="text-[15px] font-semibold leading-relaxed text-ink">{trip.caption}</p> : null}

            <div className="mt-5 grid grid-cols-2 gap-3">
              <TripInfoCard icon={<MapPin aria-hidden="true" size={17} />} label="Stops" value={`${stopNames.length || 1}`} />
              <TripInfoCard icon={<Camera aria-hidden="true" size={17} />} label="Memories" value={`${mediaCount}`} />
              <TripInfoCard icon={<Lightbulb aria-hidden="true" size={17} />} label="Shared as" value="Trip" />
              <TripInfoCard icon={<UserRound aria-hidden="true" size={17} />} label="By" value={`@${trip.username}`} />
            </div>

            {stopNames.length ? (
              <section className="mt-6 rounded-[12px] bg-white p-4 shadow-sm ring-1 ring-ink/5">
                <h2 className="text-base font-black text-ink">Stops</h2>
                <div className="mt-3 space-y-2">
                  {stopNames.map((stop, index) => (
                    <div className="flex items-center gap-3 rounded-[10px] bg-shell px-3 py-2.5" key={`${stop}-${index}`}>
                      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-moss text-xs font-black text-white">{index + 1}</span>
                      <span className="min-w-0 truncate text-sm font-bold text-ink">{stop}</span>
                    </div>
                  ))}
                </div>
              </section>
            ) : null}

            {media.length > 1 ? (
              <section className="mt-6">
                <h2 className="text-base font-black text-ink">Trip media</h2>
                <div className="mt-3 grid grid-cols-3 gap-2">
                  {media.map((item, index) => (
                    <div className="aspect-square overflow-hidden rounded-[10px] bg-shell" key={`${item.url}-${index}`}>
                      <PostMediaPreview alt="" className="h-full w-full object-cover" mediaType={item.type} src={item.url} />
                    </div>
                  ))}
                </div>
              </section>
            ) : null}
          </section>
        </main>
        <BottomNav activeTab="Explore" />
      </section>
    </MobileFrame>
  );
}

function TripInfoCard({ icon, label, value }: { icon: ReactNode; label: string; value: string }) {
  return (
    <div className="rounded-[12px] bg-white p-3 shadow-sm ring-1 ring-ink/5">
      <div className="text-moss">{icon}</div>
      <p className="mt-2 text-[11px] font-bold uppercase tracking-[0.08em] text-ink/42">{label}</p>
      <p className="mt-1 truncate text-sm font-black text-ink">{value}</p>
    </div>
  );
}
