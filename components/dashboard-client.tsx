"use client";

import { useEffect, useState, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CalendarClock, AlertTriangle, CheckCircle2, DollarSign, TrendingUp, TrendingDown } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import type { DashboardSummary, DashboardSummaryResponse } from "@/lib/dashboard";
import type { Subscription } from "@/db/schema";
import RenewDialog from "./renew-dialog";

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
}

const CURRENCY_SYMBOLS: Record<string, string> = {
  CNY: "¥", USD: "$", EUR: "€", JPY: "¥", HKD: "HK$", GBP: "£",
};

const CATEGORY_LABELS: Record<string, string> = {
  domain: "域名", server: "服务器", streaming: "流媒体",
  software: "软件", saas: "SaaS", tool: "工具", other: "其他",
};

const STATUS_COLORS: Record<string, string> = {
  active: "#22c55e", paused: "#f59e0b", disabled: "#6b7280", expired: "#ef4444",
};

const STATUS_LABELS: Record<string, string> = {
  active: "正常", paused: "暂停", disabled: "已停用", expired: "已过期",
};

const CATEGORY_COLORS = [
  "#6366f1", "#8b5cf6", "#ec4899", "#f43f5e", "#f97316", "#eab308", "#22c55e",
];

export default function DashboardClient({ initialData, initialExchangeRates }: DashboardClientProps) {
  const [data, setData] = useState<DashboardSummary>(initialData);
  const [targetCurrency, setTargetCurrency] = useState("CNY");
  const [exchangeRates, setExchangeRates] = useState<Record<string, number> | null>(initialExchangeRates);
  const [period, setPeriod] = useState<"month" | "year">("month");

  // Renew dialog state
  const [renewTarget, setRenewTarget] = useState<Subscription | null>(null);

  const fetchData = useCallback(() => {
    void fetch("/api/dashboard/summary")
      .then((r) => r.json())
      .then((d) => {
        const response = d as DashboardSummaryResponse;
        setData(response.summary);
        setExchangeRates(response.exchangeRates);
      });
  }, []);

  useEffect(() => {
    setData(initialData);
    setExchangeRates(initialExchangeRates);
  }, [initialData, initialExchangeRates]);


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
    .map(([k, v]) => ({ name: STATUS_LABELS[k] ?? k, value: v, key: k }));

  const categoryChartData = convertCategoryGroups(
    period === "month" ? data.categoryMonthlyCosts : data.categoryYearlyCosts
  ).filter((d) => d.value > 0);

  const expiringSoonList = data.expiringSoonList;
  const expiredList = data.expiredList;

  // Filter expiring soon by period
  const now = new Date();
  const cutoff = period === "month"
    ? new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000)
    : new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
  const filteredExpiringSoon = expiringSoonList.filter(
    (s) => new Date(s.expireDate) <= cutoff
  );

  const handleOpenRenew = (sub: Subscription) => {
    setRenewTarget(sub);
  };

  const handleRenewSuccess = () => {
    void fetchData();
  };

  const TrendBadge = ({ trend, label }: { trend: number | null; label: string }) => {
    if (trend === null) return null;
    const up = trend > 0;
    return (
      <p className={`text-xs mt-1 flex items-center gap-1 ${up ? "text-red-500" : "text-green-500"}`}>
        {up ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
        较{label}{up ? "增加" : "减少"} {Math.abs(trend).toFixed(1)}%
      </p>
    );
  };

  const cards = [
    {
      title: "订阅总数",
      value: data.total ?? "-",
      icon: CheckCircle2,
      desc: "全部有效订阅",
      trend: null,
      trendLabel: "",
    },
    {
      title: "即将到期",
      value: data.expiringSoon ?? "-",
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
                    <ExpiryRow key={sub.id} sub={sub} sym={sym} onRenew={handleOpenRenew} />
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
                    <ExpiryRow key={sub.id} sub={sub} sym={sym} onRenew={handleOpenRenew} />
                  ))}
                </div>
              )}
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      <RenewDialog
        target={renewTarget}
        onClose={() => setRenewTarget(null)}
        onSuccess={handleRenewSuccess}
      />

      {/* Charts */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {/* Status Pie Chart */}
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">订阅状态占比</CardTitle>
          </CardHeader>
          <CardContent>
            {statusChartData.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">暂无数据</p>
            ) : (
              <ResponsiveContainer width="100%" height={220}>
                <PieChart>
                  <Pie
                    data={statusChartData}
                    cx="50%"
                    cy="50%"
                    innerRadius={55}
                    outerRadius={85}
                    paddingAngle={3}
                    dataKey="value"
                  >
                    {statusChartData.map((entry) => (
                      <Cell key={entry.key} fill={STATUS_COLORS[entry.key] ?? "#6b7280"} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(v, name) => [`${v} 个`, name]} />
                  <Legend
                    formatter={(value, entry) => {
                      const payload = entry.payload as { value: number } | undefined;
                      return `${value} (${payload?.value ?? 0})`;
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        {/* Category Cost Bar Chart */}
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">
              各类型支出占比（{period === "month" ? "本月" : "本年"}）
            </CardTitle>
          </CardHeader>
          <CardContent>
            {categoryChartData.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">暂无数据</p>
            ) : (
              <ResponsiveContainer width="100%" height={220}>
                <BarChart
                  data={categoryChartData}
                  layout="vertical"
                  margin={{ left: 8, right: 32, top: 4, bottom: 4 }}
                >
                  <XAxis type="number" tick={{ fontSize: 11 }} tickFormatter={(v: number) => `${sym}${v.toFixed(0)}`} />
                  <YAxis type="category" dataKey="category" tick={{ fontSize: 11 }} width={52} />
                  <Tooltip formatter={(value) => [typeof value === "number" ? `${sym}${value.toFixed(2)}` : `${sym}${value ?? ""}`, "支出"]} />
                  <Bar dataKey="value" radius={[0, 4, 4, 0]}>
                    {categoryChartData.map((_, i) => (
                      <Cell key={i} fill={CATEGORY_COLORS[i % CATEGORY_COLORS.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>


    </div>
  );
}

function ExpiryRow({
  sub,
  sym,
  onRenew,
}: {
  sub: Subscription;
  sym: string;
  onRenew: (sub: Subscription) => void;
}) {
  const expire = new Date(sub.expireDate);
  const now = new Date();
  const daysLeft = Math.ceil((expire.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
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
            {expire.toLocaleDateString("zh-CN")}
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
