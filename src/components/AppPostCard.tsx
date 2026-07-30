"use client";

import Link from "next/link";
import type { PointerEvent } from "react";
import { useLayoutEffect, useRef, useState } from "react";
import { Bookmark, MapPin, UserRound } from "lucide-react";
import { PostMediaPreview } from "@/components/PostMediaPreview";
import type { AppPost } from "@/lib/posts";

type AppPostCardProps = {
  onOpen?: () => void;
  post: AppPost;
};

function stopSheetDrag(event: PointerEvent) {
  event.stopPropagation();
}

const stateAbbreviations: Record<string, string> = {
  Alabama: "AL", Alaska: "AK", Arizona: "AZ", Arkansas: "AR", California: "CA", Colorado: "CO", Connecticut: "CT",
  Delaware: "DE", Florida: "FL", Georgia: "GA", Hawaii: "HI", Idaho: "ID", Illinois: "IL", Indiana: "IN", Iowa: "IA",
  Kansas: "KS", Kentucky: "KY", Louisiana: "LA", Maine: "ME", Maryland: "MD", Massachusetts: "MA", Michigan: "MI",
  Minnesota: "MN", Mississippi: "MS", Missouri: "MO", Montana: "MT", Nebraska: "NE", Nevada: "NV", "New Hampshire": "NH",
  "New Jersey": "NJ", "New Mexico": "NM", "New York": "NY", "North Carolina": "NC", "North Dakota": "ND", Ohio: "OH",
  Oklahoma: "OK", Oregon: "OR", Pennsylvania: "PA", "Rhode Island": "RI", "South Carolina": "SC", "South Dakota": "SD",
  Tennessee: "TN", Texas: "TX", Utah: "UT", Vermont: "VT", Virginia: "VA", Washington: "WA", "West Virginia": "WV",
  Wisconsin: "WI", Wyoming: "WY", "District of Columbia": "DC",
};

function compactPostLocation(location: string) {
  const parts = location.split(",").map((part) => part.trim()).filter(Boolean);
  const country = parts.at(-1)?.toLowerCase();
  const isUnitedStates = country === "united states" || country === "usa" || country === "us";
  const localParts = isUnitedStates ? parts.slice(0, -1) : parts;

  if (isUnitedStates && localParts.length >= 2) {
    const stateName = (localParts.at(-1) ?? "").replace(/\s+\d{5}(?:-\d{4})?$/, "");
    const state = stateAbbreviations[stateName] ?? stateName;
    const city = localParts.at(-2) ?? "";
    const specificPlace = localParts.length > 2 ? localParts[0] : null;

    return specificPlace ? `${specificPlace}, ${city}, ${state}` : `${city}, ${state}`;
  }

  if (localParts.length >= 3) {
    return `${localParts[0]}, ${localParts[1]}`;
  }

  return localParts.join(", ");
}

export function AppPostCard({ onOpen, post }: AppPostCardProps) {
  if (!post.imageUrl) {
    return (
      <Link
        className="relative block h-[254px] w-[142px] shrink-0 overflow-hidden rounded-[14px] bg-white p-3 text-left shadow-soft outline-none"
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
            <span className="line-clamp-2">{compactPostLocation(post.location)}</span>
          </span>
        </span>
      </Link>
    );
  }

  return (
    <Link
      className="relative block h-[254px] w-[142px] shrink-0 overflow-hidden rounded-[14px] bg-ink text-left shadow-soft outline-none"
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
        <span className="line-clamp-3 block text-[15px] font-normal leading-snug drop-shadow-sm">{post.title}</span>
        <span className="mt-2 flex items-start gap-1.5 text-xs font-semibold leading-tight text-white/88">
          <MapPin aria-hidden="true" className="mt-0.5 shrink-0" size={14} />
          <span className="line-clamp-2">{compactPostLocation(post.location)}</span>
        </span>
      </span>
    </Link>
  );
}

