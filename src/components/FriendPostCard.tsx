"use client";

import { Bookmark } from "lucide-react";
import type { FriendPost } from "@/lib/data";
import { getUser } from "@/lib/data";

type FriendPostCardProps = {
  post: FriendPost;
  onSelect?: (post: FriendPost) => void;
};

export function FriendPostCard({ post, onSelect }: FriendPostCardProps) {
  const user = getUser(post.userId);

  return (
    <button
      className="w-[106px] shrink-0 overflow-hidden rounded-[15px] border border-ink/7 bg-white text-left shadow-soft"
      onClick={() => onSelect?.(post)}
      type="button"
    >
      <span className="relative block h-[86px] bg-ink">
        <img alt={post.title} className="h-full w-full object-cover" src={post.imageUrl} />
        <span className="absolute inset-0 bg-gradient-to-b from-ink/30 via-transparent to-transparent" />
        <span className="absolute left-2 top-2 flex items-center gap-1.5 text-white">
          <img alt="" className="h-6 w-6 rounded-full border-2 border-white object-cover shadow-lift" src={user?.avatarUrl} />
          <span>
            <span className="block max-w-14 truncate text-[10px] font-extrabold leading-tight">{user?.name}</span>
            <span className="block text-[9px] font-semibold text-white/82">{post.date}</span>
          </span>
        </span>
      </span>
      <span className="block p-2">
        <span className="flex items-start justify-between gap-2">
          <span className="min-w-0">
            <span className="block truncate text-xs font-black leading-tight text-ink">{post.title}</span>
            <span className="mt-0.5 block truncate text-[10px] font-semibold text-ink/56">{post.destination}</span>
          </span>
          <span className="mt-1 block h-2 w-2 shrink-0 rounded-full bg-[#7c5fd6]" />
        </span>
        <span className="mt-1 flex justify-end text-ink/70">
          <Bookmark aria-hidden="true" size={14} />
        </span>
      </span>
    </button>
  );
}
