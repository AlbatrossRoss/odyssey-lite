"use client";

import { Compass, Home, Plus, SquareStack } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

const navItems = [
  { label: "Home", href: "/", icon: Home },
  { label: "Explore", href: "/destination/hawaii", icon: Compass },
  { label: "Create", href: "/create", icon: Plus },
  { label: "Boards", href: "/boards", icon: SquareStack },
];

type BottomNavProps = {
  activeTab?: "Home" | "Explore" | "Create" | "Boards";
};

export function BottomNav({ activeTab }: BottomNavProps) {
  const pathname = usePathname();

  return (
    <nav className="safe-bottom absolute inset-x-0 bottom-0 z-40 border-t border-white/60 bg-white/94 px-5 pt-2 shadow-[0_-10px_30px_rgba(24,35,31,0.08)] backdrop-blur-xl">
      <div className="mx-auto flex max-w-80 items-center justify-between">
        {navItems.map((item) => {
          const Icon = item.icon;
          const active = activeTab ? activeTab === item.label : pathname === item.href || (item.href !== "/" && pathname.startsWith(item.href));

          return (
            <Link
              aria-label={item.label}
              className={`flex h-12 w-16 flex-col items-center justify-center gap-0.5 rounded-2xl text-[11px] font-semibold transition ${
                active ? "bg-ink text-white" : "text-ink/60 hover:bg-ink/5 hover:text-ink"
              }`}
              href={item.href}
              key={item.label}
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
