"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { href: "/admin/games/giveaway", label: "List-Pack-Shoot" },
  { href: "/admin/games/survivor", label: "Survivor" },
  { href: "/admin/games/escape-luna", label: "Escape Luna" },
  { href: "/admin/games/red-light", label: "Red Light" },
  { href: "/admin/games/wheel", label: "Wheel of Hype" },
  { href: "/admin/games/giveaway-wheel", label: "Giveaway Wheel" },
] as const;

export default function AdminGamesLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center gap-2 border-b border-neutral-200 pb-4">
        {TABS.map((tab) => {
          const active =
            pathname === tab.href || pathname.startsWith(`${tab.href}/`);
          return (
            <Link
              key={tab.href}
              href={tab.href}
              className={`text-[10px] uppercase tracking-widest px-3 py-1.5 border transition-colors ${
                active
                  ? "bg-black text-white border-black"
                  : "bg-white text-neutral-500 border-neutral-200 hover:border-neutral-400 hover:text-black"
              }`}
            >
              {tab.label}
            </Link>
          );
        })}
      </div>
      {children}
    </div>
  );
}
