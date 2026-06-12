"use client";

import { History, Plus, Search, SquareStack, UserRound } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { fetchAccountById, readAccountSessionId, type AppAccount } from "@/lib/accounts";

const navItems = [
  { label: "Explore", href: "/destination/hawaii", icon: Search },
  { label: "Boards", href: "/boards", icon: SquareStack },
  { label: "Create", href: "/create", icon: Plus },
  { label: "Accounts", href: "/accounts", icon: UserRound },
  { label: "Versions", href: "/versions", icon: History },
];

type BottomNavProps = {
  activeTab?: "Explore" | "Create" | "Boards" | "Accounts" | "Versions";
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
    <nav className="safe-bottom chin-fill fixed inset-x-0 z-40 border-t border-white/60 bg-white px-5 pt-3 shadow-[0_-10px_30px_rgba(24,35,31,0.08)] backdrop-blur-xl sm:absolute">
      <div className="chin-nav-content mx-auto grid max-w-[22rem] grid-cols-5 items-center gap-2">
        {navItems.map((item) => {
          const Icon = item.icon;
          const active = activeTab ? activeTab === item.label : pathname === item.href || (item.href !== "/" && pathname.startsWith(item.href));
          const isCreate = item.label === "Create";
          const isAccounts = item.label === "Accounts";

          return (
            <Link
              aria-label={item.label}
              className={`mx-auto flex items-center justify-center rounded-full transition ${
                isCreate
                  ? `h-16 w-16 shadow-lift ${active ? "bg-coral text-white" : "bg-ink text-white hover:bg-ink/88"}`
                  : `h-12 w-12 ${active ? "bg-ink text-white" : "text-ink/58 hover:bg-ink/5 hover:text-ink"}`
              }`}
              href={item.href}
              key={item.label}
              onClick={item.label === "Explore" ? onExploreClick : undefined}
            >
              {isAccounts && account?.profilePhotoUrl ? (
                <img
                  alt=""
                  className={`h-8 w-8 rounded-full object-cover ${active ? "ring-2 ring-white" : "ring-2 ring-transparent"}`}
                  src={account.profilePhotoUrl}
                />
              ) : (
                <Icon aria-hidden="true" size={isCreate ? 30 : 24} strokeWidth={isCreate ? 2.4 : 2.2} />
              )}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
