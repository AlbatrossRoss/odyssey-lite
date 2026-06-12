"use client";

import Link from "next/link";
import { MapPin, UserRound } from "lucide-react";
import type { AppPost } from "@/lib/posts";

type AppPostCardProps = {
  post: AppPost;
};

export function AppPostCard({ post }: AppPostCardProps) {
  return (
    <Link className="w-[126px] shrink-0 overflow-hidden rounded-[18px] bg-white text-left shadow-soft" href={`/posts/${post.id}`}>
      <span className="relative block h-[104px] bg-ink">
        <img alt={post.title} className="h-full w-full object-cover" src={post.imageUrl} />
        <span className="absolute inset-0 bg-gradient-to-b from-ink/35 via-transparent to-ink/40" />
        <span className="absolute left-2 top-2 flex items-center gap-1.5 text-white">
          <span className="flex h-6 w-6 items-center justify-center overflow-hidden rounded-full border-2 border-white bg-shell text-ink shadow-lift">
            {post.profilePhotoUrl ? (
              <img alt="" className="h-full w-full object-cover" src={post.profilePhotoUrl} />
            ) : (
              <UserRound aria-hidden="true" size={13} />
            )}
          </span>
          <span className="block max-w-16 truncate text-[10px] font-extrabold leading-tight">@{post.username}</span>
        </span>
      </span>
      <span className="block p-2">
        <span className="block truncate text-xs font-black leading-tight text-ink">{post.title}</span>
        <span className="mt-1 flex items-center gap-1 truncate text-[10px] font-semibold text-ink/56">
          <MapPin aria-hidden="true" size={11} />
          {post.location}
        </span>
      </span>
    </Link>
  );
}

export function AppPostTile({ post }: AppPostCardProps) {
  return (
    <Link className="group relative block aspect-square overflow-hidden bg-ink" href={`/posts/${post.id}`}>
      <img alt={post.title} className="h-full w-full object-cover transition duration-300 group-hover:scale-105" src={post.imageUrl} />
      <span className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-ink/62 opacity-90" />
      <span className="absolute bottom-2 left-2 right-2">
        <span className="block truncate text-xs font-black text-white">{post.title}</span>
        <span className="mt-0.5 block truncate text-[10px] font-semibold text-white/76">{post.type}</span>
      </span>
    </Link>
  );
}
