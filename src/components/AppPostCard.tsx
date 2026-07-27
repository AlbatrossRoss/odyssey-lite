"use client";

import Link from "next/link";
import type { PointerEvent } from "react";
import { MapPin, UserRound } from "lucide-react";
import { PostMediaPreview } from "@/components/PostMediaPreview";
import type { AppPost } from "@/lib/posts";

type AppPostCardProps = {
  onOpen?: () => void;
  post: AppPost;
};

function stopSheetDrag(event: PointerEvent) {
  event.stopPropagation();
}

export function AppPostCard({ onOpen, post }: AppPostCardProps) {
  if (!post.imageUrl) {
    return (
      <Link
        className="odyssey-card relative block h-[254px] w-[148px] shrink-0 overflow-hidden p-3 text-left outline-none"
        href={`/posts/${post.id}`}
        onClick={onOpen}
        onPointerDown={stopSheetDrag}
      >
        <span className="flex items-center gap-2">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-full bg-shell text-ink/50">
            {post.profilePhotoUrl ? (
              <img alt="" className="h-full w-full object-cover" src={post.profilePhotoUrl} />
            ) : (
              <UserRound aria-hidden="true" size={15} />
            )}
          </span>
          <span className="min-w-0">
            <span className="block truncate text-xs font-black leading-tight text-ink">@{post.username}</span>
            <span className="block truncate text-[10px] font-semibold leading-tight text-ink/44">{post.dateLabel}</span>
          </span>
        </span>
        <span className="absolute bottom-16 left-3 right-3 top-[58px] block overflow-hidden pb-1">
          <span className="line-clamp-3 block min-h-[61px] text-[17px] font-black leading-tight text-ink">{post.title}</span>
          <span className="mt-2 line-clamp-3 block text-xs font-semibold leading-snug text-ink/56">{post.caption}</span>
        </span>
        <span className="absolute bottom-3 left-3 right-3">
          <span className="flex items-start gap-1.5 text-xs font-semibold leading-tight text-ink/56">
            <MapPin aria-hidden="true" className="mt-0.5 shrink-0 text-coral" size={14} />
            <span className="line-clamp-2">{post.location}</span>
          </span>
        </span>
      </Link>
    );
  }

  return (
    <Link
      className="relative block h-[254px] w-[148px] shrink-0 overflow-hidden rounded-[20px] bg-ink text-left shadow-soft outline-none ring-1 ring-white/20"
      href={`/posts/${post.id}`}
      onClick={onOpen}
      onPointerDown={stopSheetDrag}
    >
      <span className="absolute inset-0 block bg-shell">
        <PostMediaPreview
          alt={post.title}
          className="h-full w-full object-cover"
          fallbackUrl={fallbackPostImageUrl(post.title, post.location)}
          imageVariant="card"
          mediaType={post.mediaTypes[0]}
          src={post.imageUrl}
        />
      </span>
      <span className="absolute inset-x-0 top-0 h-20 bg-gradient-to-b from-ink/74 via-ink/34 to-transparent" />
      <span className="absolute inset-x-0 bottom-0 h-[78%] bg-gradient-to-t from-ink via-ink/94 via-45% to-transparent" />
      <span className="absolute left-3 right-3 top-3 flex items-center gap-2 text-white">
        <span className="flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-full border-2 border-white/85 bg-shell text-ink shadow-lift">
          {post.profilePhotoUrl ? (
            <img alt="" className="h-full w-full object-cover" src={post.profilePhotoUrl} />
          ) : (
            <UserRound aria-hidden="true" size={15} />
          )}
        </span>
        <span className="min-w-0">
          <span className="block truncate text-xs font-black leading-tight">@{post.username}</span>
          <span className="block truncate text-[10px] font-semibold leading-tight text-white/76">{post.dateLabel}</span>
        </span>
      </span>
      <span className="absolute bottom-3 left-3 right-3 text-white">
        {post.tags[0] ? <span className="mb-2 inline-flex rounded-full bg-white/16 px-2 py-1 text-[9px] font-black uppercase tracking-[0.12em] backdrop-blur">{post.tags[0]}</span> : null}
        <span className="line-clamp-3 block text-[16px] font-black leading-snug drop-shadow-sm">{post.title}</span>
        <span className="mt-2 flex items-start gap-1.5 text-xs font-semibold leading-tight text-white/88">
          <MapPin aria-hidden="true" className="mt-0.5 shrink-0" size={14} />
          <span className="line-clamp-2">{post.location}</span>
        </span>
      </span>
    </Link>
  );
}

