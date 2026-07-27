"use client";

import Link from "next/link";
import { MapPin, UserRound, UsersRound } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { BottomNav } from "@/components/BottomNav";
import { DynamicMapboxMap } from "@/components/DynamicMapboxMap";
import { MobileFrame } from "@/components/MobileFrame";
import { PostMediaPreview } from "@/components/PostMediaPreview";
import { fetchFollowingIds, readAccountSessionId } from "@/lib/accounts";
import { fetchAppPosts, type AppPost } from "@/lib/posts";

export default function HomePage() {
  const router = useRouter();
  const [posts, setPosts] = useState<AppPost[]>([]);
  const [status, setStatus] = useState<"loading" | "ready">("loading");
  const [viewerId, setViewerId] = useState<string | null>(null);
  const [message, setMessage] = useState("");

  useEffect(() => {
    let active = true;
    const accountId = readAccountSessionId();
    setViewerId(accountId);

    if (!accountId) {
      setStatus("ready");
      return () => {
        active = false;
      };
    }

    Promise.all([fetchFollowingIds(accountId), fetchAppPosts()])
      .then(([followingIds, allPosts]) => {
        if (!active) {
          return;
        }

        const followedAccounts = new Set(followingIds);
        const friendPosts = allPosts
          .filter((post) => followedAccounts.has(post.accountId) && post.visibility.toLowerCase() === "public")
          .sort((first, second) => Date.parse(second.createdAt) - Date.parse(first.createdAt));
        setPosts(friendPosts);
        setStatus("ready");
      })
      .catch((error) => {
        if (active) {
          setMessage(error instanceof Error ? error.message : "Unable to load your friends’ posts.");
          setStatus("ready");
        }
      });

    return () => {
      active = false;
    };
  }, []);

  const latestFriendPosts = useMemo(() => {
    const seenAccounts = new Set<string>();

    return posts.filter((post) => {
      if (seenAccounts.has(post.accountId)) {
        return false;
      }

      seenAccounts.add(post.accountId);
      return true;
    });
  }, [posts]);

  return (
    <MobileFrame>
      <section className="relative h-full overflow-hidden bg-[#f8f6f1] text-ink">
        <div className="relative h-[38%] min-h-[250px] overflow-hidden bg-[#b9ddec]">
          <DynamicMapboxMap
            appPosts={latestFriendPosts}
            className="h-full w-full"
            experiences={[]}
            fitToAppPosts={latestFriendPosts.length > 0}
            interactive
            onPostSelect={(post) => router.push(`/posts/${post.id}`)}
            zoom={2}
          />
          <div className="pointer-events-none absolute inset-x-0 top-0 h-28 bg-gradient-to-b from-ink/30 to-transparent" />
          <div className="pointer-events-none absolute inset-x-0 top-0 z-10 px-5 pt-[calc(var(--safe-area-top)+18px)] text-white">
            <p className="text-[10px] font-black uppercase tracking-[0.18em] text-white/76">Your people, lately</p>
            <h1 className="mt-1 text-[28px] font-black leading-none drop-shadow-sm">Home</h1>
            <p className="mt-2 text-xs font-semibold text-white/86 drop-shadow-sm">
              {latestFriendPosts.length
                ? `${latestFriendPosts.length} ${latestFriendPosts.length === 1 ? "friend" : "friends"} on the map`
                : "Recent places from your circle"}
            </p>
          </div>
        </div>

        <section className="relative -mt-5 h-[calc(62%+1.25rem)] overflow-hidden rounded-t-[30px] bg-[#f8f6f1] shadow-[0_-16px_40px_rgba(24,35,31,0.13)]">
          <div className="no-scrollbar h-full overflow-y-auto px-4 pb-[calc(var(--bottom-nav-clearance)+1.25rem)] pt-5">
            <div className="mb-4 flex items-end justify-between gap-4 px-1">
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.16em] text-coral">From your circle</p>
                <h2 className="mt-1 text-[24px] font-black leading-tight">Friends&apos; latest posts</h2>
              </div>
              {posts.length ? <span className="pb-1 text-xs font-black text-ink/42">Newest first</span> : null}
            </div>

            {status === "loading" ? (
              <HomeState title="Catching up with friends…" />
            ) : message ? (
              <HomeState copy={message} title="The feed couldn’t load" />
            ) : !viewerId ? (
              <HomeState
                actionHref="/accounts"
                actionLabel="Log in"
                copy="Log in to see recent recommendations from people you follow."
                title="Your friends’ feed lives here"
              />
            ) : posts.length ? (
              <div className="space-y-3">
                {posts.map((post) => <HomeFeedCard key={post.id} post={post} />)}
              </div>
            ) : (
              <HomeState
                actionHref="/explore"
                actionLabel="Find people"
                copy="Follow a few travelers—or wait for your friends’ next recommendation—and their latest posts will appear here."
                title="Nothing new from friends yet"
              />
            )}
          </div>
        </section>

        <BottomNav activeTab="Home" />
      </section>
    </MobileFrame>
  );
}