export function AppPostExploreTile({
  featured = false,
  onOpen,
  onSave,
  post,
  saveDisabled = false,
  saved = false,
}: AppPostCardProps & {
  featured?: boolean;
  onSave?: (post: AppPost) => void;
  saveDisabled?: boolean;
  saved?: boolean;
}) {
  return (
    <article
      className={`group relative overflow-hidden bg-ink text-left shadow-soft ${
        featured ? "col-span-2" : ""
      }`}
    >
      <Link className="block outline-none" href={`/posts/${post.id}`} onClick={onOpen} onPointerDown={stopSheetDrag}>
        <span className="relative block aspect-[2/3] overflow-hidden bg-shell">
          {post.imageUrl ? (
            <PostMediaPreview
              alt={post.title}
              className="h-full w-full object-cover transition duration-300 group-hover:scale-105"
              fallbackUrl={fallbackPostImageUrl(post.title, post.location)}
              imageVariant={featured ? "feed" : "card"}
              mediaType={post.mediaTypes[0]}
              src={post.imageUrl}
            />
          ) : (
            <span className="grid h-full place-items-center bg-gradient-to-br from-coral/18 via-shell to-sage/22 text-ink/34">
              <MapPin aria-hidden="true" size={featured ? 34 : 26} />
            </span>
          )}
          <span className="absolute inset-x-0 top-0 h-16 bg-gradient-to-b from-ink/68 to-transparent" />
          <span className="absolute inset-x-0 bottom-0 h-[42%] bg-gradient-to-t from-black/95 via-ink/82 to-transparent" />
          <span className="absolute left-3 right-14 top-3 flex items-center gap-2 text-white">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-full border-2 border-white/90 bg-shell text-ink shadow-lift">
              {post.profilePhotoUrl ? (
                <img alt="" className="h-full w-full object-cover" src={post.profilePhotoUrl} />
              ) : (
                <UserRound aria-hidden="true" size={15} />
              )}
            </span>
            <span className="truncate text-xs font-black drop-shadow-sm">@{post.username}</span>
          </span>
          <span className={`absolute inset-x-0 bottom-0 flex h-[40%] min-h-0 flex-col text-white ${featured ? "p-4" : "p-2.5"}`}>
            <span className={`line-clamp-2 block font-black leading-tight drop-shadow-sm ${featured ? "text-lg" : "text-sm"}`}>{post.title}</span>
            {post.caption ? (
              <FittedCaption
                caption={post.caption}
                className={`mt-1 min-h-0 flex-1 font-semibold leading-snug text-white/82 drop-shadow-sm ${
                  featured ? "text-sm" : "text-[11px]"
                }`}
              />
            ) : null}
            <span
              className={`mt-auto flex shrink-0 items-start gap-1.5 pt-1.5 font-semibold leading-tight text-white/72 ${
                featured ? "text-xs" : "text-[9px]"
              }`}
            >
              <MapPin aria-hidden="true" className="mt-px shrink-0" size={featured ? 13 : 10} />
              <span className="line-clamp-1 overflow-hidden text-ellipsis">{compactPostLocation(post.location)}</span>
            </span>
          </span>
        </span>
      </Link>
      {onSave ? (
        <button
          aria-label={saved ? "Saved to board" : "Save post to latest board"}
          className={`absolute right-3 top-3 z-10 flex h-8 w-8 items-center justify-center rounded-full shadow-lift backdrop-blur ${
            saved ? "bg-ink text-white" : "bg-white/90 text-ink"
          }`}
          disabled={saveDisabled}
          onClick={() => onSave(post)}
          onPointerDown={(event) => event.stopPropagation()}
          type="button"
        >
          <Bookmark aria-hidden="true" fill={saved ? "currentColor" : "none"} size={14} />
        </button>
      ) : null}
    </article>
  );
}

function FittedCaption({ caption, className }: { caption: string; className: string }) {
  const captionRef = useRef<HTMLSpanElement>(null);
  const [displayedCaption, setDisplayedCaption] = useState(caption.trim());

  useLayoutEffect(() => {
    const element = captionRef.current;

    if (!element) {
      return;
    }

    function fitCaption(target: HTMLSpanElement) {
      const availableHeight = target.clientHeight;
      const words = caption.trim().split(/\s+/);

      target.textContent = caption.trim();

      if (target.scrollHeight <= availableHeight + 1) {
        setDisplayedCaption(caption.trim());
        return;
      }

      let lowerBound = 0;
      let upperBound = words.length;

      while (lowerBound < upperBound) {
        const midpoint = Math.ceil((lowerBound + upperBound) / 2);
        target.textContent = `${words.slice(0, midpoint).join(" ")}...`;

        if (target.scrollHeight <= availableHeight + 1) {
          lowerBound = midpoint;
        } else {
          upperBound = midpoint - 1;
        }
      }

      setDisplayedCaption(`${words.slice(0, Math.max(1, lowerBound)).join(" ")}...`);
    }

    const handleResize = () => fitCaption(element);

    fitCaption(element);
    window.addEventListener("resize", handleResize);

    return () => window.removeEventListener("resize", handleResize);
  }, [caption]);

  return (
    <span className={`block overflow-hidden ${className}`} ref={captionRef}>
      {displayedCaption}
    </span>
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
