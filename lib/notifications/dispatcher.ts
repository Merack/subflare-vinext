import type { DrizzleD1Database } from "drizzle-orm/d1";
import { and, eq } from "drizzle-orm";
import { notificationChannels, notificationEvents } from "@/db/schema";
import type * as schema from "@/db/schema";
import { registry } from "./registry";

type DB = DrizzleD1Database<typeof schema>;

export async function dispatchNotification(
  db: DB,
  subscriptionId: number,
  message: string,
  triggerDate: Date,
  triggerLocalDateKey: string,
  triggerHour: number,
  offsetDays: number,
  notifyDeliveryMode: "every_slot" | "once_per_day"
): Promise<void> {
  const channels = await db
    .select()
    .from(notificationChannels)
    .where(and(eq(notificationChannels.enabled, true)));

  await Promise.all(
    channels.map(async (channel) => {
      const existing = await db
        .select({ id: notificationEvents.id })
        .from(notificationEvents)
        .where(
          and(
            eq(notificationEvents.subscriptionId, subscriptionId),
            eq(notificationEvents.channelId, channel.id),
            eq(notificationEvents.triggerDate, triggerDate),
            eq(notificationEvents.offsetDays, offsetDays)
          )
        )
        .limit(1);

      if (existing.length > 0) return;

      if (notifyDeliveryMode === "once_per_day") {
        const existingSameDay = await db
          .select({ id: notificationEvents.id })
          .from(notificationEvents)
          .where(
            and(
              eq(notificationEvents.subscriptionId, subscriptionId),
              eq(notificationEvents.triggerLocalDateKey, triggerLocalDateKey),
              eq(notificationEvents.offsetDays, offsetDays)
            )
          )
          .limit(1);

        if (existingSameDay.length > 0) return;
      }

      const strategy = registry.get(channel.type);
      if (!strategy) return;

      const config = JSON.parse(channel.config) as Record<string, unknown>;
      const result = await strategy.send(message, config);

      await db.insert(notificationEvents).values({
        subscriptionId,
        channelId: channel.id,
        triggerDate,
        triggerLocalDateKey,
        triggerHour,
        offsetDays,
        status: result.success ? "sent" : "failed",
        message,
        providerMessageId: result.providerMessageId,
        error: result.error,
        sentAt: result.success ? new Date() : null,
      });
    })
  );
}
