import { NextResponse } from "next/server";
import { getApiUser, unauthorized } from "@/lib/api/require-user";
import { errorResponse } from "@/lib/api/respond";
import { getAchievements } from "@/lib/achievements/server";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const user = await getApiUser(req);
  if (!user) return unauthorized();
  try {
    const { newly } = await getAchievements(user.id);
    return NextResponse.json({
      earned: newly.map((b) => ({
        slug: b.slug,
        nameEn: b.nameEn,
        nameAr: b.nameAr,
        icon: b.icon,
        xpReward: b.xpReward,
      })),
    });
  } catch (err) {
    return errorResponse(err);
  }
}
