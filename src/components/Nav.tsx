"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, Users, CalendarClock, Plus, LogOut } from "lucide-react";
import { signOut } from "@/app/actions";
import { Logo } from "./Logo";
import { useAppData } from "./AppData";
import { initials } from "@/lib/format";

const ITEMS = [
  { href: "/", label: "Home", icon: Home, match: (p: string) => p === "/" },
  { href: "/leads", label: "Leads", icon: Users, match: (p: string) => p.startsWith("/leads") && p !== "/leads/new" },
  { href: "/follow-ups", label: "Follow-Ups", icon: CalendarClock, match: (p: string) => p.startsWith("/follow-ups") },
  { href: "/leads/new", label: "Add Lead", icon: Plus, match: (p: string) => p === "/leads/new" },
];

export function MobileHeader() {
  const { me } = useAppData();
  return (
    <header className="sticky top-0 z-30 bg-navy-950 pt-[env(safe-area-inset-top)] md:hidden">
      <div className="flex h-[68px] items-center justify-between px-4">
        <Link href="/" aria-label="Home" className="flex items-center gap-3">
          <Logo tone="onDark" className="h-12 w-auto" />
          <span className="h-8 w-px bg-white/20" />
          <span className="text-[11px] font-semibold uppercase leading-tight tracking-label text-white/70">
            Lead
            <br />
            Tracker
          </span>
        </Link>
        <form action={signOut}>
          <button
            className="flex h-11 items-center gap-2 rounded-md px-2 text-white/80 active:bg-white/10"
            aria-label="Sign out"
            title="Sign out"
          >
            <span className="flex h-8 w-8 items-center justify-center rounded-md bg-white/10 text-xs font-bold text-white">
              {initials(me?.full_name)}
            </span>
            <LogOut className="h-5 w-5" />
          </button>
        </form>
      </div>
      {/* thin line motif echoing the logo's linework */}
      <div className="h-[3px] bg-gradient-to-r from-white/0 via-white/25 to-white/0" />
    </header>
  );
}

export function BottomNav({ dueCount }: { dueCount: number }) {
  const path = usePathname();
  return (
    <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-navy-200 bg-white pb-[env(safe-area-inset-bottom)] md:hidden">
      <ul className="grid h-[68px] grid-cols-4">
        {ITEMS.map((item) => {
          const active = item.match(path);
          const Icon = item.icon;
          const isAdd = item.href === "/leads/new";
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                className={`relative flex h-full flex-col items-center justify-center gap-1 text-[11px] font-bold uppercase tracking-wide ${
                  active ? "text-navy-950" : "text-navy-400"
                }`}
              >
                {isAdd ? (
                  <span className={`flex h-9 w-9 items-center justify-center rounded-md ${active ? "bg-navy-700" : "bg-navy-950"} text-white`}>
                    <Icon className="h-6 w-6" strokeWidth={2.5} />
                  </span>
                ) : (
                  <span className="relative">
                    <Icon className="h-6 w-6" strokeWidth={active ? 2.5 : 2} />
                    {item.href === "/follow-ups" && dueCount > 0 && (
                      <span className="absolute -right-3 -top-1.5 min-w-[20px] rounded-full bg-red-600 px-1.5 text-center text-[11px] font-bold leading-5 text-white">
                        {dueCount > 99 ? "99+" : dueCount}
                      </span>
                    )}
                  </span>
                )}
                {item.label}
                {active && !isAdd && <span className="absolute top-0 h-[3px] w-10 bg-navy-950" />}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

export function Sidebar({ dueCount }: { dueCount: number }) {
  const path = usePathname();
  const { me } = useAppData();
  return (
    <aside className="sticky top-0 hidden h-dvh w-64 shrink-0 flex-col bg-navy-950 px-4 py-6 md:flex">
      <Link href="/" className="mb-2 flex justify-center px-2">
        <Logo tone="onDark" className="h-28 w-auto" />
      </Link>
      <p className="mb-8 text-center text-[11px] font-semibold uppercase tracking-label text-white/50">Lead Tracker</p>
      <ul className="space-y-1">
        {ITEMS.map((item) => {
          const active = item.match(path);
          const Icon = item.icon;
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                className={`flex h-12 items-center gap-3 rounded-md px-3 text-sm font-bold uppercase tracking-wider ${
                  active ? "bg-white text-navy-950" : "text-white/75 hover:bg-white/10"
                }`}
              >
                <Icon className="h-5 w-5" />
                <span className="flex-1">{item.label}</span>
                {item.href === "/follow-ups" && dueCount > 0 && (
                  <span className="rounded-full bg-red-600 px-2 text-xs leading-5 text-white">{dueCount}</span>
                )}
              </Link>
            </li>
          );
        })}
      </ul>
      <div className="mt-auto border-t border-white/10 pt-4">
        <p className="truncate px-3 text-sm text-white/80">{me?.full_name ?? me?.email}</p>
        <form action={signOut}>
          <button className="mt-2 flex h-11 w-full items-center gap-3 rounded-md px-3 text-sm font-semibold text-white/60 hover:bg-white/10">
            <LogOut className="h-4 w-4" /> Sign out
          </button>
        </form>
      </div>
    </aside>
  );
}
