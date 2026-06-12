"use client";

import { History, Plus, Search, SquareStack, UserRound } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

const navItems = [
  { label: "Explore", href: "/destination/hawaii", icon: Search },
  { label: "Create", href: "/create", icon: Plus },
  { label: "Boards", href: "/boards", icon: SquareStack },
  { label: "Accounts", href: "/accounts", icon: UserRound },
  { label: "Versions", href: "/versions", icon: History },
];

type BottomNavProps = {
  activeTab?: "Explore" | "Create" | "Boards" | "Accounts" | "Versions";
  onExploreClick?: () => void;
};

export function BottomNav({ activeTab, onExploreClick }: BottomNavProps) {
  const pathname = usePathname();

  return (
    <nav className="safe-bottom chin-fill fixed inset-x-0 z-40 border-t border-white/60 bg-white px-5 pt-2 shadow-[0_-10px_30px_rgba(24,35,31,0.08)] backdrop-blur-xl sm:absolute">
      <div className="chin-nav-content mx-auto flex max-w-[22rem] items-center justify-between">
        {navItems.map((item) => {
          const Icon = item.icon;
          const active = activeTab ? activeTab === item.label : pathname === item.href || (item.href !== "/" && pathname.startsWith(item.href));

          return (
            <Link
              aria-label={item.label}
              className={`flex h-12 w-[60px] flex-col items-center justify-center gap-0.5 rounded-2xl text-[10px] font-semibold transition ${
                active ? "bg-ink text-white" : "text-ink/60 hover:bg-ink/5 hover:text-ink"
              }`}
              href={item.href}
              key={item.label}
              onClick={item.label === "Explore" ? onExploreClick : undefined}
            >
              <Icon aria-hidden="true" size={18} strokeWidth={2.2} />
              <span>{item.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
