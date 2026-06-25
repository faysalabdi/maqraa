"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Logo } from "@/components/brand/Logo";
import { Sidebar } from "./Sidebar";
import { MobileNav } from "./MobileNav";
import { ThemeToggle } from "./ThemeToggle";

export type ShellData = {
  signedIn: boolean;
  name: string | null;
  email: string | null;
  avatarLetter: string;
  reviewDue: number;
  canUpload: boolean;
};

// The reader is distraction-free: it escapes the sidebar / tab bar / top bar and
// renders its own chrome.
const isImmersive = (path: string) => /^\/book\/[^/]+\/read(\/|$)/.test(path);

export function AppShell({ children, data }: { children: React.ReactNode; data: ShellData }) {
  const pathname = usePathname();
  if (isImmersive(pathname)) return <>{children}</>;

  return (
    <div className="md:pl-64">
      <Sidebar
        name={data.name}
        email={data.email}
        avatarLetter={data.avatarLetter}
        reviewDue={data.reviewDue}
        canUpload={data.canUpload}
      />

      <header className="sticky top-0 z-30 flex items-center gap-3 border-b border-border bg-bg/80 px-4 py-2.5 backdrop-blur-md md:hidden">
        <Link href="/path" className="shrink-0">
          <Logo />
        </Link>
        <div className="ml-auto flex items-center gap-1">
          <ThemeToggle />
          {data.signedIn && (
            <Link
              href="/settings"
              className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-gradient-to-br from-brand to-brand-dark text-sm font-bold text-brand-fg shadow-soft"
            >
              {data.avatarLetter}
            </Link>
          )}
        </div>
      </header>

      <main className="pb-24 md:pb-12">{children}</main>
      <MobileNav />
    </div>
  );
}
