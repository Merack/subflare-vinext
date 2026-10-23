"use client";

import Link from "next/link";
import { CodeXml } from "lucide-react";
import PreferencesCard, { type NotificationPreferences } from "./settings/preferences-card";
import ChannelsCard, { type Channel } from "./settings/channels-card";
import EventsCard from "./settings/events-card";

interface SettingsClientProps {
  initialChannels: Channel[];
  initialPreferences: NotificationPreferences;
}

export default function SettingsClient({ initialChannels, initialPreferences }: SettingsClientProps) {
  return (
    <div className="space-y-6 max-w-2xl">
      <h1 className="text-2xl font-semibold">设置</h1>

      <PreferencesCard initialPreferences={initialPreferences} />
      <ChannelsCard initialChannels={initialChannels} />
      <EventsCard />

      <div className="flex justify-center border-t pt-6">
        <Link
          href="https://github.com/Merack/subflare-vinext"
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-2 text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          <CodeXml className="h-4 w-4" />
          <span>subflare-vinext</span>
        </Link>
      </div>
    </div>
  );
}
