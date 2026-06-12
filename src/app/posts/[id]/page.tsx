"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, Calendar, MapPin, UserRound } from "lucide-react";
import { MapboxMap } from "@/components/MapboxMap";
import { MobileFrame } from "@/components/MobileFrame";
import { fetchAppPostById, type AppPost } from "@/lib/posts";
import type { Experience } from "@/lib/data";

export default function PostDetailPage() {
  const params = useParams<{ id: string }>();
  const [post, setPost] = useState<AppPost | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;

    fetchAppPostById(params.id)
      .then((nextPost) => {
        if (active) {
          setPost(nextPost);
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

  const mapExperience = useMemo<Experience | null>(() => {
    if (!post) {
      return null;
    }

    return {
      alsoExperiencedBy: [],
      caption: post.caption,
      coordinates: post.coordinates,
      id: post.id,
      imageUrl: post.imageUrl,
      island: post.location,
      location: post.location,
      name: post.title,
      slug: post.id,
      tripId: post.id,
      userId: post.accountId,
    };
  }, [post]);

  if (loading) {
    return (
      <MobileFrame>
        <main className="grid h-full place-items-center bg-shell px-8 text-center">
          <p className="text-sm font-black text-ink/52">Loading post...</p>
        </main>
      </MobileFrame>
    );
  }

  if (!post || !mapExperience) {
    return (
      <MobileFrame>
        <main className="grid h-full place-items-center bg-shell px-8 text-center">
          <div>
            <UserRound aria-hidden="true" className="mx-auto text-ink/38" size={42} />
            <h1 className="mt-3 text-2xl font-black text-ink">Post not found</h1>
            <Link className="mt-5 inline-flex rounded-full bg-ink px-5 py-3 text-sm font-black text-white" href="/destination/hawaii">
              Back to Explore
            </Link>
          </div>
        </main>
      </MobileFrame>
    );
  }

  return (
    <MobileFrame>
      <article className="h-full overflow-y-auto bg-shell pb-8">
        <div className="relative h-[430px] bg-ink">
          <img alt={post.title} className="h-full w-full object-cover" src={post.imageUrl} />
          <div className="absolute inset-0 bg-gradient-to-b from-ink/34 via-transparent to-ink/74" />
          <Link
            aria-label="Back to Explore"
            className="absolute left-4 top-5 flex h-11 w-11 items-center justify-center rounded-full bg-white/88 text-ink shadow-lift backdrop-blur"
            href="/destination/hawaii"
          >
            <ArrowLeft aria-hidden="true" size={20} />
          </Link>
          <div className="absolute bottom-6 left-5 right-5 text-white">
            <Link className="mb-4 flex items-center gap-3" href={`/accounts/${post.username}`}>
              <span className="flex h-12 w-12 items-center justify-center overflow-hidden rounded-full border-2 border-white bg-shell text-ink shadow-lift">
                {post.profilePhotoUrl ? (
                  <img alt="" className="h-full w-full object-cover" src={post.profilePhotoUrl} />
                ) : (
                  <UserRound aria-hidden="true" size={22} />
                )}
              </span>
              <span>
                <span className="block text-sm font-black">@{post.username}</span>
                <span className="block text-xs font-semibold capitalize text-white/72">{post.type}</span>
              </span>
            </Link>
            <h1 className="text-4xl font-black leading-none">{post.title}</h1>
          </div>
        </div>

        <div className="-mt-5 space-y-4 rounded-t-[34px] bg-shell px-5 pb-8 pt-5">
          <section className="rounded-[28px] bg-white p-4 shadow-soft">
            <p className="text-[15px] leading-relaxed text-ink/74">{post.caption}</p>
            <div className="mt-4 grid gap-2">
              <p className="flex items-center gap-2 text-sm font-bold text-ink/58">
                <MapPin aria-hidden="true" className="text-coral" size={17} />
                {post.location}
              </p>
              <p className="flex items-center gap-2 text-sm font-bold text-ink/58">
                <Calendar aria-hidden="true" className="text-coral" size={17} />
                {post.dateLabel}
              </p>
            </div>
          </section>

          <MapboxMap
            className="h-56 overflow-hidden rounded-[28px] shadow-soft"
            experiences={[mapExperience]}
            selectedSlug={mapExperience.slug}
            zoom={10.4}
          />
        </div>
      </article>
    </MobileFrame>
  );
}