export function AppPostExploreTile({ post, featured = false }: AppPostCardProps & { featured?: boolean }) {
  if (!post.imageUrl) {
    return (
      <Link
        className={`group relative block overflow-hidden bg-white p-3 text-left shadow-soft ring-1 ring-ink/8 ${
          featured ? "col-span-2 row-span-2 rounded-[24px]" : "rounded-[18px]"
        }`}
        href={`/posts/${post.id}`}
      >
        <span className="absolute left-2.5 top-2.5 flex h-8 w-8 items-center justify-center overflow-hidden rounded-full bg-shell text-ink/50">
          {post.profilePhotoUrl ? (
            <img alt="" className="h-full w-full object-cover" src={post.profilePhotoUrl} />
          ) : (
            <UserRound aria-hidden="true" size={15} />
          )}
        </span>
        <span className="absolute bottom-2.5 left-2.5 right-2.5">
          <span className={`line-clamp-3 block font-black leading-tight text-ink ${featured ? "text-xl" : "text-xs"}`}>{post.title}</span>
        </span>
      </Link>
    );
  }

  return (
    <Link
      className={`group relative block overflow-hidden bg-ink text-left shadow-soft ${
        featured ? "col-span-2 row-span-2 rounded-[24px]" : "rounded-[18px]"
      }`}
      href={`/posts/${post.id}`}
    >
      <PostMediaPreview
        alt={post.title}
        className="absolute inset-0 h-full w-full object-cover opacity-[0.84] transition duration-300 group-hover:scale-105"
        fallbackUrl={fallbackPostImageUrl(post.title, post.location)}
        imageVariant={featured ? "card" : "thumbnail"}
        mediaType={post.mediaTypes[0]}
        src={post.imageUrl}
      />
      <span className="absolute inset-0 bg-gradient-to-b from-ink/10 via-transparent to-ink/76" />
      <span className="absolute left-2.5 top-2.5 flex h-8 w-8 items-center justify-center overflow-hidden rounded-full border-2 border-white/90 bg-shell text-ink shadow-lift">
        {post.profilePhotoUrl ? (
          <img alt="" className="h-full w-full object-cover" src={post.profilePhotoUrl} />
        ) : (
          <UserRound aria-hidden="true" size={15} />
        )}
      </span>
      <span className="absolute bottom-2.5 left-2.5 right-2.5 text-white">
        <span className={`line-clamp-2 block font-normal leading-tight drop-shadow-sm ${featured ? "text-base" : "text-xs"}`}>{post.title}</span>
      </span>
    </Link>
  );
}

export function AppPostTile({ post }: AppPostCardProps) {
  if (!post.imageUrl) {
    return (
      <Link className="group flex aspect-square flex-col overflow-hidden bg-white p-2.5 ring-1 ring-ink/8" href={`/posts/${post.id}`}>
        <span className="line-clamp-3 block text-xs font-black leading-tight text-ink">{post.title}</span>
        {post.caption ? (
          <span className="mt-1.5 line-clamp-5 block text-[10px] font-semibold leading-snug text-ink/52">{post.caption}</span>
        ) : null}
        <span className="mt-auto flex items-start gap-1 text-[9px] font-bold leading-tight text-ink/38">
          <MapPin aria-hidden="true" className="mt-px shrink-0 text-coral" size={10} />
          <span className="line-clamp-2">{post.location}</span>
        </span>
      </Link>
    );
  }

  return (
    <Link className="group relative block aspect-square overflow-hidden bg-shell" href={`/posts/${post.id}`}>
      <PostMediaPreview
        alt={post.title}
        className="h-full w-full object-cover transition duration-300 group-hover:scale-105"
        fallbackUrl={fallbackPostImageUrl(post.title, post.location)}
        imageVariant="thumbnail"
        mediaType={post.mediaTypes[0]}
        src={post.imageUrl}
      />
      <span className="absolute inset-0 bg-gradient-to-b from-ink/12 via-transparent to-ink/82 opacity-95" />
      <span className="absolute bottom-2 left-2 right-2">
        <span className="line-clamp-3 block text-xs font-normal leading-tight text-white drop-shadow-sm">{post.title}</span>
      </span>
    </Link>
  );
}

function fallbackPostImageUrl(title: string, location: string) {
  const terms = `${title} ${location}`
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ",")
    .replace(/,+/g, ",")
    .replace(/^,|,$/g, "");

  return `https://loremflickr.com/1200/1600/${terms || "travel"}?lock=91227`;
}
