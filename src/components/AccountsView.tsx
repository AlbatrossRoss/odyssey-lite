"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, Camera, LogOut, Map, UserPlus, UserRound } from "lucide-react";
import {
  AccountWithStats,
  accountDisplayName,
  clearAccountSessionId,
  fetchAccountsWithStats,
  readAccountSessionId,
  setAccountFollow,
  updateAccountPhoto,
} from "@/lib/accounts";
import { AppPostTile } from "@/components/AppPostCard";
import { BottomNav } from "@/components/BottomNav";
import { MobileFrame } from "@/components/MobileFrame";
import { fetchAppPostsByAccount, type AppPost } from "@/lib/posts";

type AccountsViewProps = {
  username?: string;
};

export function AccountsView({ username }: AccountsViewProps) {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [viewerId, setViewerId] = useState<string | null>(null);
  const [accounts, setAccounts] = useState<AccountWithStats[]>([]);
  const [profilePosts, setProfilePosts] = useState<AppPost[]>([]);
  const [status, setStatus] = useState<"loading" | "ready" | "saving">("loading");
  const [message, setMessage] = useState("");

  const loadAccounts = useCallback(async (sessionId = viewerId) => {
    if (!sessionId) {
      return;
    }

    setStatus("loading");

    try {
      setAccounts(await fetchAccountsWithStats(sessionId));
      setStatus("ready");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to load accounts.");
      setStatus("ready");
    }
  }, [viewerId]);

  useEffect(() => {
    const sessionId = readAccountSessionId();
    setViewerId(sessionId);

    if (!sessionId) {
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
  const isOwnProfile = Boolean(profile && profile.id === viewerId);

  useEffect(() => {
    let active = true;

    if (!profile) {
      setProfilePosts([]);
      return;
    }

    fetchAppPostsByAccount(profile.id)
      .then((posts) => {
        if (active) {
          setProfilePosts(posts);
        }
      })
      .catch(() => {
        if (active) {
          setProfilePosts([]);
        }
      });

    return () => {
      active = false;
    };
  }, [profile]);

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

  function logout() {
    clearAccountSessionId();
    window.location.assign("/");
  }

  return (
    <MobileFrame>
      <section className="safe-page-bottom h-full overflow-y-auto bg-shell">
        <header className="relative h-52 overflow-hidden bg-mist">
          <div className="absolute inset-0 bg-[url('/hawaii-reference-map.png')] bg-cover bg-center opacity-80" />
          <div className="absolute inset-0 bg-gradient-to-b from-white/10 via-white/20 to-shell" />
          <div className="safe-top-bar absolute inset-x-0 top-0 flex items-center justify-between px-5">
            <Link
              aria-label="Back to Explore"
              className="flex h-11 w-11 items-center justify-center rounded-full bg-white/94 text-ink shadow-lift"
              href="/destination/hawaii"
            >
              <ArrowLeft aria-hidden="true" size={20} />
            </Link>
            {isOwnProfile ? (
              <button
                aria-label="Log out"
                className="flex h-11 w-11 items-center justify-center rounded-full bg-white/94 text-ink shadow-lift"
                onClick={logout}
                type="button"
              >
                <LogOut aria-hidden="true" size={19} />
              </button>
            ) : null}
          </div>
        </header>

        <div className="px-5">
          {profile ? (
            <section className="-mt-16">
              <div className="flex items-end justify-between gap-4">
                <div className="relative">
                  <button
                    aria-label="Change profile photo"
                    className="flex h-28 w-28 items-center justify-center overflow-hidden rounded-full border-4 border-shell bg-white text-ink/52 shadow-lift"
                    disabled={!isOwnProfile}
                    onClick={() => fileInputRef.current?.click()}
                    type="button"
                  >
                    {profile.profilePhotoUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img alt="" className="h-full w-full object-cover" src={profile.profilePhotoUrl} />
                    ) : (
                      <UserRound aria-hidden="true" size={42} />
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
                {!isOwnProfile ? (
                  <button
                    className={`mb-3 flex h-11 items-center gap-2 rounded-full px-5 text-sm font-black shadow-lift ${
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
              </div>

              <div className="mt-4">
                <p className="flex items-center gap-2 text-xs font-black uppercase tracking-[0.18em] text-coral">
                  <Map aria-hidden="true" size={14} />
                  Account
                </p>
                <div className="mt-1 flex items-center justify-between gap-3">
                  <h1 className="min-w-0 truncate text-3xl font-black text-ink">{accountDisplayName(profile)}</h1>
                  {isOwnProfile ? (
                    <button
                      className="flex h-10 shrink-0 items-center gap-2 rounded-full bg-white px-4 text-xs font-black text-ink shadow-lift"
                      onClick={logout}
                      type="button"
                    >
                      <LogOut aria-hidden="true" size={15} />
                      Log out
                    </button>
                  ) : null}
                </div>
              </div>

              <div className="mt-5 grid grid-cols-3 gap-3">
                <StatTile label="Followers" value={profile.stats.followers} />
                <StatTile label="Following" value={profile.stats.following} />
                <StatTile label="Posts" value={profile.stats.posts} />
              </div>

              <section className="mt-7 overflow-hidden rounded-[26px] bg-white shadow-lift">
                <div className="flex items-end justify-between border-b border-ink/8 px-4 py-3">
                  <div>
                    <p className="text-xs font-black uppercase tracking-[0.18em] text-coral">Posts</p>
                    <h2 className="text-lg font-black text-ink">Travel grid</h2>
                  </div>
                  <p className="text-xs font-black text-ink/42">{profilePosts.length}</p>
                </div>
                {profilePosts.length ? (
                  <div className="grid grid-cols-3 gap-px bg-white">
                    {profilePosts.map((post) => (
                      <AppPostTile key={post.id} post={post} />
                    ))}
                  </div>
                ) : (
                  <div className="px-5 py-8 text-center">
                    <p className="text-sm font-bold leading-relaxed text-ink/52">
                      {isOwnProfile ? "Share a trip or experience to start your grid." : "No posts here yet."}
                    </p>
                  </div>
                )}
              </section>
            </section>
          ) : (
            <section className="mt-8 rounded-[28px] bg-white p-5 text-center shadow-lift">
              <UserRound aria-hidden="true" className="mx-auto text-ink/40" size={42} />
              <h1 className="mt-3 text-2xl font-black text-ink">Account not found</h1>
              <p className="mt-2 text-sm font-semibold leading-relaxed text-ink/56">This profile may not exist yet.</p>
            </section>
          )}

          {message ? <p className="mt-5 rounded-2xl bg-coral/10 px-4 py-3 text-sm font-bold text-coral">{message}</p> : null}

          {!username && otherAccounts.length ? (
            <section className="mt-7">
              <div className="mb-3 flex items-end justify-between">
                <div>
                  <p className="text-xs font-black uppercase tracking-[0.18em] text-coral">People</p>
                  <h2 className="text-xl font-black text-ink">Accounts to follow</h2>
                </div>
                <button className="text-xs font-black text-ink/50" onClick={() => void loadAccounts()} type="button">
                  Refresh
                </button>
              </div>
              <div className="space-y-3">
                {otherAccounts.map((account) => (
                  <article className="flex items-center gap-3 rounded-[24px] bg-white p-3 shadow-lift" key={account.id}>
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
      <BottomNav activeTab="Accounts" />
    </MobileFrame>
  );
}

function StatTile({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-[22px] bg-white p-4 text-center shadow-lift">
      <p className="text-2xl font-black text-ink">{value}</p>
      <p className="mt-1 text-[11px] font-black uppercase tracking-[0.12em] text-ink/45">{label}</p>
    </div>
  );
}

function Avatar({ account }: { account: AccountWithStats }) {
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
