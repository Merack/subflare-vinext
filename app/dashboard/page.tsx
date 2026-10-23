import { requirePageAuth } from "@/lib/session";
import AppLayout from "@/components/app-layout";
import DashboardClient from "@/components/dashboard-client";
import { getDashboardSummary } from "@/lib/dashboard";
import { getExchangeRates } from "@/lib/exchange-rates";
import { getUserTimezone } from "@/lib/user-settings";
import { getTodayKey } from "@/lib/subscription-utils";

export default async function DashboardPage() {
  const session = await requirePageAuth();
  const timezone = await getUserTimezone(session.userId);
  const [initialData, initialExchangeRates] = await Promise.all([
    getDashboardSummary(session.userId, getTodayKey(timezone)),
    getExchangeRates(),
  ]);

  return (
    <AppLayout>
      <DashboardClient
        initialData={initialData}
        initialExchangeRates={initialExchangeRates}
        timezone={timezone}
      />
    </AppLayout>
  );
}
