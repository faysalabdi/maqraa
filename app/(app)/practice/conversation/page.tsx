import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { createClient } from "@/lib/supabase/server";
import { db, schema } from "@/lib/db";
import { lookupKey } from "@/lib/arabic";
import { ConversationClient } from "@/components/practice/ConversationClient";

export const dynamic = "force-dynamic";

export default async function ConversationPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/sign-in?redirect=/practice/conversation");

  const saved = await db
    .select({ lemmaAr: schema.vocabItems.lemmaAr })
    .from(schema.vocabItems)
    .where(eq(schema.vocabItems.userId, user.id));

  return <ConversationClient initialSavedKeys={saved.map((s) => lookupKey(s.lemmaAr))} />;
}
