"use client";

import { Plus, Search, SquareStack, UserRound } from "lucide-react";
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

  return (
    <nav className="pointer-events-none fixed inset-x-0 bottom-0 z-40 border-t border-transparent bg-transparent px-5 pt-3 sm:absolute">
      <div className="bottom-nav-surface" />
      <div className="bottom-nav-content relative z-10 mx-auto grid max-w-[22rem] grid-cols-4 items-end gap-2">
        {navItems.map((item) => {
          const Icon = item.icon;
          const active = activeTab
            ? activeTab === item.activeKey || activeTab === item.label
            : pathname === item.href || (item.href !== "/" && pathname.startsWith(item.href));
          const isCreate = item.activeKey === "Create";
          const isAccounts = item.activeKey === "Accounts";

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
