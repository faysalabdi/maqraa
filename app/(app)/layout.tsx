import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Flame, BookOpen, Sparkles, Settings as SettingsIcon, BarChart3 } from "lucide-react";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <div className="min-h-screen bg-bg">
      <header className="sticky top-0 z-30 border-b border-border bg-white/80 backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3">
          <Link href="/path" className="flex items-center gap-2 font-bold">
            <span className="grid h-8 w-8 place-items-center rounded-lg bg-brand text-brand-fg">
              <BookOpen className="h-5 w-5" />
            </span>
            <span>arabic-xp</span>
          </Link>

          <nav className="flex items-center gap-1 text-sm font-medium">
            <NavLink href="/path" icon={<Sparkles className="h-4 w-4" />}>
              Path
            </NavLink>
            <NavLink href="/review" icon={<Flame className="h-4 w-4" />}>
              Review
            </NavLink>
            <NavLink href="/stats" icon={<BarChart3 className="h-4 w-4" />}>
              Stats
            </NavLink>
            <NavLink href="/settings" icon={<SettingsIcon className="h-4 w-4" />}>
              Settings
            </NavLink>
          </nav>

          <div className="text-sm text-fg-muted">{user?.email ?? ""}</div>
        </div>
      </header>
      {children}
    </div>
  );
}

function NavLink({
  href,
  icon,
  children,
}: {
  href: string;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-fg-muted transition hover:bg-bg-muted hover:text-fg"
    >
      {icon}
      <span className="hidden sm:inline">{children}</span>
    </Link>
  );
}
