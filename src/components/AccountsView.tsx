"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, Bookmark, Camera, Check, History, ImagePlus, LogOut, MapPin, Search, UserPlus, UserRound, X } from "lucide-react";
import {
  type AppAccount,
  AccountWithStats,
  accountDisplayName,
  clearAccountSessionId,
  fetchAccountById,
  fetchAccountConnections,
  fetchAccountsWithStats,
  readAccountSessionId,
  setAccountFollow,
  updateAccountCurrentCity,
  updateAccountPhoto,
} from "@/lib/accounts";
import { BottomNav } from "@/components/BottomNav";
import { DynamicMapboxMap } from "@/components/DynamicMapboxMap";
import { MobileFrame } from "@/components/MobileFrame";
import { PostMediaPreview } from "@/components/PostMediaPreview";
import { fetchBoardsByAccount, type AppBoard } from "@/lib/boards";
import { createAppPost, fetchAppPostsByAccount, type AppPost } from "@/lib/posts";
import { uploadPostMedia } from "@/lib/media";
import type { AppPostTag } from "@/lib/postTags";

type AccountsViewProps = {
  username?: string;
};

const accountsCachePrefix = "odyssey-accounts-cache-v1";
const profileBoardsCachePrefix = "odyssey-profile-boards-cache-v1";
const profilePostsCachePrefix = "odyssey-profile-posts-cache-v1";
const exploreStateStorageKey = "odyssey-explore-view-state-v1";
const profileHydrationTimeoutMs = 4500;
const tripPostingEnabled = false;

type SetupStep = "photo" | "city" | "follow" | "local-recs" | "done";
type PlaceSuggestion = {
  label: string;
  description?: string;
  query: string;
  center?: [number, number];
};
type LocalRecPrompt = {
  emoji: string;
  prompt: string;
  tag: AppPostTag;
  title: string;
};

const setupLocalRecPrompts: LocalRecPrompt[] = [
  {
    emoji: "🍴",
    prompt: "Where would you take a friend for their first meal?",
    tag: "Food & Drink",
    title: "Food & Drink",
  },
  {
    emoji: "✨",
    prompt: "What's one place every visitor should experience before leaving?",
    tag: "Experience",
    title: "Experience",
  },
  {
    emoji: "💎",
    prompt: "What's your favorite local secret?",
    tag: "Hidden Gem",
    title: "Hidden Gem",
  },
];

