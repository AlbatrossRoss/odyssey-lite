"use client";

import Link from "next/link";
import { ArrowUpRight, Bookmark, MapPin, Search, SlidersHorizontal, UserRound, UsersRound } from "lucide-react";
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
        <div className="relative h-[52%] min-h-[330px] overflow-hidden bg-[#b9ddec]">
          <DynamicMapboxMap
            appPosts={latestFriendPosts}
            className="h-full w-full"
            experiences={[]}
            fitToAppPosts={latestFriendPosts.length > 0}
            interactive
            onPostSelect={(post) => router.push(`/posts/${post.id}`)}
            zoom={2}
          />
          <div className="pointer-events-none absolute inset-x-0 top-0 h-36 bg-gradient-to-b from-ink/28 to-transparent" />
          <div className="absolute inset-x-0 top-0 z-10 px-4 pt-[calc(var(--safe-area-top)+16px)]">
            <Link
              className="flex h-[52px] items-center gap-3 rounded-full border border-white/70 bg-white/94 px-4 text-ink shadow-lift backdrop-blur-xl"
              href="/explore"
            >
              <Search aria-hidden="true" className="shrink-0 text-ink/72" size={20} />
              <span className="min-w-0 flex-1 text-sm font-bold text-ink/46">Where to next?</span>
              <SlidersHorizontal aria-hidden="true" size={19} />
            </Link>
          </div>
          <div className="absolute bottom-8 left-4 right-4 z-10 flex items-end justify-between gap-3">
            <Link
              aria-label="Open full map"
              className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-white text-moss shadow-lift"
              href="/explore"
            >
              <ArrowUpRight aria-hidden="true" size={21} />
            </Link>
            <span className="rounded-full bg-ink/82 px-4 py-2.5 text-right text-white shadow-lift backdrop-blur">
              <span className="block text-sm font-black leading-none">{latestFriendPosts.length}</span>
              <span className="mt-1 block text-[9px] font-bold uppercase tracking-[0.12em] text-white/72">latest stops</span>
            </span>
          </div>
        </div>

        <section className="relative -mt-5 h-[calc(48%+1.25rem)] overflow-hidden rounded-t-[30px] bg-white shadow-[0_-16px_40px_rgba(24,35,31,0.16)]">
          <div className="mx-auto mt-2.5 h-1 w-11 rounded-full bg-ink/20" />
          <div className="no-scrollbar h-[calc(100%-0.9rem)] overflow-y-auto pb-[calc(var(--bottom-nav-clearance)+1.25rem)] pt-4">
            <div className="mb-4 flex items-center justify-between gap-4 px-5">
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.16em] text-coral">Newest first</p>
                <h2 className="mt-1 text-[23px] font-black leading-tight">Friends&apos; latest posts</h2>
              </div>
              {posts.length ? <span className="text-xs font-black text-moss">Swipe</span> : null}
            </div>

            {status === "loading" ? (
              <div className="px-4"><HomeState title="Catching up with friends…" /></div>
            ) : message ? (
              <div className="px-4"><HomeState copy={message} title="The feed couldn’t load" /></div>
            ) : !viewerId ? (
              <div className="px-4">
                <HomeState
                  actionHref="/accounts"
                  actionLabel="Log in"
                  copy="Log in to see recent recommendations from people you follow."
                  title="Your friends’ feed lives here"
                />
              </div>
            ) : posts.length ? (
              <div className="no-scrollbar flex snap-x gap-3 overflow-x-auto px-5 pb-3">
                {posts.map((post) => <HomeFeedCard key={post.id} post={post} />)}
              </div>
            ) : (
              <div className="px-4">
                <HomeState
                  actionHref="/explore"
                  actionLabel="Find people"
                  copy="Follow a few travelers—or wait for your friends’ next recommendation—and their latest posts will appear here."
                  title="Nothing new from friends yet"
                />
              </div>
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
    <Link className="relative block w-[184px] shrink-0 snap-start overflow-hidden rounded-[19px] border border-ink/8 bg-white shadow-[0_10px_28px_rgba(24,35,31,0.09)]" href={`/posts/${post.id}`}>
      <span className="relative block h-[142px] overflow-hidden bg-shell">
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
        <span className="absolute inset-x-0 top-0 h-16 bg-gradient-to-b from-ink/62 to-transparent" />
        <span className="absolute left-2.5 top-2.5 flex min-w-0 items-center gap-2 text-white">
          <span className="grid h-8 w-8 shrink-0 place-items-center overflow-hidden rounded-full border-2 border-white bg-shell text-ink/38">
            {post.profilePhotoUrl ? <img alt="" className="h-full w-full object-cover" src={post.profilePhotoUrl} /> : <UserRound aria-hidden="true" size={14} />}
          </span>
          <span className="min-w-0">
            <span className="block max-w-[7rem] truncate text-[11px] font-black">@{post.username}</span>
            <span className="block text-[10px] font-bold text-white/80">{relativePostTime(post.createdAt)} ago</span>
          </span>
        </span>
      </span>
      <span className="block min-w-0 px-3 pb-3 pt-2.5">
        <span className="line-clamp-1 text-[14px] font-black leading-tight text-ink">{post.title}</span>
        <span className="mt-1.5 flex min-w-0 items-center gap-1 text-[10px] font-bold text-ink/48">
          <MapPin aria-hidden="true" className="shrink-0" size={12} />
          <span className="truncate">{compactLocation(post.location)}</span>
        </span>
        <span className="absolute bottom-2.5 right-2.5 text-ink/42"><Bookmark aria-hidden="true" size={15} /></span>
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
