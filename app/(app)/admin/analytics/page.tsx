import { notFound } from "next/navigation";
import { and, count, countDistinct, desc, eq, gte, sql } from "drizzle-orm";
import { createClient } from "@/lib/supabase/server";
import { db, schema } from "@/lib/db";
import { env } from "@/lib/env";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

function isAdmin(email: string | null | undefined) {
  if (!email || !env.ADMIN_EMAILS) return false;
  return env.ADMIN_EMAILS.split(",")
    .map((s) => s.trim().toLowerCase())
    .includes(email.toLowerCase());
}

export default async function AdminAnalyticsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!isAdmin(user?.email)) notFound();

  const since = new Date();
  since.setDate(since.getDate() - 30);

  const [topEvents, dailyActives, totalUsers, totalEvents, topPaths, recentSignups] =
    await Promise.all([
      db
        .select({ event: schema.usageEvents.event, n: count() })
        .from(schema.usageEvents)
        .where(gte(schema.usageEvents.occurredAt, since))
        .groupBy(schema.usageEvents.event)
        .orderBy(desc(count()))
        .limit(20),
      db
        .select({
          day: sql<string>`to_char(${schema.usageEvents.occurredAt}, 'YYYY-MM-DD')`,
          users: countDistinct(schema.usageEvents.userId),
          events: count(),
        })
        .from(schema.usageEvents)
        .where(
          and(
            gte(schema.usageEvents.occurredAt, since),
            sql`${schema.usageEvents.userId} is not null`,
          ),
        )
        .groupBy(sql`to_char(${schema.usageEvents.occurredAt}, 'YYYY-MM-DD')`)
        .orderBy(sql`to_char(${schema.usageEvents.occurredAt}, 'YYYY-MM-DD') desc`)
        .limit(14),
      db.select({ n: count() }).from(schema.profiles),
      db
        .select({ n: count() })
        .from(schema.usageEvents)
        .where(gte(schema.usageEvents.occurredAt, since)),
      db
        .select({ path: schema.usageEvents.path, n: count() })
        .from(schema.usageEvents)
        .where(
          and(
            eq(schema.usageEvents.event, "page_view"),
            gte(schema.usageEvents.occurredAt, since),
          ),
        )
        .groupBy(schema.usageEvents.path)
        .orderBy(desc(count()))
        .limit(15),
      db
        .select()
        .from(schema.profiles)
        .orderBy(desc(schema.profiles.createdAt))
        .limit(10),
    ]);

  return (
    <main className="mx-auto max-w-5xl space-y-6 px-4 pb-24 pt-6">
      <header>
        <h1 className="text-3xl font-extrabold">Analytics</h1>
        <p className="mt-1 text-sm text-fg-muted">
          Last 30 days · {Number(totalUsers[0]?.n ?? 0)} total users ·{" "}
          {Number(totalEvents[0]?.n ?? 0).toLocaleString()} events
        </p>
      </header>

      <Card title="Daily active users (last 14 days)">
        <table className="w-full text-sm">
          <thead className="text-fg-muted">
            <tr>
              <th className="py-1.5 text-left font-medium">Day</th>
              <th className="text-right font-medium">DAU</th>
              <th className="text-right font-medium">Events</th>
            </tr>
          </thead>
          <tbody>
            {dailyActives.map((d) => (
              <tr key={d.day} className="border-t border-border">
                <td className="py-1.5">{d.day}</td>
                <td className="text-right font-semibold">{Number(d.users)}</td>
                <td className="text-right">{Number(d.events).toLocaleString()}</td>
              </tr>
            ))}
            {dailyActives.length === 0 && (
              <tr>
                <td colSpan={3} className="py-4 text-center text-fg-muted">
                  No data yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </Card>

      <div className="grid gap-4 sm:grid-cols-2">
        <Card title="Top events">
          <ul className="space-y-1 text-sm">
            {topEvents.map((e) => (
              <li key={e.event} className="flex justify-between">
                <span className="font-mono">{e.event}</span>
                <span className="font-semibold">{Number(e.n).toLocaleString()}</span>
              </li>
            ))}
          </ul>
        </Card>

        <Card title="Top page views">
          <ul className="space-y-1 text-sm">
            {topPaths.map((p) => (
              <li key={p.path ?? ""} className="flex justify-between gap-3">
                <span className={cn("truncate font-mono", !p.path && "text-fg-muted")}>
                  {p.path ?? "(unknown)"}
                </span>
                <span className="font-semibold">{Number(p.n).toLocaleString()}</span>
              </li>
            ))}
          </ul>
        </Card>
      </div>

      <Card title="Recent signups">
        <ul className="space-y-1 text-sm">
          {recentSignups.map((p) => (
            <li key={p.id} className="flex justify-between">
              <span>{p.displayName ?? p.id.slice(0, 8)}</span>
              <span className="text-fg-muted">
                {new Date(p.createdAt).toLocaleString()}
              </span>
            </li>
          ))}
        </ul>
      </Card>
    </main>
  );
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-3xl bg-white p-6 shadow-soft ring-1 ring-border">
      <h2 className="mb-3 text-lg font-bold">{title}</h2>
      {children}
    </section>
  );
}
