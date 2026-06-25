import Link from "next/link";
import { Trophy, Zap, Star } from "lucide-react";
import { cn } from "@/lib/utils";
import type { LeaderboardRow, LeaderboardScope } from "@/lib/db/queries/leaderboard";

type Props = {
  scope: LeaderboardScope;
  rows: LeaderboardRow[];
  currentUserId: string;
  myRank: { rank: number; xp: number } | null;
  hasDisplayName: boolean;
};

const nameOf = (r: LeaderboardRow) => r.displayName?.trim() || `Reader · ${r.userId.slice(0, 4)}`;

export function LeaderboardView({ scope, rows, currentUserId, myRank, hasDisplayName }: Props) {
  const top = rows.slice(0, 3);
  const rest = rows.slice(3);
  const podiumOrder = [top[1], top[0], top[2]].filter(Boolean) as LeaderboardRow[];

  return (
    <main className="mx-auto max-w-2xl px-4 pb-24 pt-6 md:pt-8">
      <header className="mb-6">
        <h1 className="font-serif text-3xl font-semibold tracking-tight">Leaderboard</h1>
        <p className="mt-1 text-sm text-fg-muted">
          {scope === "weekly" ? "This week · by XP earned" : "All time · by total XP"}
        </p>
        <div className="mt-4 flex gap-1 rounded-2xl bg-bg-muted p-1">
          <Tab href="?scope=weekly" active={scope === "weekly"}>
            This week
          </Tab>
          <Tab href="?scope=all_time" active={scope === "all_time"}>
            All time
          </Tab>
        </div>
      </header>

      {!hasDisplayName && (
        <div className="mb-5 rounded-2xl bg-brand/5 p-4 text-sm ring-1 ring-brand/20">
          <span className="font-bold">Set a display name</span> in{" "}
          <Link href="/settings" className="text-brand underline">
            Settings
          </Link>{" "}
          so friends can find you here.
        </div>
      )}

      {rows.length === 0 ? (
        <div className="rounded-3xl bg-surface p-12 text-center shadow-card ring-1 ring-border">
          <Trophy className="mx-auto h-10 w-10 text-fg-muted" />
          <p className="mt-3 text-lg font-bold">Be the first</p>
          <p className="mt-1 text-sm text-fg-muted">
            Nobody has earned XP {scope === "weekly" ? "this week" : "yet"}.
          </p>
        </div>
      ) : (
        <>
          {/* Podium */}
          <div className="mb-4 grid grid-cols-3 items-end gap-3">
            {podiumOrder.map((r) => {
              const rank = rows.indexOf(r) + 1;
              const me = r.userId === currentUserId;
              const h = rank === 1 ? "h-24" : rank === 2 ? "h-20" : "h-16";
              return (
                <div key={r.userId} className="flex flex-col items-center text-center">
                  <Avatar row={r} me={me} rank={rank} />
                  <p className="mt-2 max-w-full truncate text-sm font-bold">{nameOf(r)}</p>
                  <p className="text-xs text-fg-muted">{r.xp.toLocaleString()} XP</p>
                  <div
                    className={cn(
                      "mt-2 grid w-full place-items-center rounded-t-2xl text-lg font-black",
                      h,
                      me ? "bg-brand text-brand-fg" : "bg-bg-muted text-fg-muted",
                    )}
                  >
                    {rank}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Ranked rows */}
          <ol className="space-y-2">
            {rest.map((r, i) => {
              const rank = i + 4;
              const me = r.userId === currentUserId;
              return (
                <li
                  key={r.userId}
                  className={cn(
                    "flex items-center gap-3 rounded-2xl p-3 shadow-card ring-1 transition",
                    me ? "bg-brand/10 ring-brand/40" : "bg-surface ring-border",
                  )}
                >
                  <span className="w-6 shrink-0 text-center text-sm font-black text-fg-muted">{rank}</span>
                  <Avatar row={r} me={me} rank={rank} small />
                  <p className="min-w-0 flex-1 truncate font-bold">
                    {nameOf(r)}
                    {me && (
                      <span className="ml-1.5 rounded-full bg-brand px-2 py-0.5 text-[10px] uppercase tracking-widest text-brand-fg">
                        you
                      </span>
                    )}
                  </p>
                  <span className="inline-flex shrink-0 items-center gap-1 rounded-xl bg-accent-soft px-3 py-1.5 font-extrabold text-accent-fg">
                    <Zap className="h-3.5 w-3.5" />
                    {r.xp.toLocaleString()}
                  </span>
                </li>
              );
            })}
          </ol>
        </>
      )}

      {myRank && myRank.rank > rows.length && (
        <div className="mt-4 rounded-2xl bg-brand/5 p-4 text-center ring-1 ring-brand/20">
          <p className="text-xs font-bold uppercase tracking-widest text-brand">Your rank</p>
          <p className="mt-1 text-2xl font-extrabold">#{myRank.rank.toLocaleString()}</p>
          <p className="text-sm text-fg-muted">
            {myRank.xp.toLocaleString()} XP {scope === "weekly" ? "this week" : "all time"}
          </p>
        </div>
      )}
    </main>
  );
}

function Avatar({ row, me, rank, small }: { row: LeaderboardRow; me: boolean; rank: number; small?: boolean }) {
  const size = small ? "h-10 w-10 text-sm" : "h-14 w-14 text-lg";
  const bg = me
    ? "bg-gradient-to-br from-brand to-brand-dark text-brand-fg"
    : rank === 1
      ? "bg-accent text-accent-fg"
      : rank === 2
        ? "bg-iris text-iris-fg"
        : rank === 3
          ? "bg-flame text-white"
          : "bg-bg-muted text-fg-muted";
  return (
    <span className={cn("grid shrink-0 place-items-center rounded-full font-bold shadow-soft", size, bg)}>
      {me ? <Star className={small ? "h-4 w-4" : "h-6 w-6"} /> : nameOf(row)[0]?.toUpperCase()}
    </span>
  );
}

function Tab({ href, active, children }: { href: string; active: boolean; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className={cn(
        "flex-1 rounded-xl px-4 py-2 text-center text-sm font-bold transition",
        active ? "bg-surface text-fg shadow-soft" : "text-fg-muted hover:text-fg",
      )}
    >
      {children}
    </Link>
  );
}
