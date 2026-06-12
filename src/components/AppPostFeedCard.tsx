"use client";

import Link from "next/link";
import { MapPin, UserRound } from "lucide-react";
import type { AppPost } from "@/lib/posts";

type AppPostFeedCardProps = {
  post: AppPost;
};

export function AppPostFeedCard({ post }: AppPostFeedCardProps) {
  return (
    <article className="overflow-hidden rounded-[24px] bg-white shadow-soft">
      <Link className="flex w-full items-center gap-3 p-3 text-left" href={`/accounts/${post.username}`}>
        <span className="flex h-11 w-11 items-center justify-center overflow-hidden rounded-full bg-shell text-ink/50">
          {post.profilePhotoUrl ? (
            <img alt="" className="h-full w-full object-cover" src={post.profilePhotoUrl} />
          ) : (
            <UserRound aria-hidden="true" size={22} />
          )}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-extrabold text-ink">@{post.username}</span>
          <span className="block truncate text-xs font-semibold text-ink/50">{post.dateLabel} · {post.type}</span>
        </span>
        <span className="text-xl font-black leading-none text-ink/38">...</span>
      </Link>
      <Link className="block text-left" href={`/posts/${post.id}`}>
        <span className="block aspect-[4/5] overflow-hidden bg-shell">
          <img
            alt={post.title}
            className="h-full w-full object-cover"
            onError={(event) => {
              const fallback = fallbackPostImageUrl(post.title, post.location);
              if (event.currentTarget.src !== fallback) {
                event.currentTarget.src = fallback;
              }
            }}
            src={post.imageUrl}
          />
        </span>
        <span className="block px-4 pb-4 pt-3">
          <span className="block text-lg font-black leading-tight text-ink">{post.title}</span>
          <span className="mt-2 flex items-start gap-1.5 text-sm font-extrabold leading-tight text-ink/62">
            <MapPin aria-hidden="true" className="mt-0.5 shrink-0" size={16} />
            <span>{post.location}</span>
          </span>
          <span className="mt-3 block text-sm font-semibold leading-relaxed text-ink/58">{post.caption}</span>
        </span>
      </Link>
    </article>
  );
}

function fallbackPostImageUrl(title: string, location: string) {
  const terms = `${title} ${location}`
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ",")
    .replace(/,+/g, ",")
    .replace(/^,|,$/g, "");

  return `https://loremflickr.com/1200/1600/${terms || "travel"}?lock=91226`;
}