export function AccountsView({ username }: AccountsViewProps) {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const setupPhotoInputRef = useRef<HTMLInputElement | null>(null);
  const localRecPhotoInputRef = useRef<HTMLInputElement | null>(null);
  const postsSectionRef = useRef<HTMLElement | null>(null);
  const [viewerId, setViewerId] = useState<string | null>(null);
  const [accounts, setAccounts] = useState<AccountWithStats[]>([]);
  const [profilePosts, setProfilePosts] = useState<AppPost[]>([]);
  const [profileBoards, setProfileBoards] = useState<AppBoard[]>([]);
  const [status, setStatus] = useState<"loading" | "ready" | "saving">("loading");
  const [accountsHydrated, setAccountsHydrated] = useState(false);
  const [profilePostsHydrated, setProfilePostsHydrated] = useState(false);
  const [message, setMessage] = useState("");
  const [connectionOpen, setConnectionOpen] = useState<"followers" | "following" | null>(null);
  const [connectionAccounts, setConnectionAccounts] = useState<AppAccount[]>([]);
  const [connectionStatus, setConnectionStatus] = useState<"idle" | "loading">("idle");
  const [connectionSearch, setConnectionSearch] = useState("");
  const [postsGridOpen, setPostsGridOpen] = useState(false);
  const [setupOpen, setSetupOpen] = useState(false);
  const [setupStep, setSetupStep] = useState<SetupStep>("photo");
  const [setupMessage, setSetupMessage] = useState("");
  const [cityInput, setCityInput] = useState("");
  const [cityCoordinates, setCityCoordinates] = useState<[number, number] | undefined>();
  const [cityFocused, setCityFocused] = useState(false);
  const [citySuggestions, setCitySuggestions] = useState<PlaceSuggestion[]>([]);
  const [localRecIndex, setLocalRecIndex] = useState(0);
  const [localRecPlace, setLocalRecPlace] = useState("");
  const [localRecReason, setLocalRecReason] = useState("");
  const [localRecPhoto, setLocalRecPhoto] = useState<File | null>(null);

  const loadAccounts = useCallback(async (sessionId = viewerId) => {
    if (!sessionId) {
      return;
    }

    setAccountsHydrated(false);
    const cachedAccounts = readCachedAccounts(sessionId).filter((account) => !isZeroStatsViewerFallback(account, sessionId));

    if (cachedAccounts.length) {
      setAccounts(cachedAccounts);
      setStatus("ready");
    } else {
      setStatus("loading");
    }

    try {
      const nextAccounts = await fetchAccountsWithStats(sessionId);

      if (nextAccounts.length) {
        writeCachedAccounts(sessionId, nextAccounts);
        setAccounts(nextAccounts);
      }

      setAccountsHydrated(true);
      setStatus("ready");
    } catch (error) {
      try {
        const fallbackAccount = await withTimeout(fetchAccountById(sessionId), profileHydrationTimeoutMs);

        if (fallbackAccount) {
          const fallbackAccounts: AccountWithStats[] = [{
            ...fallbackAccount,
            isFollowedByViewer: false,
            stats: { followers: 0, following: 0, posts: 0 },
          }];
          setAccounts(fallbackAccounts);
        } else {
          setMessage(error instanceof Error ? error.message : "Unable to load accounts.");
        }
      } catch {
        setMessage(error instanceof Error ? error.message : "Unable to load accounts.");
      }
      setAccountsHydrated(true);
      setStatus("ready");
    }
  }, [viewerId]);

  useEffect(() => {
    const sessionId = readAccountSessionId();
    setViewerId(sessionId);

    if (!sessionId) {
      setAccountsHydrated(true);
      setStatus("ready");
      return;
    }

    void loadAccounts(sessionId);
  }, [loadAccounts]);

  const viewer = useMemo(() => accounts.find((account) => account.id === viewerId) ?? null, [accounts, viewerId]);
  const profile = useMemo(() => {
    if (!username) {
      return viewer;
    }

    return accounts.find((account) => account.username === username) ?? null;
  }, [accounts, username, viewer]);
  const otherAccounts = useMemo(() => accounts.filter((account) => account.id !== viewerId), [accounts, viewerId]);
  const suggestedAccounts = useMemo(() => otherAccounts.filter((account) => !account.isFollowedByViewer).slice(0, 5), [otherAccounts]);
  const filteredConnectionAccounts = useMemo(() => {
    const query = connectionSearch.trim().toLowerCase();

    if (!query) {
      return connectionAccounts;
    }

    return connectionAccounts.filter((account) =>
      `${account.username} ${account.currentCity ?? ""}`.toLowerCase().includes(query),
    );
  }, [connectionAccounts, connectionSearch]);
  const isOwnProfile = Boolean(profile && profile.id === viewerId);
  const followingCount = viewer?.stats.following ?? 0;
  const profileTrips = useMemo(() => profilePosts.filter((post) => post.type === "trip"), [profilePosts]);
  const profileRecentPosts = useMemo(() => profilePosts.filter((post) => post.type !== "trip"), [profilePosts]);
  const completedLocalRecTags = useMemo(() => {
    const tags = new Set<AppPostTag>();

    profileRecentPosts.forEach((post) => {
      setupLocalRecPrompts.forEach((prompt) => {
        if (post.tags.includes(prompt.tag)) {
          tags.add(prompt.tag);
        }
      });
    });

    return tags;
  }, [profileRecentPosts]);
  const setupProgress = useMemo(() => {
    const localRecCount = completedLocalRecTags.size;

    return [
      Boolean(viewer?.profilePhotoUrl),
      Boolean(viewer?.currentCity),
      followingCount >= 5,
      localRecCount > 0,
      localRecCount >= setupLocalRecPrompts.length,
    ].filter(Boolean).length;
  }, [completedLocalRecTags.size, followingCount, viewer?.currentCity, viewer?.profilePhotoUrl]);
  const setupTotal = 5;
  const setupPercent = Math.round((setupProgress / setupTotal) * 100);
  const showProfileSetup = isOwnProfile && status === "ready" && accountsHydrated && profilePostsHydrated && setupProgress < setupTotal;

  useEffect(() => {
    let active = true;
    setProfilePostsHydrated(false);

    if (!profile) {
      setProfilePosts([]);
      setProfileBoards([]);
      setProfilePostsHydrated(true);
      return;
    }

    const cachedBoards = readCachedProfileBoards(profile.id);
    const cachedPosts = readCachedProfilePosts(profile.id);

    if (cachedBoards.length) {
      setProfileBoards(cachedBoards);
    }

    if (cachedPosts.length) {
      setProfilePosts(cachedPosts);
    }

    withTimeout(fetchAppPostsByAccount(profile.id), profileHydrationTimeoutMs)
      .then((posts) => {
        if (active) {
          if (posts) {
            writeCachedProfilePosts(profile.id, posts);
            setProfilePosts(posts);
          }
          setProfilePostsHydrated(true);
        }
      })
      .catch(() => {
        if (active) {
          setProfilePosts([]);
          setProfilePostsHydrated(true);
        }
      });

    withTimeout(fetchBoardsByAccount(profile.id), profileHydrationTimeoutMs)
      .then((boards) => {
        if (active) {
          if (boards) {
            writeCachedProfileBoards(profile.id, boards);
            setProfileBoards(boards);
          }
        }
      })
      .catch(() => {
        if (active) {
          setProfileBoards([]);
        }
      });

    return () => {
      active = false;
    };
  }, [profile]);

  useEffect(() => {
    const query = cityInput.trim();

    if (!setupOpen || setupStep !== "city" || !cityFocused || query.length < 2) {
      setCitySuggestions([]);
      return;
    }

    return fetchPlaceSuggestions(query, setCitySuggestions, { types: "place,locality,neighborhood,region,address" });
  }, [cityFocused, cityInput, setupOpen, setupStep]);

  const resetLocalRecDraft = useCallback(() => {
    setLocalRecPlace("");
    setLocalRecReason("");
    setLocalRecPhoto(null);
  }, []);

  const nextSetupStep = useCallback((): SetupStep => {
    if (!viewer?.profilePhotoUrl) {
      return "photo";
    }

    if (!viewer.currentCity) {
      return "city";
    }

    if (followingCount < 5) {
      return "follow";
    }

    if (viewer.currentCity && completedLocalRecTags.size < setupLocalRecPrompts.length) {
      const nextLocalRecIndex = setupLocalRecPrompts.findIndex((prompt) => !completedLocalRecTags.has(prompt.tag));
      setLocalRecIndex(Math.max(nextLocalRecIndex, 0));
      resetLocalRecDraft();
      return "local-recs";
    }

    return "done";
  }, [completedLocalRecTags, followingCount, resetLocalRecDraft, viewer?.currentCity, viewer?.profilePhotoUrl]);

  useEffect(() => {
    if (setupOpen) {
      setSetupStep(nextSetupStep());
      setCityInput(viewer?.currentCity ?? "");
      setCityCoordinates(viewer?.currentCityCoordinates ?? undefined);
    }
  }, [nextSetupStep, setupOpen, viewer?.currentCity, viewer?.currentCityCoordinates]);

  async function toggleFollow(account: AccountWithStats) {
    if (!viewerId || account.id === viewerId) {
      return;
    }

    setStatus("saving");

    try {
      await setAccountFollow(viewerId, account.id, !account.isFollowedByViewer);
      await loadAccounts(viewerId);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to update follow.");
      setStatus("ready");
    }
  }

  async function openConnections(type: "followers" | "following") {
    if (!profile) {
      return;
    }

    setConnectionOpen(type);
    setConnectionStatus("loading");
    setConnectionAccounts([]);
    setConnectionSearch("");

    try {
      setConnectionAccounts(await fetchAccountConnections(profile.id, type));
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to load accounts.");
    } finally {
      setConnectionStatus("idle");
    }
  }

  function scrollToPosts() {
    postsSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  async function handlePhotoSelect(file: File | undefined) {
    if (!file || !viewerId || !file.type.startsWith("image/")) {
      return;
    }

    setStatus("saving");

    try {
      await updateAccountPhoto(viewerId, await fileToDataUrl(file));
      await loadAccounts(viewerId);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to update photo.");
      setStatus("ready");
    }
  }

  async function handleSetupPhotoSelect(file: File | undefined) {
    if (!file || !viewerId || !file.type.startsWith("image/")) {
      return;
    }

    setStatus("saving");
    setSetupMessage("");

    try {
      await updateAccountPhoto(viewerId, await fileToDataUrl(file));
      await loadAccounts(viewerId);
      setSetupStep(nextSetupStep());
    } catch (error) {
      setSetupMessage(error instanceof Error ? error.message : "Unable to update photo.");
      setStatus("ready");
    }
  }

  async function saveCurrentCity() {
    if (!viewerId || !cityInput.trim()) {
      setSetupMessage("Add your local city to continue.");
      return;
    }

    setStatus("saving");
    setSetupMessage("");

    try {
      await updateAccountCurrentCity(viewerId, cityInput.trim(), cityCoordinates);
      await loadAccounts(viewerId);
      setSetupStep(nextSetupStep());
    } catch (error) {
      setSetupMessage(error instanceof Error ? error.message : "Unable to save your city.");
      setStatus("ready");
    }
  }

  async function handleSetupFollow(account: AccountWithStats) {
    if (!viewerId || account.id === viewerId) {
      return;
    }

    setStatus("saving");
    setSetupMessage("");

    try {
      await setAccountFollow(viewerId, account.id, !account.isFollowedByViewer);
      await loadAccounts(viewerId);
      setStatus("ready");
    } catch (error) {
      setSetupMessage(error instanceof Error ? error.message : "Unable to update follow.");
      setStatus("ready");
    }
  }

  function skipSetupStep() {
    setSetupOpen(false);
    setSetupMessage("");
  }

  async function saveLocalRec() {
    const prompt = setupLocalRecPrompts[localRecIndex];

    if (!viewerId || !viewer || !prompt || !localRecPlace.trim()) {
      setSetupMessage("Choose a place before saving this recommendation.");
      return;
    }

    const coordinates = viewer.currentCityCoordinates;

    if (!coordinates) {
      setSetupMessage("Choose a suggested place so Odyssey can add it to the map.");
      return;
    }

    setStatus("saving");
    setSetupMessage("");

    try {
      const imageUrl = localRecPhoto ? await uploadPostMedia(localRecPhoto, viewerId) : null;
      const createdPost = await createAppPost({
        accountId: viewerId,
        caption: localRecReason.trim() || `A local favorite in ${viewer.currentCity ?? "my area"}.`,
        coordinates,
        dateLabel: "Just now",
        imageUrl,
        mediaTypes: imageUrl ? ["image"] : [],
        mediaUrls: imageUrl ? [imageUrl] : [],
        location: localRecPlace.trim(),
        tags: [prompt.tag],
        title: localRecPlace.trim(),
        type: "experience",
        visibility: "Public",
      });

      setProfilePosts((current) => [createdPost, ...current.filter((post) => post.id !== createdPost.id)]);
      writeCachedProfilePosts(viewerId, [createdPost, ...profilePosts.filter((post) => post.id !== createdPost.id)]);
      await loadAccounts(viewerId);
      const nextIndex = setupLocalRecPrompts.findIndex(
        (item, index) => index > localRecIndex && item.tag !== prompt.tag && !completedLocalRecTags.has(item.tag),
      );

      if (nextIndex >= 0) {
        setLocalRecIndex(nextIndex);
        resetLocalRecDraft();
      } else {
        setSetupStep("done");
      }
      setStatus("ready");
    } catch (error) {
      setSetupMessage(error instanceof Error ? error.message : "Unable to save this recommendation.");
      setStatus("ready");
    }
  }

  function logout() {
    clearAccountSessionId();
    window.location.assign("/");
  }

  return (
    <MobileFrame>
      <section className="safe-page-bottom h-full overflow-y-auto bg-[#fbfaf7]">
        <header className="hidden">
          <span className="h-11 w-11" />
          {isOwnProfile ? (
            <div className="flex items-center gap-2">
              <Link
                aria-label="Version history"
                className="flex h-11 w-11 items-center justify-center rounded-full bg-white/94 text-ink shadow-lift"
                href="/versions"
              >
                <History aria-hidden="true" size={19} />
              </Link>
              <button
                aria-label="Log out"
                className="flex h-11 w-11 items-center justify-center rounded-full bg-white/94 text-ink shadow-lift"
                onClick={logout}
                type="button"
              >
                <LogOut aria-hidden="true" size={19} />
              </button>
            </div>
          ) : (
            <span className="h-11 w-11" />
          )}
        </header>

        <div className="px-4">
          {profile ? (
            <section className="pt-2">
              <ProfileMapHero isOwnProfile={isOwnProfile} posts={profilePosts} profile={profile} />

              <section className="-mt-24 relative z-10 bg-transparent px-1 pb-2 pt-0">
                <div className="px-3">
                  <div className="flex items-start justify-between gap-4">
                    <div className="relative shrink-0">
                      <button
                        aria-label="Change profile photo"
                        className="flex h-28 w-28 items-center justify-center overflow-hidden rounded-full border-4 border-white bg-white text-ink/52 shadow-lift"
                        disabled={!isOwnProfile}
                        onClick={() => fileInputRef.current?.click()}
                        type="button"
                      >
                        {profile.profilePhotoUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img alt="" className="h-full w-full object-cover" src={profile.profilePhotoUrl} />
                        ) : (
                          <UserRound aria-hidden="true" size={38} />
                        )}
                      </button>
                      {isOwnProfile ? (
                        <span className="absolute bottom-1 right-1 grid h-9 w-9 place-items-center rounded-full bg-ink text-white shadow-lift">
                          <Camera aria-hidden="true" size={17} />
                        </span>
                      ) : null}
                      <input
                        accept="image/*"
                        className="hidden"
                        onChange={(event) => void handlePhotoSelect(event.target.files?.[0])}
                        ref={fileInputRef}
                        type="file"
                      />
                    </div>
                    {isOwnProfile ? (
                      <div className="mt-10 flex gap-2">
                        <Link
                          aria-label="Version history"
                          className="flex h-11 w-11 items-center justify-center rounded-full bg-white text-ink shadow-lift"
                          href="/versions"
                        >
                          <History aria-hidden="true" size={18} />
                        </Link>
                        <button
                          aria-label="Log out"
                          className="flex h-11 w-11 items-center justify-center rounded-full bg-white text-ink shadow-lift"
                          onClick={logout}
                          type="button"
                        >
                          <LogOut aria-hidden="true" size={18} />
                        </button>
                      </div>
                    ) : null}
                  </div>

                  <div className="mt-4">
                    <h1 className="min-w-0 truncate text-[30px] font-black leading-none text-ink">@{profile.username}</h1>
                    {profile.currentCity ? <p className="mt-1 flex items-center gap-1.5 text-sm font-bold text-moss"><MapPin aria-hidden="true" size={14} />{profile.currentCity}</p> : null}
                  </div>

                  <div className="mt-4 flex items-start justify-start gap-8">
                    <ProfileStat label="Posts" onClick={scrollToPosts} value={profile.stats.posts} />
                    <ProfileStat label="Followers" onClick={() => void openConnections("followers")} value={profile.stats.followers} />
                    <ProfileStat label="Following" onClick={() => void openConnections("following")} value={profile.stats.following} />
                  </div>
                </div>

              {!isOwnProfile ? (
                <button
                  className={`mx-3 mt-5 flex h-12 items-center justify-center gap-2 rounded-full px-5 text-sm font-black shadow-lift ${
                    profile.isFollowedByViewer ? "bg-white text-ink" : "bg-ink text-white"
                  }`}
                  disabled={status === "saving"}
                  onClick={() => void toggleFollow(profile)}
                  type="button"
                >
                  <UserPlus aria-hidden="true" size={17} />
                  {profile.isFollowedByViewer ? "Following" : "Follow"}
                </button>
              ) : null}

              {showProfileSetup ? (
                <button
                  className="mx-3 mt-6 w-[calc(100%-1.5rem)] rounded-[24px] bg-white p-4 text-left shadow-lift"
                  onClick={() => setSetupOpen(true)}
                  type="button"
                >
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <p className="text-xs font-black uppercase tracking-[0.14em] text-coral">Profile Setup</p>
                      <h2 className="mt-1 text-lg font-black text-ink">Set up your account!</h2>
                      <p className="mt-1 text-sm font-semibold leading-relaxed text-ink/54">Add your basics and share local favorites people can find on the map.</p>
                    </div>
                    <span className="shrink-0 text-sm font-black text-ink/48">
                      {setupProgress}/{setupTotal}
                    </span>
                  </div>
                  <div className="mt-4 h-2 overflow-hidden rounded-full bg-shell">
                    <div className="h-full rounded-full bg-ink transition-all" style={{ width: `${setupPercent}%` }} />
                  </div>
                </button>
              ) : null}

                <section className="mt-7" ref={postsSectionRef}>
                  <div className="mb-3 flex items-center justify-between">
                    <div>
                      <h2 className="text-lg font-black text-ink">Recently Added</h2>
                    </div>
                    <button className="text-xs font-black text-moss" onClick={() => setPostsGridOpen(true)} type="button">
                      View all
                    </button>
                  </div>
                  {profileRecentPosts.length ? (
                    <div className="no-scrollbar flex gap-3 overflow-x-auto pb-2">
                      {profileRecentPosts.slice(0, 8).map((post) => (
                        <ProfileRecentCard key={post.id} post={post} />
                      ))}
                    </div>
                  ) : profilePostsHydrated ? (
                    <div className="rounded-[24px] bg-white px-5 py-8 text-center shadow-lift">
                      <p className="text-sm font-bold leading-relaxed text-ink/52">
                        {isOwnProfile ? "Share a recommendation to start your profile." : "No posts here yet."}
                      </p>
                    </div>
                  ) : null}
                </section>

                {tripPostingEnabled ? <section className="mt-6">
                  <div className="mb-3 flex items-center justify-between">
                    <div>
                      <h2 className="text-lg font-black text-ink">{isOwnProfile ? "My Trips" : "Trips"}</h2>
                    </div>
                  </div>
                  {profileTrips.length ? (
                    <div className="no-scrollbar flex gap-3 overflow-x-auto pb-2">
                      {profileTrips.slice(0, 6).map((trip) => (
                        <ProfileTripCard key={trip.id} trip={trip} />
                      ))}
                    </div>
                  ) : profilePostsHydrated ? (
                    <div className="rounded-[24px] bg-white px-5 py-7 text-center shadow-lift">
                      <p className="text-sm font-bold leading-relaxed text-ink/52">{isOwnProfile ? "Published trips will live here." : "No trips here yet."}</p>
                    </div>
                  ) : null}
                </section> : null}

                <section className="mt-6">
                  <div className="mb-3 flex items-center justify-between">
                    <div>
                      <h2 className="text-lg font-black text-ink">{isOwnProfile ? "My Boards" : "Boards"}</h2>
                    </div>
                    <Link className="text-xs font-black text-moss" href="/boards">
                      View all
                    </Link>
                  </div>
                  {profileBoards.length ? (
                    <div className="no-scrollbar flex gap-3 overflow-x-auto pb-2">
                      {profileBoards.slice(0, 6).map((board) => (
                        <ProfileBoardCard board={board} isOwnProfile={isOwnProfile} key={board.id} />
                      ))}
                    </div>
                  ) : (
                    <div className="rounded-[24px] bg-white px-5 py-7 text-center shadow-lift">
                      <Bookmark aria-hidden="true" className="mx-auto text-ink/34" size={26} />
                      <p className="mt-2 text-sm font-bold leading-relaxed text-ink/52">No boards saved yet.</p>
                    </div>
                  )}
                </section>

              </section>
            </section>
          ) : (
            <section className="flex min-h-[calc(100dvh-9rem)] items-center justify-center">
              <div className="w-full rounded-[28px] bg-white p-5 text-center shadow-lift">
                <UserRound aria-hidden="true" className="mx-auto text-ink/40" size={42} />
                <h1 className="mt-3 text-2xl font-black text-ink">{accountsHydrated ? "Account not found" : "Loading profile..."}</h1>
                <p className="mt-2 text-sm font-semibold leading-relaxed text-ink/56">
                  {accountsHydrated ? "This profile may not exist yet." : "Your profile will appear here in a moment."}
                </p>
              </div>
            </section>
          )}

          {message ? <p className="mt-5 rounded-2xl bg-coral/10 px-4 py-3 text-sm font-bold text-coral">{message}</p> : null}

          {!username && suggestedAccounts.length ? (
            <section className="mt-7">
              <div className="mb-3 flex items-end justify-between">
                <div>
                  <h2 className="text-lg font-black text-ink">Accounts to follow</h2>
                </div>
                <button className="text-xs font-black text-ink/50" onClick={() => void loadAccounts()} type="button">
                  Refresh
                </button>
              </div>
              <div className="space-y-3">
                {suggestedAccounts.map((account) => (
                  <article className="flex items-center gap-3 rounded-[14px] bg-white p-3 shadow-sm ring-1 ring-ink/5" key={account.id}>
                    <Link
                      aria-label={`Open ${accountDisplayName(account)}`}
                      className="flex min-w-0 flex-1 items-center gap-3"
                      href={`/accounts/${account.username}`}
                    >
                      <Avatar account={account} />
                      <div className="min-w-0">
                        <h3 className="truncate text-base font-black text-ink">{accountDisplayName(account)}</h3>
                        <p className="text-xs font-bold text-ink/48">
                          {account.stats.followers} followers · {account.stats.posts} posts
                        </p>
                      </div>
                    </Link>
                    <button
                      className={`h-10 rounded-full px-4 text-xs font-black ${
                        account.isFollowedByViewer ? "bg-shell text-ink" : "bg-ink text-white"
                      }`}
                      disabled={status === "saving"}
                      onClick={() => void toggleFollow(account)}
                      type="button"
                    >
                      {account.isFollowedByViewer ? "Following" : "Follow"}
                    </button>
                  </article>
                ))}
              </div>
            </section>
          ) : null}
        </div>
      </section>
      {setupOpen && profile && isOwnProfile ? (
        <div className="safe-modal-bottom absolute inset-x-0 top-0 z-50 flex h-full items-end bg-ink/28 backdrop-blur-sm">
          <section className="max-h-[88%] w-full overflow-y-auto rounded-t-[30px] bg-white p-5 shadow-soft">
            <div className="mb-5 flex items-start justify-between gap-3">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.16em] text-coral">Profile Setup</p>
                <h2 className="mt-1 text-2xl font-black text-ink">Set up your account!</h2>
                <p className="mt-1 text-sm font-semibold leading-relaxed text-ink/54">
                  {setupProgress}/{setupTotal} complete
                </p>
              </div>
              <button
                aria-label="Close profile setup"
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-shell text-ink"
                onClick={() => setSetupOpen(false)}
                type="button"
              >
                <X aria-hidden="true" size={19} />
              </button>
            </div>

            <div className="mb-5 h-2 overflow-hidden rounded-full bg-shell">
              <div className="h-full rounded-full bg-ink transition-all" style={{ width: `${setupPercent}%` }} />
            </div>

            {setupMessage ? <p className="mb-4 rounded-2xl bg-coral/10 px-4 py-3 text-sm font-bold text-coral">{setupMessage}</p> : null}

            {setupStep === "photo" ? (
              <section className="text-center">
                <div className="mx-auto grid h-28 w-28 place-items-center overflow-hidden rounded-full bg-shell text-ink/38 ring-1 ring-ink/8">
                  {viewer?.profilePhotoUrl ? <img alt="" className="h-full w-full object-cover" src={viewer.profilePhotoUrl} /> : <UserRound aria-hidden="true" size={44} />}
                </div>
                <h3 className="mt-5 text-2xl font-black text-ink">Add a profile pic</h3>
                <p className="mx-auto mt-2 max-w-72 text-sm font-semibold leading-relaxed text-ink/56">
                  Help friends recognize your local recommendations when they show up on the map.
                </p>
                <input
                  accept="image/*"
                  capture="user"
                  className="hidden"
                  onChange={(event) => void handleSetupPhotoSelect(event.target.files?.[0])}
                  ref={setupPhotoInputRef}
                  type="file"
                />
                <button
                  className="mt-6 flex h-14 w-full items-center justify-center gap-2 rounded-full bg-ink px-5 text-sm font-black text-white shadow-lift"
                  disabled={status === "saving"}
                  onClick={() => setupPhotoInputRef.current?.click()}
                  type="button"
                >
                  <Camera aria-hidden="true" size={18} />
                  Choose or Take Photo
                </button>
              </section>
            ) : null}

            {setupStep === "city" ? (
              <section>
                <h3 className="text-2xl font-black text-ink">What&apos;s your local city?</h3>
                <p className="mt-2 text-sm font-semibold leading-relaxed text-ink/56">This helps Odyssey guide your first local recommendations.</p>
                <div className="mt-5 rounded-[24px] bg-shell p-4">
                  <label className="flex h-12 items-center gap-2 rounded-full bg-white px-4 shadow-sm">
                    <Search aria-hidden="true" className="text-moss" size={18} />
                    <input
                      className="min-w-0 flex-1 bg-transparent text-sm font-bold text-ink outline-none placeholder:text-ink/32"
                      onBlur={() => window.setTimeout(() => setCityFocused(false), 140)}
                      onChange={(event) => {
                        setCityInput(event.target.value);
                        setCityCoordinates(undefined);
                      }}
                      onFocus={() => setCityFocused(true)}
                      placeholder="Search your city"
                      value={cityInput}
                    />
                  </label>
                  {citySuggestions.length ? (
                    <div className="mt-3 overflow-hidden rounded-[20px] bg-white shadow-sm">
                      {citySuggestions.map((suggestion) => (
                        <button
                          className="flex w-full flex-col px-4 py-3 text-left hover:bg-shell"
                          key={`${suggestion.label}-${suggestion.description ?? ""}`}
                          onClick={() => {
                            setCityInput(suggestion.query);
                            setCityCoordinates(suggestion.center);
                            setCityFocused(false);
                            setCitySuggestions([]);
                          }}
                          type="button"
                        >
                          <span className="text-sm font-black text-ink">{suggestion.label}</span>
                          {suggestion.description ? <span className="mt-0.5 line-clamp-1 text-xs font-semibold text-ink/52">{suggestion.description}</span> : null}
                        </button>
                      ))}
                    </div>
                  ) : null}
                </div>
                <button
                  className="mt-5 flex h-14 w-full items-center justify-center rounded-full bg-ink px-5 text-sm font-black text-white shadow-lift disabled:opacity-45"
                  disabled={status === "saving" || !cityInput.trim()}
                  onClick={() => void saveCurrentCity()}
                  type="button"
                >
                  Save City
                </button>
              </section>
            ) : null}

            {setupStep === "follow" ? (
              <section>
                <h3 className="text-2xl font-black text-ink">Follow 5 users</h3>
                <p className="mt-2 text-sm font-semibold leading-relaxed text-ink/56">
                  Follow local voices and friends so your Explore map starts with people-powered recommendations.
                </p>
                <p className="mt-3 text-sm font-black text-coral">{Math.min(followingCount, 5)}/5 following</p>
                <div className="mt-4 space-y-3">
                  {otherAccounts.slice(0, 8).map((account) => (
                    <article className="flex items-center gap-3 rounded-[22px] bg-shell p-3" key={account.id}>
                      <Avatar account={account} />
                      <div className="min-w-0 flex-1">
                        <h4 className="truncate text-sm font-black text-ink">{accountDisplayName(account)}</h4>
                        <p className="text-xs font-bold text-ink/48">{account.stats.followers} followers</p>
                      </div>
                      <button
                        className={`h-10 rounded-full px-4 text-xs font-black ${account.isFollowedByViewer ? "bg-white text-ink" : "bg-ink text-white"}`}
                        disabled={status === "saving"}
                        onClick={() => void handleSetupFollow(account)}
                        type="button"
                      >
                        {account.isFollowedByViewer ? "Following" : "Follow"}
                      </button>
                    </article>
                  ))}
                </div>
                <button
                  className="mt-5 flex h-14 w-full items-center justify-center rounded-full bg-ink px-5 text-sm font-black text-white shadow-lift"
                  onClick={() => setSetupStep(viewer?.currentCity ? "local-recs" : "done")}
                  type="button"
                >
                  Continue
                </button>
              </section>
            ) : null}

            {setupStep === "local-recs" && viewer?.currentCity ? (
              <section>
                <p className="text-xs font-black uppercase tracking-[0.16em] text-coral">Share Your Local Favorites</p>
                <h3 className="mt-1 text-2xl font-black text-ink">If a friend were visiting your area, what would you tell them not to miss?</h3>
                <p className="mt-2 text-sm font-semibold text-ink/50">
                  {localRecIndex + 1}/{setupLocalRecPrompts.length}
                </p>
                <div className="mt-5 rounded-[26px] bg-shell p-4">
                  <p className="text-3xl">{setupLocalRecPrompts[localRecIndex]?.emoji}</p>
                  <h4 className="mt-2 text-lg font-black text-ink">{setupLocalRecPrompts[localRecIndex]?.title}</h4>
                  <p className="mt-1 text-sm font-bold leading-relaxed text-ink/58">{setupLocalRecPrompts[localRecIndex]?.prompt}</p>
                  <label className="mt-4 block">
                    <span className="mb-1 block text-xs font-black uppercase tracking-[0.12em] text-ink/38">Recommendation</span>
                    <input
                      className="h-12 w-full rounded-[18px] bg-white px-4 text-sm font-bold text-ink outline-none placeholder:text-ink/32"
                      onChange={(event) => setLocalRecPlace(event.target.value)}
                      placeholder="Name the place or rec"
                      value={localRecPlace}
                    />
                  </label>
                  <label className="mt-3 block">
                    <span className="mb-1 block text-xs font-black uppercase tracking-[0.12em] text-ink/38">Details</span>
                    <textarea
                      className="min-h-20 w-full resize-none rounded-[18px] bg-white px-4 py-3 text-sm font-semibold leading-relaxed text-ink outline-none placeholder:text-ink/32"
                      onChange={(event) => setLocalRecReason(event.target.value)}
                      placeholder="Optional: one-sentence reason"
                      value={localRecReason}
                    />
                  </label>
                  <input
                    accept="image/*"
                    className="hidden"
                    onChange={(event) => setLocalRecPhoto(event.target.files?.[0] ?? null)}
                    ref={localRecPhotoInputRef}
                    type="file"
                  />
                  <button
                    className="mt-3 flex h-11 items-center gap-2 rounded-full bg-white px-4 text-xs font-black text-ink shadow-sm"
                    onClick={() => localRecPhotoInputRef.current?.click()}
                    type="button"
                  >
                    <ImagePlus aria-hidden="true" size={16} />
                    {localRecPhoto ? localRecPhoto.name : "Optional photo"}
                  </button>
                </div>
                <button
                  className="mt-5 flex h-14 w-full items-center justify-center rounded-full bg-ink px-5 text-sm font-black text-white shadow-lift disabled:opacity-45"
                  disabled={status === "saving" || !localRecPlace.trim()}
                  onClick={() => void saveLocalRec()}
                  type="button"
                >
                  Save Recommendation
                </button>
              </section>
            ) : null}

            {setupStep === "done" ? (
              <section className="py-4 text-center">
                <div className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-ink text-white">
                  <Check aria-hidden="true" size={26} />
                </div>
                <h3 className="mt-4 text-2xl font-black text-ink">You&apos;re set</h3>
                <p className="mx-auto mt-2 max-w-72 text-sm font-semibold leading-relaxed text-ink/56">
                  Your profile is ready for better local discovery.
                </p>
              </section>
            ) : null}

            {setupStep !== "done" ? (
              <button className="mt-4 w-full rounded-full px-5 py-3 text-sm font-black text-ink/46" onClick={skipSetupStep} type="button">
                Skip for now
              </button>
            ) : (
              <button
                className="mt-5 flex h-14 w-full items-center justify-center rounded-full bg-ink px-5 text-sm font-black text-white shadow-lift"
                onClick={() => setSetupOpen(false)}
                type="button"
              >
                Done
              </button>
            )}
          </section>
        </div>
      ) : null}
      {postsGridOpen && profile ? (
        <div className="safe-modal-bottom absolute inset-x-0 top-0 z-50 flex h-full flex-col bg-[#fbfaf7]">
          <header className="safe-top-bar flex items-center justify-between px-5 pb-3">
            <button
              aria-label="Close all posts"
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white text-ink shadow-lift"
              onClick={() => setPostsGridOpen(false)}
              type="button"
            >
              <ArrowLeft aria-hidden="true" size={19} />
            </button>
            <h2 className="text-right text-2xl font-black text-ink">{profile.username}&apos;s posts</h2>
          </header>
          <div className="no-scrollbar grid flex-1 grid-cols-2 gap-3 overflow-y-auto px-5 pb-[calc(var(--safe-area-bottom)+1rem)]">
            {profileRecentPosts.map((post) => (
              <ProfileGridPostCard key={post.id} post={post} />
            ))}
            {!profileRecentPosts.length ? (
              <p className="col-span-2 rounded-[18px] bg-white px-5 py-8 text-center text-sm font-bold text-ink/52 shadow-sm">
                {isOwnProfile ? "Share a recommendation to start your post grid." : "No posts here yet."}
              </p>
            ) : null}
          </div>
        </div>
      ) : null}
      {connectionOpen && profile ? (
        <div className="safe-modal-bottom absolute inset-x-0 top-0 z-50 flex h-full items-end bg-ink/28 backdrop-blur-sm">
          <section className="max-h-[84%] w-full overflow-y-auto rounded-t-[30px] bg-[#fbfaf7] p-5 shadow-soft">
            <div className="mb-4 flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="truncate text-xs font-black uppercase tracking-[0.16em] text-coral">{accountDisplayName(profile)}</p>
                <h2 className="mt-1 text-[26px] font-black leading-none text-ink">{connectionOpen === "followers" ? "Followers" : "Following"}</h2>
              </div>
              <button
                aria-label="Close account list"
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white text-ink shadow-lift"
                onClick={() => {
                  setConnectionOpen(null);
                  setConnectionSearch("");
                }}
                type="button"
              >
                <X aria-hidden="true" size={19} />
              </button>
            </div>

            <label className="mb-4 flex h-12 items-center gap-2 rounded-full bg-white px-4 shadow-sm ring-1 ring-ink/6">
              <Search aria-hidden="true" className="shrink-0 text-moss" size={18} />
              <span className="sr-only">Search accounts</span>
              <input
                autoCapitalize="none"
                className="min-w-0 flex-1 bg-transparent text-sm font-bold text-ink outline-none placeholder:text-ink/34"
                onChange={(event) => setConnectionSearch(event.target.value)}
                placeholder={`Search ${connectionOpen}`}
                value={connectionSearch}
              />
              {connectionSearch ? (
                <button
                  aria-label="Clear account search"
                  className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-shell text-ink/52"
                  onClick={() => setConnectionSearch("")}
                  type="button"
                >
                  <X aria-hidden="true" size={14} />
                </button>
              ) : null}
            </label>

            {connectionStatus === "loading" ? (
              <p className="rounded-[22px] bg-white px-4 py-5 text-center text-sm font-bold text-ink/50 shadow-sm">Loading accounts...</p>
            ) : filteredConnectionAccounts.length ? (
              <div className="space-y-3">
                {filteredConnectionAccounts.map((account) => (
                  <Link
                    className="flex items-center gap-3 rounded-[18px] bg-white p-3 shadow-sm ring-1 ring-ink/5"
                    href={`/accounts/${account.username}`}
                    key={account.id}
                    onClick={() => {
                      setConnectionOpen(null);
                      setConnectionSearch("");
                    }}
                  >
                    <Avatar account={account} />
                    <div className="min-w-0">
                      <h3 className="truncate text-base font-black text-ink">{accountDisplayName(account)}</h3>
                      {account.currentCity ? <p className="truncate text-xs font-bold text-ink/48">{account.currentCity}</p> : null}
                    </div>
                  </Link>
                ))}
              </div>
            ) : (
              <p className="rounded-[22px] bg-white px-4 py-5 text-center text-sm font-bold text-ink/50 shadow-sm">
                {connectionSearch
                  ? "No accounts match that search."
                  : connectionOpen === "followers"
                    ? "No followers yet."
                    : "Not following anyone yet."}
              </p>
            )}
          </section>
        </div>
      ) : null}
      <BottomNav activeTab="Accounts" />
    </MobileFrame>
  );
}

