"use client";

import { ChevronRight, Map, MapPin, Plus, Search, SquareStack, UserRound, X } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { fetchAccountById, readAccountSessionId, type AppAccount } from "@/lib/accounts";

const navItems = [
  { activeKey: "Explore", label: "Explore", href: "/explore", icon: Search },
  { activeKey: "Boards", label: "Boards", href: "/boards", icon: SquareStack },
  { activeKey: "Create", label: "Post", href: "/create", icon: Plus },
  { activeKey: "Accounts", label: "Profile", href: "/accounts", icon: UserRound },
];

type BottomNavProps = {
  activeTab?: "Explore" | "Create" | "Post" | "Boards" | "Accounts" | "Profile";
  onExploreClick?: () => void;
};

export function BottomNav({ activeTab, onExploreClick }: BottomNavProps) {
  const pathname = usePathname();
  const [account, setAccount] = useState<AppAccount | null>(null);
  const [createMenuOpen, setCreateMenuOpen] = useState(false);

  useEffect(() => {
    let active = true;

    async function loadAccount() {
      const accountId = readAccountSessionId();

      if (!accountId) {
        setAccount(null);
        return;
      }

      try {
        const nextAccount = await fetchAccountById(accountId);

        if (active) {
          setAccount(nextAccount);
        }
      } catch {
        if (active) {
          setAccount(null);
        }
      }
    }

    void loadAccount();

    function handleSessionChange() {
      void loadAccount();
    }

    window.addEventListener("odyssey:account-session-changed", handleSessionChange);

    return () => {
      active = false;
      window.removeEventListener("odyssey:account-session-changed", handleSessionChange);
    };
  }, []);

  useEffect(() => {
    setCreateMenuOpen(false);
  }, [pathname]);

  return (
    <nav className="pointer-events-none fixed inset-x-0 bottom-0 z-40 border-t border-transparent bg-transparent px-5 pt-3 sm:absolute">
      {createMenuOpen ? <CreateShareSheet onClose={() => setCreateMenuOpen(false)} /> : null}
      <div className="bottom-nav-surface" />
      <div className="bottom-nav-content relative z-10 mx-auto grid max-w-[22rem] grid-cols-4 items-end gap-2">
        {navItems.map((item) => {
          const Icon = item.icon;
          const active = activeTab
            ? activeTab === item.activeKey || activeTab === item.label
            : pathname === item.href || (item.href !== "/" && pathname.startsWith(item.href));
          const isCreate = item.activeKey === "Create";
          const isAccounts = item.activeKey === "Accounts";

          if (isCreate) {
            return (
              <div className="pointer-events-auto relative mx-auto flex h-[54px] min-w-0 flex-col items-center justify-end gap-1 text-center" key={item.label}>
                <button
                  aria-expanded={createMenuOpen}
                  aria-label="Post"
                  className="flex h-[54px] min-w-0 flex-col items-center justify-end gap-1 text-center transition"
                  onClick={() => setCreateMenuOpen((open) => !open)}
                  type="button"
                >
                  <span className={`flex h-11 w-11 min-w-11 items-center justify-center rounded-full shadow-lift transition ${active ? "bg-coral text-white" : "bg-ink text-white hover:bg-ink/88"}`}>
                    <Icon aria-hidden="true" size={22} strokeWidth={2.8} />
                  </span>
                  <span className={`max-w-full truncate text-[10px] font-medium leading-none ${active ? "text-ink" : "text-ink/58"}`}>{item.label}</span>
                </button>
              </div>
            );
          }

          return (
            <Link
              aria-label={item.label}
              className="pointer-events-auto mx-auto flex h-[54px] min-w-0 flex-col items-center justify-end gap-1 text-center transition"
              href={item.href}
              key={item.label}
              onClick={item.activeKey === "Explore" ? onExploreClick : undefined}
            >
              <span
                className={`flex h-11 w-11 min-w-11 items-center justify-center rounded-full transition ${
                  isCreate
                    ? `shadow-lift ${active ? "bg-coral text-white" : "bg-ink text-white hover:bg-ink/88"}`
                    : active
                      ? "bg-white/82 text-ink shadow-lift backdrop-blur"
                      : "bg-transparent text-ink/72 hover:text-ink"
                }`}
              >
                {isAccounts && account?.profilePhotoUrl ? (
                  <img
                    alt=""
                    className={`rounded-full object-cover ${active ? "h-8 w-8 ring-2 ring-ink/8" : "h-7 w-7"}`}
                    src={account.profilePhotoUrl}
                  />
                ) : (
                  <Icon aria-hidden="true" size={22} strokeWidth={isCreate ? 2.8 : 2.2} />
                )}
              </span>
              <span className={`max-w-full truncate text-[10px] font-medium leading-none ${active ? "text-ink" : "text-ink/58"}`}>{item.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

function CreateShareSheet({ onClose }: { onClose: () => void }) {
  return (
    <section className="pointer-events-auto fixed inset-0 z-50 flex items-end bg-ink/48 sm:absolute">
      <button aria-label="Close post options" className="absolute inset-0 cursor-default" onClick={onClose} type="button" />
      <div className="relative w-full rounded-t-[24px] bg-white px-5 pb-[calc(var(--safe-area-bottom)+1.1rem)] pt-3 shadow-[0_-18px_54px_rgba(24,35,31,0.24)]">
        <div className="mx-auto mb-6 h-1 w-10 rounded-full bg-ink/18" />
        <button aria-label="Close post options" className="absolute right-5 top-4 grid h-9 w-9 place-items-center rounded-full text-ink" onClick={onClose} type="button">
          <X aria-hidden="true" size={22} />
        </button>
        <h2 className="pr-10 text-xl font-black leading-tight text-ink">What would you like to share?</h2>

        <div className="mt-6 divide-y divide-ink/8">
          <ShareOptionCard
            href="/create"
            onClick={onClose}
            subtitle="Share a place, activity, or experience."
            title="Share a Recommendation"
            variant="recommendation"
          />
          <ShareOptionCard
            href="/create/trip"
            onClick={onClose}
            subtitle="Share an entire trip with stops and recommendations."
            title="Share Your Trip"
            variant="trip"
          />
        </div>
      </div>
    </section>
  );
}

function ShareOptionCard({
  href,
  onClick,
  subtitle,
  title,
  variant,
}: {
  href: string;
  onClick: () => void;
  subtitle: string;
  title: string;
  variant: "recommendation" | "trip";
}) {
  const isRecommendation = variant === "recommendation";
  const Icon = isRecommendation ? MapPin : Map;

  return (
    <Link
      className="group grid min-h-[104px] grid-cols-[5.4rem_1fr_2rem] items-center gap-3 py-4 text-left text-ink transition active:scale-[0.99]"
      href={href}
      onClick={onClick}
    >
      <span className="grid h-20 w-20 place-items-center rounded-[10px] bg-[#eef4ea] text-moss">
        <Icon aria-hidden="true" size={40} strokeWidth={2.1} />
      </span>
      <span className="min-w-0">
        <span className="block text-base font-black leading-tight">{title}</span>
        <span className="mt-2 block text-sm font-semibold leading-relaxed text-ink/72">{subtitle}</span>
      </span>
      <ChevronRight aria-hidden="true" className="justify-self-end text-ink transition group-active:translate-x-0.5" size={24} />
    </Link>
  );
}
