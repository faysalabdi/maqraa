import Link from "next/link";
import { Trophy, Zap, Sparkles, Crown, Medal } from "lucide-react";
import { cn } from "@/lib/utils";
import type { LeaderboardRow, LeaderboardScope } from "@/lib/db/queries/leaderboard";

type Props = {
  scope: LeaderboardScope;
  rows: LeaderboardRow[];
  currentUserId: string;
  myRank: { rank: number; xp: number } | null;
  hasDisplayName: boolean;
};

export function LeaderboardView({
  scope,
  rows,
  currentUserId,
  myRank,
  hasDisplayName,
}: Props) {
  return (
    <main className="mx-auto max-w-2xl px-4 pb-24 pt-6">
      <header className="mb-6 rounded-3xl bg-gradient-to-br from-amber-100 via-amber-50 to-white p-6 shadow-lift ring-1 ring-amber-200">
        <div className="flex items-center gap-4">
          <span className="grid h-14 w-14 place-items-center rounded-2xl bg-gradient-to-br from-amber-400 to-amber-600 text-white shadow-soft">
            <Trophy className="h-7 w-7" />
          </span>
          <div>
            <p className="text-xs font-bold uppercase tracking-widest text-amber-700">
              Leaderboard
            </p>
            <h1 className="text-2xl font-extrabold">
              {scope === "weekly" ? "This week" : "All time"}
            </h1>
            <p className="text-sm text-fg-muted">
              {scope === "weekly"
                ? "XP earned since Monday."
                : "Total XP earned since you started."}
            </p>
          </div>
        </div>

        {/* Tabs */}
        <div className="mt-4 flex gap-1 rounded-2xl bg-white/70 p-1 ring-1 ring-amber-200">
          <Tab href="?scope=weekly" active={scope === "weekly"}>
            This week
          </Tab>
          <Tab href="?scope=all_time" active={scope === "all_time"}>
            All time
          </Tab>
        </div>
      </header>

      {!hasDisplayName && (
        <div className="mb-4 flex items-start gap-3 rounded-2xl bg-brand/5 p-4 ring-1 ring-brand/20">
          <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-brand" />
          <p className="text-sm leading-relaxed">
            <span className="font-bold">Set a display name </span>
            in <Link href="/settings" className="text-brand underline">
              Settings
            </Link>{" "}
            so friends can find you here.
          </p>
        </div>
      )}

      {rows.length === 0 ? (
        <div className="rounded-3xl bg-white p-12 text-center shadow-soft ring-1 ring-border">
          <Trophy className="mx-auto h-10 w-10 text-fg-muted" />
          <p className="mt-3 text-lg font-bold">Be the first</p>
          <p className="mt-1 text-sm text-fg-muted">
            Nobody has earned XP {scope === "weekly" ? "this week" : "yet"}.
          </p>
        </div>
      ) : (
        <ol className="space-y-2">
          {rows.map((row, i) => (
            <Row
              key={row.userId}
              rank={i + 1}
              row={row}
              isMe={row.userId === currentUserId}
            />
          ))}
        </ol>
      )}

      {myRank && myRank.rank > rows.length && (
        <div className="mt-4 rounded-2xl bg-brand/5 p-4 text-center ring-1 ring-brand/20">
          <p className="text-xs font-bold uppercase tracking-widest text-brand">
            Your rank
          </p>
          <p className="mt-1 text-2xl font-extrabold">
            #{myRank.rank.toLocaleString()}
          </p>
          <p className="text-sm text-fg-muted">
            {myRank.xp.toLocaleString()} XP{" "}
            {scope === "weekly" ? "this week" : "all time"}
          </p>
        </div>
      )}
    </main>
  );
}

function Tab({
  href,
  active,
  children,
}: {
  href: string;
  active: boolean;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className={cn(
        "flex-1 rounded-xl px-4 py-2 text-center text-sm font-bold transition",
        active ? "bg-brand text-brand-fg shadow-soft" : "text-fg-muted hover:text-fg",
      )}
    >
      {children}
    </Link>
  );
}

function Row({
  rank,
  row,
  isMe,
}: {
  rank: number;
  row: LeaderboardRow;
  isMe: boolean;
}) {
  const name = row.displayName?.trim() || `Reader · ${row.userId.slice(0, 4)}`;
  const initial = name[0]?.toUpperCase() ?? "?";

  let rankBadge: React.ReactNode;
  if (rank === 1) {
    rankBadge = (
      <span className="grid h-10 w-10 place-items-center rounded-xl bg-gradient-to-br from-amber-300 to-amber-500 text-white shadow-soft">
        <Crown className="h-5 w-5" />
      </span>
    );
  } else if (rank === 2) {
    rankBadge = (
      <span className="grid h-10 w-10 place-items-center rounded-xl bg-gradient-to-br from-zinc-300 to-zinc-400 text-white shadow-soft">
        <Medal className="h-5 w-5" />
      </span>
    );
  } else if (rank === 3) {
    rankBadge = (
      <span className="grid h-10 w-10 place-items-center rounded-xl bg-gradient-to-br from-orange-300 to-orange-500 text-white shadow-soft">
        <Medal className="h-5 w-5" />
      </span>
    );
  } else {
    rankBadge = (
      <span className="grid h-10 w-10 place-items-center rounded-xl bg-bg-muted text-sm font-black text-fg-muted ring-1 ring-border">
        {rank}
      </span>
    );
  }

  return (
    <li
      className={cn(
        "flex items-center gap-3 rounded-2xl p-3 shadow-soft ring-1 transition",
        isMe ? "bg-brand/10 ring-brand/40 shadow-glow-brand" : "bg-white ring-border",
      )}
    >
      {rankBadge}

      <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-gradient-to-br from-brand to-brand-dark text-sm font-bold text-brand-fg shadow-soft">
        {initial}
      </span>

      <div className="min-w-0 flex-1">
        <p className="truncate font-extrabold">
          {name}
          {isMe && (
            <span className="ml-1.5 rounded-full bg-brand px-2 py-0.5 text-[10px] uppercase tracking-widest text-brand-fg">
              you
            </span>
          )}
        </p>
        <span className="inline-flex items-center gap-1 text-xs font-bold text-fg-muted">
          <Sparkles className="h-3 w-3" />
          Lv {row.currentLevel}
        </span>
      </div>

      <span className="inline-flex shrink-0 items-center gap-1 rounded-xl bg-accent/15 px-3 py-1.5 font-extrabold text-accent-fg ring-1 ring-accent/30">
        <Zap className="h-3.5 w-3.5" />
        {row.xp.toLocaleString()}
      </span>
    </li>
  );
}