function readCachedAccounts(viewerId: string) {
  try {
    const cached = window.sessionStorage.getItem(`${accountsCachePrefix}-${viewerId}`);
    return cached ? (JSON.parse(cached) as AccountWithStats[]) : [];
  } catch {
    return [];
  }
}

function isZeroStatsViewerFallback(account: AccountWithStats, viewerId: string) {
  return (
    account.id === viewerId &&
    account.stats.followers === 0 &&
    account.stats.following === 0 &&
    account.stats.posts === 0 &&
    !account.isFollowedByViewer
  );
}

function writeCachedAccounts(viewerId: string, accounts: AccountWithStats[]) {
  try {
    window.sessionStorage.setItem(`${accountsCachePrefix}-${viewerId}`, JSON.stringify(accounts));
  } catch {
    // Account data still refreshes from Supabase if session storage is unavailable.
  }
}

function readCachedProfileBoards(accountId: string) {
  try {
    const cached = window.sessionStorage.getItem(`${profileBoardsCachePrefix}-${accountId}`);
    return cached ? (JSON.parse(cached) as AppBoard[]) : [];
  } catch {
    return [];
  }
}

function writeCachedProfileBoards(accountId: string, boards: AppBoard[]) {
  try {
    window.sessionStorage.setItem(`${profileBoardsCachePrefix}-${accountId}`, JSON.stringify(boards));
  } catch {
    // Profile boards still refresh from Supabase if session storage is unavailable.
  }
}

