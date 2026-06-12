"use client";

import Link from "next/link";
import { MapPin, UserRound } from "lucide-react";
import type { AppPost } from "@/lib/posts";

type AppPostFeedCardProps = {
  post: AppPost;
};

export function AppPostFeedCard({ post }: AppPostFeedCardProps) {
  return (
    <article className="overflow-hidden rounded-[28px] bg-white shadow-soft">
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
      <Link className="relative block aspect-[9/13] bg-ink" href={`/posts/${post.id}`}>
        <img alt={post.title} className="absolute inset-0 h-full w-full object-cover" src={post.imageUrl} />
        <span className="absolute inset-0 bg-gradient-to-b from-transparent via-ink/5 to-ink/72" />
        <span className="absolute bottom-4 left-4 right-4 text-white">
          <span className="block text-lg font-semibold italic leading-snug drop-shadow">{post.caption}</span>
          <span className="mt-4 flex items-start gap-1.5 text-sm font-extrabold leading-tight">
            <MapPin aria-hidden="true" className="mt-0.5 shrink-0" size={16} />
            <span>
              {post.title}
              <span className="block text-white/82">{post.location}</span>
            </span>
          </span>
        </span>
      </Link>
    </article>
  );
}
