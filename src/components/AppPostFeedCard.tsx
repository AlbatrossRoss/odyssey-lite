"use client";

import Link from "next/link";
import type { PointerEvent } from "react";
import { Bookmark, MapPin, UserRound } from "lucide-react";
import { PostMediaPreview } from "@/components/PostMediaPreview";
import type { AppPost } from "@/lib/posts";

type AppPostFeedCardProps = {
  onOpen?: () => void;
  onSave?: (post: AppPost) => void;
  post: AppPost;
  saveDisabled?: boolean;
};

function stopSheetDrag(event: PointerEvent) {
  event.stopPropagation();
}

export function AppPostFeedCard({ onOpen, onSave, post, saveDisabled = false }: AppPostFeedCardProps) {
  const saveButton = (
    <button
      aria-label="Save post to latest board"
      className="absolute right-4 top-4 z-10 flex h-10 w-10 items-center justify-center rounded-full bg-white/90 text-ink shadow-lift backdrop-blur transition active:scale-95 disabled:opacity-50"
      disabled={saveDisabled}
      onClick={(event) => {
        event.stopPropagation();
        onSave?.(post);
      }}
      onPointerDown={(event) => event.stopPropagation()}
      type="button"
    >
      <Bookmark aria-hidden="true" size={18} />
    </button>
  );

  if (!post.imageUrl) {
    return (
      <article className="relative overflow-hidden bg-white shadow-soft">
        {saveButton}
        <Link className="block min-h-[300px] p-5 text-left outline-none" href={`/posts/${post.id}`} onClick={onOpen} onPointerDown={stopSheetDrag}>
          <span className="flex items-center gap-3 pr-12">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-full bg-shell text-ink/50">
              {post.profilePhotoUrl ? (
                <img alt="" className="h-full w-full object-cover" src={post.profilePhotoUrl} />
              ) : (
                <UserRound aria-hidden="true" size={22} />
              )}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-extrabold text-ink">@{post.username}</span>
              <span className="block truncate text-xs font-semibold text-ink/46">{post.dateLabel}</span>
            </span>
          </span>
          <span className="mt-14 block">
            <span className="line-clamp-3 block text-3xl font-black leading-none text-ink">{post.title}</span>
            <span className="mt-4 line-clamp-4 block text-sm font-semibold leading-relaxed text-ink/62">{post.caption}</span>
          </span>
          <span className="mt-10 flex items-start gap-1.5 text-sm font-semibold leading-tight text-ink/58">
            <MapPin aria-hidden="true" className="mt-0.5 shrink-0 text-coral" size={16} />
            <span>{post.location}</span>
          </span>
        </Link>
      </article>
    );
  }

  return (
    <article className="relative overflow-hidden bg-ink shadow-soft">
      {saveButton}
      <Link
        className="relative block min-h-[430px] text-left outline-none"
        href={`/posts/${post.id}`}
        onClick={onOpen}
        onPointerDown={stopSheetDrag}
      >
        <span className="absolute inset-0 block bg-shell">
          <PostMediaPreview
            alt={post.title}
            className="h-full w-full object-cover"
            fallbackUrl={fallbackPostImageUrl(post.title, post.location)}
            mediaType={post.mediaTypes[0]}
            src={post.imageUrl}
          />
        </span>
        <span className="absolute inset-x-0 top-0 h-20 bg-gradient-to-b from-ink/74 via-ink/34 to-transparent" />
        <span className="absolute inset-x-0 bottom-0 h-[78%] bg-gradient-to-t from-ink via-ink/94 via-45% to-transparent" />
        <span className="absolute left-4 right-16 top-4 flex items-center gap-3 text-white">
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
        </span>
        <span className="absolute bottom-5 left-4 right-4 text-white">
          <span className="line-clamp-3 block text-lg font-black leading-snug drop-shadow-sm">{post.title}</span>
          {post.caption ? (
            <span className="mt-2 line-clamp-3 block text-sm font-normal leading-snug text-white/82 drop-shadow-sm">{post.caption}</span>
          ) : null}
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
