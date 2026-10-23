import { getDb } from "@/db";
import { notificationChannels, userSettings } from "@/db/schema";
import { requirePageAuth } from "@/lib/session";
import { eq } from "drizzle-orm";
import AppLayout from "@/components/app-layout";
import SettingsClient from "@/components/settings-client";
import type { Channel } from "@/components/settings/channels-card";
import type { NotificationPreferences } from "@/components/settings/preferences-card";
import { getChannelSummary } from "@/lib/notifications/channel-descriptors";

function parseNotifyHours(raw: string) {
  try {
    return JSON.parse(raw) as number[];
  } catch {
    return [0];
  }
}

export default async function SettingsPage() {
  const session = await requirePageAuth();
  const db = await getDb();

  const [settings, channels] = await Promise.all([
    db.select().from(userSettings).where(eq(userSettings.userId, session.userId)).limit(1),
    db.select().from(notificationChannels).where(eq(notificationChannels.userId, session.userId)),
  ]);

  const preferences: NotificationPreferences = settings[0]
    ? {
        timezone: settings[0].timezone,
        notifyHours: parseNotifyHours(settings[0].notifyHoursJson),
        notifyDeliveryMode: settings[0].notifyDeliveryMode,
      }
    : {
        timezone: "UTC",
        notifyHours: [0],
        notifyDeliveryMode: "every_slot",
      };

  const initialChannels: Channel[] = channels.map((channel) => ({
    id: channel.id,
    type: channel.type,
    name: channel.name,
    enabled: channel.enabled,
    ...getChannelSummary(channel.type, channel.config),
  }));

  return (
    <AppLayout>
      <SettingsClient initialChannels={initialChannels} initialPreferences={preferences} />
    </AppLayout>
  );
}
