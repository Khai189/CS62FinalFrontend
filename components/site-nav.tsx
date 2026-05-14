"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuthSession } from "@/lib/auth-session";

function navClasses(active: boolean) {
  return active
    ? "rounded-full bg-ink px-4 py-2 text-sm font-semibold text-white"
    : "rounded-full bg-white/80 px-4 py-2 text-sm font-semibold text-slate transition hover:bg-white";
}

export function SiteNav() {
  const pathname = usePathname();
  const { currentUser } = useAuthSession();

  return (
    <header className="sticky top-0 z-40 border-b border-white/60 bg-[rgba(248,240,227,0.82)] backdrop-blur-xl">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-4 md:px-8">
        <div className="flex items-center gap-3">
          <Link href="/" className="text-lg font-semibold tracking-[0.12em] text-ink">
            5CBid
          </Link>
          <span className="hidden rounded-full bg-white/70 px-3 py-1 text-xs font-medium text-slate md:inline-flex">
            Campus marketplace
          </span>
        </div>

        <nav className="flex items-center gap-2">
          <Link href="/" className={navClasses(pathname === "/")}>
            Marketplace
          </Link>
          <Link href="/activity" className={navClasses(pathname === "/activity")}>
            Activity
          </Link>
          <Link href="/history" className={navClasses(pathname === "/history")}>
            History
          </Link>
          <Link href="/expired" className={navClasses(pathname === "/expired")}>
            Expired
          </Link>
          <Link href="/profile" className={navClasses(pathname === "/profile")}>
            Profile
          </Link>
        </nav>

        <div className="hidden text-right text-sm text-slate md:block">
          <p>{currentUser ? currentUser.displayName : "Guest"}</p>
          <p className="text-xs uppercase tracking-[0.22em] text-slate/80">
            {currentUser ? currentUser.role.toLowerCase() : "signed out"}
          </p>
        </div>
      </div>
    </header>
  );
}
