import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { db, schema } from "@/lib/db";
import { eq } from "drizzle-orm";
import {
  getAllTimeLeaderboard,
  getUserRank,
  getWeeklyLeaderboard,
  type LeaderboardScope,
} from "@/lib/db/queries/leaderboard";
import { LeaderboardView } from "@/components/leaderboard/LeaderboardView";

export const dynamic = "force-dynamic";

export default async function LeaderboardPage({
  searchParams,
}: {
  searchParams: Promise<{ scope?: string }>;
}) {
  const { scope: rawScope } = await searchParams;
  const scope: LeaderboardScope = rawScope === "weekly" ? "weekly" : "all_time";

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/sign-in?redirect=/leaderboard");

  const [rows, myRank, profileRows] = await Promise.all([
    scope === "weekly" ? getWeeklyLeaderboard(100) : getAllTimeLeaderboard(100),
    getUserRank(user.id, scope),
    db
      .select({ displayName: schema.profiles.displayName })
      .from(schema.profiles)
      .where(eq(schema.profiles.id, user.id))
      .limit(1),
  ]);

  const hasDisplayName = !!profileRows[0]?.displayName?.trim();

  return (
    <LeaderboardView
      scope={scope}
      rows={rows}
      currentUserId={user.id}
      myRank={myRank}
      hasDisplayName={hasDisplayName}
    />
  );
}
