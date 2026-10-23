import { getDb } from "@/db";
import { notificationChannels, userSettings } from "@/db/schema";
import { requirePageAuth } from "@/lib/session";
import { eq } from "drizzle-orm";
import AppLayout from "@/components/app-layout";
import SettingsClient from "@/components/settings-client";
import { getChannelSummary } from "@/lib/notifications/channel-descriptors";

interface SettingsChannelItem {
  id: number;
  type: string;
  name: string;
  enabled: boolean;
  hasConfig: boolean;
  summary: string | null;
}

interface SettingsPreferences {
  timezone: string;
  notifyHours: number[];
  notifyDeliveryMode: "every_slot" | "once_per_day";
}

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

  const preferences: SettingsPreferences = settings[0]
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

  const initialChannels: SettingsChannelItem[] = channels.map((channel) => ({
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
