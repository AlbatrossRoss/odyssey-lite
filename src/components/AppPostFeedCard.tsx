"use client";

import Link from "next/link";
import { MapPin, UserRound } from "lucide-react";
import { PostMediaPreview } from "@/components/PostMediaPreview";
import type { AppPost } from "@/lib/posts";

type AppPostFeedCardProps = {
  onOpen?: () => void;
  post: AppPost;
};

export function AppPostFeedCard({ onOpen, post }: AppPostFeedCardProps) {
  return (
    <article className="overflow-hidden rounded-[24px] bg-ink shadow-soft">
      <Link
        className="relative block min-h-[430px] text-left"
        href={`/posts/${post.id}`}
        onClick={onOpen}
        onPointerDown={onOpen}
      >
        <span className="absolute inset-0 block bg-shell">
          <PostMediaPreview
            alt={post.title}
            className="h-full w-full object-cover opacity-[0.84]"
            fallbackUrl={fallbackPostImageUrl(post.title, post.location)}
            mediaType={post.mediaTypes[0]}
            src={post.imageUrl}
          />
        </span>
        <span className="absolute inset-0 bg-gradient-to-b from-ink/24 via-ink/10 to-ink/72" />
        <span className="absolute left-4 right-4 top-4 flex items-center gap-3 text-white">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-full border-2 border-white/85 bg-shell text-ink/50">
            {post.profilePhotoUrl ? (
              <img alt="" className="h-full w-full object-cover" src={post.profilePhotoUrl} />
            ) : (
              <UserRound aria-hidden="true" size={22} />
            )}
          </span>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-sm font-extrabold text-white">@{post.username}</span>
            <span className="block truncate text-xs font-semibold text-white/72">{post.dateLabel}</span>
          </span>
          <span className="text-xl font-black leading-none text-white/82">...</span>
        </span>
        <span className="absolute bottom-5 left-4 right-4 text-white">
          <span className="line-clamp-3 block text-lg font-normal leading-snug drop-shadow-sm">{post.title}</span>
          <span className="mt-4 flex items-start gap-1.5 text-sm font-semibold leading-tight text-white/88">
            <MapPin aria-hidden="true" className="mt-0.5 shrink-0" size={16} />
            <span>{post.location}</span>
          </span>
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