function HomeFeedCard({ post }: { post: AppPost }) {
  return (
    <Link className="flex min-h-[112px] gap-3 rounded-[20px] bg-white p-3 shadow-[0_10px_28px_rgba(24,35,31,0.08)]" href={`/posts/${post.id}`}>
      <span className="relative h-[88px] w-[88px] shrink-0 overflow-hidden rounded-[15px] bg-shell">
        {post.imageUrl ? (
          <PostMediaPreview
            alt={post.title}
            className="h-full w-full object-cover"
            imageVariant="thumbnail"
            mediaType={post.mediaTypes[0]}
            src={post.imageUrl}
          />
        ) : (
          <span className="grid h-full place-items-center text-ink/32"><MapPin aria-hidden="true" size={24} /></span>
        )}
      </span>
      <span className="flex min-w-0 flex-1 flex-col py-0.5">
        <span className="flex items-center gap-2">
          <span className="grid h-7 w-7 shrink-0 place-items-center overflow-hidden rounded-full bg-shell text-ink/38">
            {post.profilePhotoUrl ? <img alt="" className="h-full w-full object-cover" src={post.profilePhotoUrl} /> : <UserRound aria-hidden="true" size={14} />}
          </span>
          <span className="min-w-0 truncate text-[11px] font-black text-ink/58">@{post.username} · {relativePostTime(post.createdAt)}</span>
        </span>
        <span className="mt-2 line-clamp-2 text-[15px] font-black leading-tight text-ink">{post.title}</span>
        <span className="mt-auto flex min-w-0 items-center gap-1 text-[11px] font-bold text-moss">
          <MapPin aria-hidden="true" className="shrink-0" size={12} />
          <span className="truncate">{compactLocation(post.location)}</span>
        </span>
      </span>
    </Link>
  );
}

function HomeState({
  actionHref,
  actionLabel,
  copy,
  title,
}: {
  actionHref?: string;
  actionLabel?: string;
  copy?: string;
  title: string;
}) {
  return (
    <div className="rounded-[24px] border border-ink/7 bg-white px-6 py-9 text-center shadow-[0_10px_28px_rgba(24,35,31,0.06)]">
      <span className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-moss/10 text-moss">
        <UsersRound aria-hidden="true" size={21} />
      </span>
      <h3 className="mt-3 text-lg font-black">{title}</h3>
      {copy ? <p className="mx-auto mt-2 max-w-[17rem] text-sm font-semibold leading-relaxed text-ink/52">{copy}</p> : null}
      {actionHref && actionLabel ? (
        <Link className="mt-5 inline-flex h-11 items-center justify-center rounded-full bg-ink px-5 text-sm font-black text-white" href={actionHref}>
          {actionLabel}
        </Link>
      ) : null}
    </div>
  );
}

function relativePostTime(createdAt: string) {
  const elapsed = Date.now() - Date.parse(createdAt);
  const hours = Math.max(1, Math.floor(elapsed / 3_600_000));

  if (hours < 24) {
    return `${hours}h`;
  }

  const days = Math.floor(hours / 24);
  if (days < 7) {
    return `${days}d`;
  }

  const weeks = Math.floor(days / 7);
  return weeks < 8 ? `${weeks}w` : new Intl.DateTimeFormat("en-US", { month: "short", year: "numeric" }).format(new Date(createdAt));
}

function compactLocation(location: string) {
  const stateCodes: Record<string, string> = {
    Arizona: "AZ", California: "CA", Colorado: "CO", Connecticut: "CT", Florida: "FL", Georgia: "GA",
    Hawaii: "HI", Illinois: "IL", Louisiana: "LA", Massachusetts: "MA", Michigan: "MI", Minnesota: "MN",
    Montana: "MT", Nevada: "NV", "New York": "NY", "North Carolina": "NC", Ohio: "OH", Oregon: "OR",
    Pennsylvania: "PA", "South Carolina": "SC", Tennessee: "TN", Texas: "TX", Utah: "UT", Virginia: "VA",
    Washington: "WA", Wisconsin: "WI",
  };
  const parts = location.split(",").map((part) => part.trim()).filter(Boolean);

  if (parts.at(-1) === "United States" && parts.length >= 3) {
    const stateName = (parts.at(-2) ?? "").replace(/\s+\d{5}(?:-\d{4})?$/, "");
    return `${parts.at(-3)}, ${stateCodes[stateName] ?? stateName}`;
  }

  return parts.length > 3 ? `${parts.at(-3)}, ${parts.at(-1)}` : location;
}
