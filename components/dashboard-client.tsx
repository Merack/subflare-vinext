"use client";

import { useState, useCallback, lazy, Suspense } from "react";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CalendarClock, AlertTriangle, CheckCircle2, DollarSign, TrendingUp, TrendingDown } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import type { DashboardSummary, DashboardSummaryResponse } from "@/lib/dashboard";
import type { Subscription } from "@/db/schema";
import {
  CATEGORY_LABELS,
  STATUS_LABELS,
  formatCalendarDate,
  getDaysLeft,
  getTodayKey,
} from "@/lib/subscription-utils";
import RenewDialog from "./renew-dialog";

// recharts 只在仪表盘用，拆出去按需加载，别拖慢首屏
const DashboardCharts = lazy(() => import("./dashboard-charts"));

interface CostItems {
  cost: number;
  currency: string;
}

interface CategoryCostGroup {
  category: string;
  costItems: CostItems[];
}

interface DashboardClientProps {
  initialData: DashboardSummary;
  initialExchangeRates: Record<string, number> | null;
  timezone: string;
}

const CURRENCY_SYMBOLS: Record<string, string> = {
  CNY: "¥", USD: "$", EUR: "€", JPY: "¥", HKD: "HK$", GBP: "£",
};

export default function DashboardClient({ initialData, initialExchangeRates, timezone }: DashboardClientProps) {
  const [data, setData] = useState<DashboardSummary>(initialData);
  const [targetCurrency, setTargetCurrency] = useState("CNY");
  const [exchangeRates, setExchangeRates] = useState<Record<string, number> | null>(initialExchangeRates);
  const [period, setPeriod] = useState<"month" | "year">("month");

  // Renew dialog state
  const [renewTarget, setRenewTarget] = useState<Subscription | null>(null);

  const fetchData = useCallback(() => {
    void fetch("/api/dashboard/summary")
      .then((r) => {
        if (!r.ok) throw new Error();
        return r.json();
      })
      .then((d) => {
        const response = d as DashboardSummaryResponse;
        setData(response.summary);
        setExchangeRates(response.exchangeRates);
      })
      .catch(() => toast.error("刷新数据失败"));
  }, []);

  // 服务端重新拉取后（router.refresh）同步到本地状态；用渲染期条件更新代替 effect
  const [syncedInitial, setSyncedInitial] = useState(initialData);
  if (syncedInitial !== initialData) {
    setSyncedInitial(initialData);
    setData(initialData);
    setExchangeRates(initialExchangeRates);
  }

  const todayKey = getTodayKey(timezone);

  const convertItems = useCallback(
    (items: CostItems[]) => {
      if (!exchangeRates) return null;
      let totalInCNY = 0;
      for (const item of items) {
        const from = item.currency || "CNY";
        if (from === "CNY") {
          totalInCNY += item.cost;
        } else {
          const rate = exchangeRates[from];
          totalInCNY += rate ? item.cost / rate : item.cost;
        }
      }
      const toRate = exchangeRates[targetCurrency];
      return toRate ? totalInCNY * toRate : totalInCNY;
    },
    [exchangeRates, targetCurrency]
  );

  const convertCategoryGroups = useCallback(
    (groups: CategoryCostGroup[]) => {
      return groups.map((g) => ({
        category: CATEGORY_LABELS[g.category] ?? g.category,
        value: convertItems(g.costItems) ?? 0,
      }));
    },
    [convertItems]
  );

  const sym = CURRENCY_SYMBOLS[targetCurrency] ?? "";

  // Cost values
  const actualCost = convertItems(period === "month" ? data.monthlyActualCostItems : data.yearlyActualCostItems);
  const expectedCost = convertItems(period === "month" ? data.monthlyExpectedCostItems : data.yearlyExpectedCostItems);
  const prevActualCost = convertItems(period === "month" ? data.prevMonthActualCostItems : data.prevYearActualCostItems);
  const prevExpectedCost = convertItems(period === "month" ? data.prevMonthExpectedCostItems : data.prevYearExpectedCostItems);

  const calcTrend = (current: number | null, prev: number | null) => {
    if (current === null || prev === null || prev === 0) return null;
    return ((current - prev) / prev) * 100;
  };

  const actualTrend = calcTrend(actualCost, prevActualCost);
  const expectedTrend = calcTrend(expectedCost, prevExpectedCost);

  // Chart data
  const statusChartData = Object.entries(data.statusCounts)
    .filter(([, v]) => v > 0)
    .map(([k, v]) => ({ name: STATUS_LABELS[k as keyof typeof STATUS_LABELS] ?? k, value: v, key: k }));

  const categoryChartData = convertCategoryGroups(
    period === "month" ? data.categoryMonthlyCosts : data.categoryYearlyCosts
  ).filter((d) => d.value > 0);

  // 服务端只给 30 天内的列表，这里再按月/年视角收窄
  const cutoffDays = period === "month" ? 7 : 30;
  const filteredExpiringSoon = data.expiringSoonList.filter(
    (s) => getDaysLeft(s.expireDate, todayKey) <= cutoffDays
  );

  const expiredList = data.expiredList;

  const handleOpenRenew = (sub: Subscription) => {
    setRenewTarget(sub);
  };

  const handleRenewSuccess = () => {
    fetchData();
  };

  const cards = [
    {
      title: "订阅总数",
      value: data.total ?? "-",
      icon: CheckCircle2,
      desc: "全部订阅（含停用/过期）",
      trend: null,
      trendLabel: "",
    },
    {
      title: "即将到期",
      value: filteredExpiringSoon.length,
      icon: CalendarClock,
      desc: period === "month" ? "7 天内到期" : "30 天内到期",
      trend: null,
      trendLabel: "",
    },
    {
      title: "已过期",
      value: data.expired ?? "-",
      icon: AlertTriangle,
      desc: "需要续费或处理",
      trend: null,
      trendLabel: "",
    },
    {
      title: period === "month" ? "本月支出" : "本年支出",
      value: actualCost !== null ? `${sym}${actualCost.toFixed(2)}` : "-",
      icon: TrendingUp,
      desc: period === "month" ? "本月已续订费用" : "本年已续订费用",
      trend: actualTrend,
      trendLabel: period === "month" ? "上月" : "去年",
    },
    {
      title: period === "month" ? "本月预计支出" : "本年预计支出",
      value: expectedCost !== null ? `${sym}${expectedCost.toFixed(2)}` : "-",
      icon: DollarSign,
      desc: period === "month" ? "本月到期订阅费用" : "本年到期订阅费用",
      trend: expectedTrend,
      trendLabel: period === "month" ? "上月" : "去年",
    },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <h1 className="text-2xl font-semibold">Dashboard</h1>
        <div className="flex items-center gap-2 self-start sm:self-auto">
          <div className="flex rounded-md border overflow-hidden text-sm">
            <button
              className={`px-3 py-1.5 ${period === "month" ? "bg-primary text-primary-foreground" : "hover:bg-muted"}`}
              onClick={() => setPeriod("month")}
            >月</button>
            <button
              className={`px-3 py-1.5 ${period === "year" ? "bg-primary text-primary-foreground" : "hover:bg-muted"}`}
              onClick={() => setPeriod("year")}
            >年</button>
          </div>
          <span className="text-sm text-muted-foreground hidden sm:inline">货币:</span>
          <Select value={targetCurrency} onValueChange={setTargetCurrency}>
            <SelectTrigger className="w-20 sm:w-24">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="CNY">CNY</SelectItem>
              <SelectItem value="USD">USD</SelectItem>
              <SelectItem value="EUR">EUR</SelectItem>
              <SelectItem value="JPY">JPY</SelectItem>
              <SelectItem value="HKD">HKD</SelectItem>
              <SelectItem value="GBP">GBP</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {!exchangeRates && (
        <p className="text-xs text-muted-foreground">
          汇率暂时不可用，金额无法换算显示（配置不会丢，稍后刷新即可）
        </p>
      )}

      {/* Stats Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 sm:gap-4">
        {cards.map((card, i) => (
          <Card key={card.title} className={i === 0 ? "col-span-2 lg:col-span-1" : ""}>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                {card.title}
              </CardTitle>
              <card.icon className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">{card.value}</p>
              <p className="text-xs text-muted-foreground mt-1">{card.desc}</p>
              {card.trend !== null && (
                <TrendBadge trend={card.trend} label={card.trendLabel} />
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Expiry Lists */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium">到期订阅</CardTitle>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="expiring">
            <TabsList className="mb-3">
              <TabsTrigger value="expiring">
                即将到期（{filteredExpiringSoon.length}）
              </TabsTrigger>
              <TabsTrigger value="expired">
                已过期（{expiredList.length}）
              </TabsTrigger>
            </TabsList>

            <TabsContent value="expiring">
              {filteredExpiringSoon.length === 0 ? (
                <p className="text-sm text-muted-foreground py-4 text-center">
                  {period === "month" ? "7 天内" : "30 天内"}无即将到期订阅
                </p>
              ) : (
                <div className="space-y-2">
                  {filteredExpiringSoon.map((sub) => (
                    <ExpiryRow key={sub.id} sub={sub} sym={sym} todayKey={todayKey} onRenew={handleOpenRenew} />
                  ))}
                </div>
              )}
            </TabsContent>

            <TabsContent value="expired">
              {expiredList.length === 0 ? (
                <p className="text-sm text-muted-foreground py-4 text-center">无已过期订阅</p>
              ) : (
                <div className="space-y-2">
                  {expiredList.map((sub) => (
                    <ExpiryRow key={sub.id} sub={sub} sym={sym} todayKey={todayKey} onRenew={handleOpenRenew} />
                  ))}
                </div>
              )}
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      <RenewDialog
        key={renewTarget?.id ?? "closed"}
        target={renewTarget}
        onClose={() => setRenewTarget(null)}
        onSuccess={handleRenewSuccess}
      />

      <Suspense fallback={<ChartsPlaceholder />}>
        <DashboardCharts
          statusData={statusChartData}
          categoryData={categoryChartData}
          sym={sym}
          period={period}
        />
      </Suspense>
    </div>
  );
}

function ChartsPlaceholder() {
  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
      {[0, 1].map((i) => (
        <Card key={i}>
          <CardContent className="h-[268px] flex items-center justify-center">
            <p className="text-sm text-muted-foreground">图表加载中…</p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

function TrendBadge({ trend, label }: { trend: number | null; label: string }) {
  if (trend === null || !Number.isFinite(trend)) return null;
  const up = trend > 0;
  return (
    <p className={`text-xs mt-1 flex items-center gap-1 ${up ? "text-red-500" : "text-green-500"}`}>
      {up ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
      较{label}{up ? "增加" : "减少"} {Math.abs(trend).toFixed(1)}%
    </p>
  );
}

function ExpiryRow({
  sub,
  sym,
  todayKey,
  onRenew,
}: {
  sub: Subscription;
  sym: string;
  todayKey: string;
  onRenew: (sub: Subscription) => void;
}) {
  const daysLeft = getDaysLeft(sub.expireDate, todayKey);
  const isExpired = daysLeft < 0;

  return (
    <div className="flex flex-col sm:flex-row sm:items-center justify-between p-3 border rounded-lg text-sm gap-3">
      <div className="flex items-center gap-3 min-w-0">
        <div className="min-w-0">
          <p className="font-medium truncate">{sub.name}</p>
          <p className={`text-xs ${isExpired ? "text-red-500" : daysLeft <= 3 ? "text-orange-500" : "text-muted-foreground"}`}>
            {isExpired
              ? `已过期 ${Math.abs(daysLeft)} 天`
              : daysLeft === 0
              ? "今天到期"
              : `${daysLeft} 天后到期`}
            {" · "}
            {formatCalendarDate(sub.expireDate)}
          </p>
        </div>
      </div>
      <div className="flex items-center justify-between sm:justify-end gap-3 shrink-0">
        {sub.cost != null && (
          <Badge variant="outline" className="text-xs">
            {sym}{sub.cost} {sub.currency}
          </Badge>
        )}
        <Button size="sm" variant="outline" onClick={() => onRenew(sub)}>
          续费
        </Button>
      </div>
    </div>
  );
}
