import Link from "next/link";
import { redirect } from "next/navigation";
import { Clock, Flame, Medal } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getLeaderboard, type LeaderRow } from "@/server/core/leaderboard";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

// Podium order on screen is 2nd, 1st, 3rd — same medals and heights the iOS
// leaderboard tab uses, so the two clients read as one product.
const MEDALS = ["#c0c4cc", "#f0c869", "#d08a52"];
const PEDESTAL_H = ["6rem", "7.75rem", "4.875rem"];

function hoursUntilReset(): string {
  const now = new Date();
  const monday = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + ((8 - now.getUTCDay()) % 7 || 7)),
  );
  const ms = monday.getTime() - now.getTime();
  const days = Math.floor(ms / 86_400_000);
  const hours = Math.floor((ms % 86_400_000) / 3_600_000);
  if (days > 0) return `${days}d ${hours}h left`;
  return hours <= 1 ? "under an hour left" : `${hours}h left`;
}

export default async function LeaderboardPage({
  searchParams,
}: {
  searchParams: Promise<{ scope?: string }>;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/sign-in?redirect=/leaderboard");

  const { scope: raw } = await searchParams;
  const scope = raw === "all" ? "all" : "week";
  const { rows, you } = await getLeaderboard({ id: user.id, email: user.email ?? null }, scope);

  const podium = rows.slice(0, 3);
  const rest = rows.slice(3);
  const weekly = scope === "week";

  return (
    <main className="mx-auto max-w-3xl px-4 pb-24 pt-6 md:pt-8">
      <div className="mb-5 flex items-end justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-bold uppercase tracking-[0.14em] text-fg-muted">
            {weekly ? "Resets Monday 00:00 UTC" : "Every session you have ever logged"}
          </p>
          <h1 className="font-serif text-3xl font-semibold tracking-tight">Leaderboard</h1>
        </div>
        {weekly && (
          <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-accent/15 px-3 py-1.5 text-xs font-bold text-accent-fg ring-1 ring-accent/30">
            <Clock className="h-3.5 w-3.5" />
            {hoursUntilReset()}
          </span>
        )}
      </div>

      <div className="mb-5 flex gap-2">
        <ScopeTab href="/leaderboard" label="This week · by XP" active={weekly} />
        <ScopeTab href="/leaderboard?scope=all" label="All time" active={!weekly} />
      </div>

      {rows.length === 0 ? (
        <section className="rounded-3xl bg-surface p-10 text-center shadow-card ring-1 ring-border">
          <span className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-brand/15 text-brand">
            <Medal className="h-8 w-8" />
          </span>
          <h2 className="mt-4 text-xl font-extrabold">Nobody on the board yet</h2>
          <p className="mt-2 text-sm text-fg-muted">
            Earn XP by reading and reviewing — the first session puts you on it.
          </p>
          <Link
            href="/path"
            className="mt-6 inline-flex items-center gap-2 rounded-xl bg-brand px-5 py-3 text-sm font-bold text-brand-fg transition hover:bg-brand-dark"
          >
            Start reading
          </Link>
        </section>
      ) : (
        <>
          {podium.length === 3 && (
            <section className="rounded-3xl bg-surface px-6 pt-7 shadow-card ring-1 ring-border">
              <div className="grid grid-cols-3 items-end gap-4">
                {[podium[1], podium[0], podium[2]].map((row, slot) => (
                  <Podium key={row.userId} row={row} slot={slot} />
                ))}
              </div>
            </section>
          )}

          {rest.length > 0 && (
            <section className="mt-4 overflow-hidden rounded-3xl bg-surface shadow-card ring-1 ring-border">
              {rest.map((row, i) => (
                <Row key={row.userId} row={row} rank={i + 4} />
              ))}
            </section>
          )}

          {/* Their own standing, always visible even when they are outside the
              rows above — getLeaderboard resolves it separately for that case. */}
          {you && !podium.some((p) => p.isYou) && (
            <section className="mt-4 rounded-3xl bg-surface shadow-card ring-2 ring-brand">
              <Row row={you} rank={you.rank} emphasis />
            </section>
          )}
        </>
      )}
    </main>
  );
}

function ScopeTab({ href, label, active }: { href: string; label: string; active: boolean }) {
  return (
    <Link
      href={href}
      className={cn(
        "rounded-full px-4 py-2 text-[13px] font-bold transition",
        active
          ? "bg-brand text-brand-fg"
          : "text-fg-muted ring-1 ring-border hover:bg-bg-muted hover:text-fg",
      )}
    >
      {label}
    </Link>
  );
}

function Avatar({ row, size }: { row: LeaderRow; size: "sm" | "lg" | "xl" }) {
  const dim =
    size === "xl" ? "h-16 w-16 text-2xl" : size === "lg" ? "h-14 w-14 text-xl" : "h-9 w-9 text-sm";
  return (
    <span
      className={cn(
        "grid shrink-0 place-items-center rounded-full bg-gradient-to-br from-brand to-brand-dark font-bold text-brand-fg",
        dim,
      )}
    >
      {row.avatar ?? row.name.charAt(0)}
    </span>
  );
}

function Podium({ row, slot }: { row: LeaderRow; slot: number }) {
  // slot 0 is 2nd place, slot 1 is the winner, slot 2 is 3rd.
  const rank = slot === 0 ? 2 : slot === 1 ? 1 : 3;
  return (
    <div className="flex flex-col items-center">
      <span
        className="rounded-full p-[3px]"
        style={{ background: MEDALS[slot] }}
      >
        <Avatar row={row} size={slot === 1 ? "xl" : "lg"} />
      </span>
      <p className={cn("mt-2 text-center text-sm font-bold", row.isYou && "text-brand")}>
        {row.isYou ? "You" : row.name}
      </p>
      <p className="text-xs font-semibold text-fg-muted">{row.xp.toLocaleString()} XP</p>
      <div
        className="mt-3 grid w-full place-items-center rounded-t-2xl"
        style={{ height: PEDESTAL_H[slot], background: MEDALS[slot] }}
      >
        <span className="text-xl font-extrabold text-white/90">{rank}</span>
      </div>
    </div>
  );
}

function Row({
  row,
  rank,
  emphasis,
}: {
  row: LeaderRow;
  rank: number;
  emphasis?: boolean;
}) {
  return (
    <div
      className={cn(
        "flex items-center gap-3.5 px-5 py-3",
        !emphasis && "border-t border-bg-muted first:border-t-0",
      )}
    >
      <span
        className={cn(
          "w-6 shrink-0 text-right text-[13px] font-bold",
          emphasis || row.isYou ? "text-brand" : "text-fg-muted",
        )}
      >
        {rank > 0 ? rank : "—"}
      </span>
      <Avatar row={row} size="sm" />
      <span className="min-w-0 flex-1">
        <span className={cn("block truncate text-[15px] font-semibold", row.isYou && "text-brand")}>
          {row.isYou ? "You" : row.name}
        </span>
      </span>
      {row.streak > 0 && (
        <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-orange-100 px-2.5 py-1 text-[11.5px] font-bold text-orange-700">
          <Flame className="h-3 w-3" />
          {row.streak}
        </span>
      )}
      <span className="w-[4.5rem] shrink-0 text-right text-sm font-extrabold">
        {row.xp.toLocaleString()}
      </span>
    </div>
  );
}