function readCachedProfilePosts(accountId: string) {
  try {
    const cached = window.sessionStorage.getItem(`${profilePostsCachePrefix}-${accountId}`);
    return cached ? (JSON.parse(cached) as AppPost[]) : [];
  } catch {
    return [];
  }
}

function writeCachedProfilePosts(accountId: string, posts: AppPost[]) {
  try {
    window.sessionStorage.setItem(`${profilePostsCachePrefix}-${accountId}`, JSON.stringify(posts));
  } catch {
    // Profile posts still refresh from Supabase if session storage is unavailable.
  }
}

function withTimeout<T>(promise: Promise<T>, timeoutMs: number) {
  return Promise.race<T | null>([
    promise,
    new Promise<null>((resolve) => {
      window.setTimeout(() => resolve(null), timeoutMs);
    }),
  ]);
}

function fetchPlaceSuggestions(
  query: string,
  onSuggestions: (suggestions: PlaceSuggestion[]) => void,
  options: { proximity?: [number, number]; types: string },
) {
  const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;

  if (!token) {
    onSuggestions([]);
    return undefined;
  }

  const controller = new AbortController();
  const timeoutId = window.setTimeout(async () => {
    const params = new URLSearchParams({
      access_token: token,
      autocomplete: "true",
      language: "en",
      limit: "8",
      types: options.types,
    });

    if (options.proximity) {
      params.set("proximity", options.proximity.join(","));
    }

    try {
      const response = await fetch(
        `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(query)}.json?${params.toString()}`,
        { signal: controller.signal },
      );
      const data = (await response.json()) as {
        features?: Array<{
          center?: [number, number];
          place_name?: string;
          text?: string;
        }>;
      };

      onSuggestions(
        data.features?.map((feature) => ({
          center: feature.center,
          description: feature.place_name,
          label: feature.text ?? feature.place_name ?? query,
          query: feature.place_name ?? feature.text ?? query,
        })) ?? [],
      );
    } catch {
      if (!controller.signal.aborted) {
        onSuggestions([]);
      }
    }
  }, 220);

  return () => {
    controller.abort();
    window.clearTimeout(timeoutId);
  };
}

