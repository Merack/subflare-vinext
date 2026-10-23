import { getDb } from "@/db";
import { subscriptions } from "@/db/schema";
import { requirePageAuth } from "@/lib/session";
import { eq } from "drizzle-orm";
import AppLayout from "@/components/app-layout";
import SubscriptionsClient from "@/components/subscriptions-client";
import { getUserTimezone } from "@/lib/user-settings";

export default async function SubscriptionsPage() {
  const session = await requirePageAuth();
  const db = await getDb();

  const [timezone, initialSubscriptions] = await Promise.all([
    getUserTimezone(session.userId),
    db
      .select()
      .from(subscriptions)
      .where(eq(subscriptions.userId, session.userId))
      .orderBy(subscriptions.expireDate),
  ]);

  return (
    <AppLayout>
      <SubscriptionsClient initialSubscriptions={initialSubscriptions} timezone={timezone} />
    </AppLayout>
  );
}
