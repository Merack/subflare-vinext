import { NextRequest, NextResponse } from "next/server";
import { and, desc, eq, inArray, lt } from "drizzle-orm";
import { getDb } from "@/db";
import { notificationChannels, notificationEvents, subscriptions } from "@/db/schema";
import { requireApiAuth } from "@/lib/session";
import { z } from "zod";

const cleanupSchema = z.object({
  months: z.number().int().min(1),
});

export async function GET() {
  const session = await requireApiAuth();
  const db = await getDb();

  const items = await db
    .select({
      id: notificationEvents.id,
      createdAt: notificationEvents.createdAt,
      sentAt: notificationEvents.sentAt,
      subscriptionName: subscriptions.name,
      channelName: notificationChannels.name,
      status: notificationEvents.status,
      offsetDays: notificationEvents.offsetDays,
      error: notificationEvents.error,
    })
    .from(notificationEvents)
    .innerJoin(subscriptions, eq(notificationEvents.subscriptionId, subscriptions.id))
    .innerJoin(notificationChannels, eq(notificationEvents.channelId, notificationChannels.id))
    .where(eq(subscriptions.userId, session.userId))
    .orderBy(desc(notificationEvents.createdAt))
    .limit(50);

  return NextResponse.json({ items });
}

export async function DELETE(request: NextRequest) {
  const session = await requireApiAuth();
  const db = await getDb();

  const body = await request.json() as unknown;
  const parsed = cleanupSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const cutoff = new Date();
  cutoff.setMonth(cutoff.getMonth() - parsed.data.months);

  const ids = await db
    .select({ id: notificationEvents.id })
    .from(notificationEvents)
    .innerJoin(subscriptions, eq(notificationEvents.subscriptionId, subscriptions.id))
    .where(eq(subscriptions.userId, session.userId));

  const deletableIds = ids.map((item) => item.id);
  if (deletableIds.length === 0) {
    return NextResponse.json({ success: true, deletedCount: 0 });
  }

  const deleted = await db
    .delete(notificationEvents)
    .where(
      and(
        inArray(notificationEvents.id, deletableIds),
        lt(notificationEvents.createdAt, cutoff)
      )
    )
    .returning({ id: notificationEvents.id });

  return NextResponse.json({ success: true, deletedCount: deleted.length });
}