function writeProfileExploreState(posts: AppPost[], isOwnProfile: boolean, profile: AccountWithStats) {
  const center = profile.currentCityCoordinates ?? posts[0]?.coordinates ?? ([-25, 22] as [number, number]);

  try {
    window.sessionStorage.setItem(
      exploreStateStorageKey,
      JSON.stringify({
        activeDestination: "",
        activeCategoryFilters: [],
        activeFilter: isOwnProfile ? "Mine" : "All",
        currentMapView: {
          center,
          zoom: posts.length || profile.currentCityCoordinates ? 4.2 : 1.35,
        },
        exploreSource: "search",
        mapArea: null,
        profileAccountId: isOwnProfile ? null : profile.id,
        profileUsername: isOwnProfile ? null : profile.username,
        searchQuery: "",
        selectedPostId: null,
        sheetPosition: "peek",
      }),
    );
  } catch {
    // Explore still opens normally if session storage is unavailable.
  }
}

function ProfileMapHero({ isOwnProfile, posts, profile }: { isOwnProfile: boolean; posts: AppPost[]; profile: AccountWithStats }) {
  const mapCenter = profile.currentCityCoordinates ?? posts[0]?.coordinates ?? ([-98.5795, 39.8283] as [number, number]);
  const mapZoom = posts.length || profile.currentCityCoordinates ? 2.15 : 1.75;

  return (
    <div className="relative -mx-4 h-[207px] overflow-hidden bg-[#b9ddec]">
      <DynamicMapboxMap
        appPosts={posts}
        className="absolute inset-0 h-full w-full"
        experiences={[]}
        interactive={false}
        mapTarget={{ center: mapCenter, zoom: mapZoom }}
        zoom={mapZoom}
      />
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-white/5 via-white/0 via-56% to-[#fbfaf7]/72" />
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-44 bg-gradient-to-t from-[#fbfaf7] via-[#fbfaf7]/88 via-56% to-transparent" />
      <Link
        aria-label="Open travel map"
        className="absolute inset-0 z-10"
        href="/explore"
        onClick={() => writeProfileExploreState(posts, isOwnProfile, profile)}
      />
      <div className="pointer-events-none absolute left-[39%] top-[34%] z-20 flex h-12 w-12 items-center justify-center rounded-full bg-moss text-lg font-black text-white shadow-lift">
        {Math.max(posts.length, profile.stats.posts)}
      </div>
    </div>
  );
}

function ProfileStat({ label, onClick, value }: { label: string; onClick: () => void; value: number }) {
  return (
    <button className="min-w-[3.7rem] text-center" onClick={onClick} type="button">
      <span className="block text-[15px] font-black leading-none text-ink">{value}</span>
      <span className="mt-1 block text-[11px] font-semibold leading-tight text-ink/58">{label}</span>
    </button>
  );
}

function ProfileRecentCard({ post }: { post: AppPost }) {
  return (
    <div className="relative shrink-0">
      <Link
        className="relative block h-[158px] w-[116px] overflow-hidden rounded-[8px] bg-white text-left shadow-sm ring-1 ring-ink/5"
        href={`/posts/${post.id}`}
      >
        {post.imageUrl ? (
          <>
            <PostMediaPreview
              alt={post.title}
              className="absolute inset-0 h-full w-full object-cover"
              mediaType={post.mediaTypes[0]}
              src={post.imageUrl}
            />
            <span className="absolute inset-x-0 bottom-0 h-[72%] bg-gradient-to-t from-ink via-ink/72 to-transparent" />
            <span className="absolute bottom-2.5 left-2.5 right-2.5 text-white">
              <span className="line-clamp-2 block text-xs font-black leading-tight">{post.title}</span>
              <span className="mt-1.5 flex items-start gap-1 text-[10px] font-semibold leading-tight text-white/88">
                <MapPin aria-hidden="true" className="mt-px shrink-0" size={11} />
                <span className="line-clamp-1">{post.location}</span>
              </span>
            </span>
          </>
        ) : (
          <span className="flex h-full flex-col p-3">
            <span className="line-clamp-3 text-xs font-black leading-tight text-ink">{post.title}</span>
            <span className="mt-2 line-clamp-4 text-[10px] font-semibold leading-snug text-ink/56">{post.caption}</span>
            <span className="mt-auto flex items-start gap-1 text-[10px] font-bold leading-tight text-ink/42">
              <MapPin aria-hidden="true" className="mt-px shrink-0 text-coral" size={11} />
              <span className="line-clamp-2">{post.location}</span>
            </span>
          </span>
        )}
      </Link>
    </div>
  );
}

function ProfileTripCard({ trip }: { trip: AppPost }) {
  const mediaCount = trip.mediaUrls.length || (trip.imageUrl ? 1 : 0);

  return (
    <Link className="block w-[214px] shrink-0 overflow-hidden rounded-[12px] bg-white shadow-lift ring-1 ring-ink/5" href={`/trips/${trip.id}`}>
      <span className="relative block aspect-[1.35] bg-shell">
        {trip.imageUrl ? (
          <>
            <PostMediaPreview alt={trip.title} className="h-full w-full object-cover" mediaType={trip.mediaTypes[0]} src={trip.imageUrl} />
            <span className="absolute inset-x-0 bottom-0 h-[62%] bg-gradient-to-t from-ink/88 via-ink/52 to-transparent" />
            <span className="absolute bottom-3 left-3 right-3 text-white">
              <span className="line-clamp-2 block text-base font-black leading-tight">{trip.title}</span>
              {trip.dateLabel ? <span className="mt-1 block text-xs font-semibold text-white/82">{trip.dateLabel}</span> : null}
            </span>
          </>
        ) : (
          <span className="flex h-full flex-col justify-end p-3">
            <span className="line-clamp-2 text-base font-black leading-tight text-ink">{trip.title}</span>
            {trip.dateLabel ? <span className="mt-1 text-xs font-semibold text-ink/54">{trip.dateLabel}</span> : null}
          </span>
        )}
      </span>
      <span className="block space-y-2 p-3">
        <span className="flex items-start gap-1.5 text-xs font-semibold leading-tight text-ink/58">
          <MapPin aria-hidden="true" className="mt-px shrink-0 text-moss" size={13} />
          <span className="line-clamp-1">{trip.location}</span>
        </span>
        <span className="flex items-center gap-1.5 text-xs font-semibold text-ink/46">
          <Camera aria-hidden="true" size={13} />
          {mediaCount} {mediaCount === 1 ? "memory" : "memories"}
        </span>
      </span>
    </Link>
  );
}

function ProfileGridPostCard({ post }: { post: AppPost }) {
  return (
    <Link
      className="relative block h-[226px] min-h-0 overflow-hidden rounded-[10px] bg-white shadow-sm ring-1 ring-ink/5"
      href={`/posts/${post.id}`}
    >
      {post.imageUrl ? (
        <>
          <PostMediaPreview alt={post.title} className="absolute inset-0 h-full w-full object-cover" mediaType={post.mediaTypes[0]} src={post.imageUrl} />
          <span className="absolute inset-x-0 bottom-0 h-[68%] bg-gradient-to-t from-ink/92 via-ink/58 to-transparent" />
          <span className="absolute bottom-3 left-3 right-3 flex max-h-[5.3rem] flex-col justify-end text-white">
            <span className="line-clamp-2 block text-sm font-black leading-tight">{post.title}</span>
            <span className="mt-1.5 flex min-h-[1rem] items-center gap-1 text-[11px] font-semibold leading-tight text-white/86">
              <MapPin aria-hidden="true" className="shrink-0" size={11} />
              <span className="min-w-0 truncate">{post.location}</span>
            </span>
          </span>
        </>
      ) : (
        <span className="grid h-full grid-rows-[auto_1fr_auto] gap-2 p-3">
          <span className="line-clamp-3 text-sm font-black leading-tight text-ink">{post.title}</span>
          <span className="min-h-0 overflow-hidden">
            <span className="line-clamp-5 text-xs font-semibold leading-snug text-ink/56">{post.caption}</span>
          </span>
          <span className="flex min-h-[2rem] items-start gap-1 text-[11px] font-bold leading-tight text-ink/42">
            <MapPin aria-hidden="true" className="mt-px shrink-0 text-coral" size={11} />
            <span className="line-clamp-2">{post.location}</span>
          </span>
        </span>
      )}
    </Link>
  );
}

function ProfileBoardCard({ board, isOwnProfile }: { board: AppBoard; isOwnProfile: boolean }) {
  const previewImages = [board.previewImageUrls[0], board.previewImageUrls[1], board.previewImageUrls[2]].filter(
    (imageUrl): imageUrl is string => Boolean(imageUrl),
  );
  const fallbackImage = previewImages[0];
  const href = isOwnProfile ? `/boards?board=${encodeURIComponent(board.slug)}` : `/boards/${board.slug}?account=${encodeURIComponent(board.accountId)}`;

  return (
    <Link className="block w-[132px] shrink-0 overflow-hidden rounded-[12px] bg-white shadow-sm ring-1 ring-ink/5" href={href}>
      <span className="grid h-24 w-full grid-cols-[1.15fr_0.85fr] gap-0.5 bg-shell">
        {fallbackImage ? <img alt="" className="h-full min-h-0 w-full object-cover" src={fallbackImage} /> : <span className="h-full min-h-0 w-full bg-ink/10" />}
        <span className="grid min-h-0 grid-rows-2 gap-0.5">
          {previewImages[1] ?? fallbackImage ? (
            <img alt="" className="h-full min-h-0 w-full object-cover" src={previewImages[1] ?? fallbackImage} />
          ) : (
            <span className="h-full min-h-0 w-full bg-ink/10" />
          )}
          {previewImages[2] ?? fallbackImage ? (
            <img alt="" className="h-full min-h-0 w-full object-cover" src={previewImages[2] ?? fallbackImage} />
          ) : (
            <span className="h-full min-h-0 w-full bg-ink/10" />
          )}
        </span>
      </span>
      <span className="block p-3">
        <span className="line-clamp-1 text-sm font-black text-ink">{board.title}</span>
        <span className="mt-1 block text-xs font-bold text-ink/48">
          {board.postIds.length} {board.postIds.length === 1 ? "place" : "places"}
        </span>
      </span>
    </Link>
  );
}

function Avatar({ account }: { account: Pick<AppAccount, "profilePhotoUrl"> }) {
  return (
    <div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-full bg-shell text-ink/45">
      {account.profilePhotoUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img alt="" className="h-full w-full object-cover" src={account.profilePhotoUrl} />
      ) : (
        <UserRound aria-hidden="true" size={22} />
      )}
    </div>
  );
}

function fileToDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}
