"use client";

/**
 * 仪表盘的两张图表
 *
 * 单独成文件是为了让 dashboard-client 用 lazy 加载它，recharts 不进首屏包
 */
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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

export interface StatusChartDatum {
  name: string;
  value: number;
  key: string;
}

export interface CategoryChartDatum {
  category: string;
  value: number;
}

const STATUS_COLORS: Record<string, string> = {
  active: "#22c55e", paused: "#f59e0b", disabled: "#6b7280", expired: "#ef4444",
};

const CATEGORY_COLORS = [
  "#6366f1", "#8b5cf6", "#ec4899", "#f43f5e", "#f97316", "#eab308", "#22c55e",
];

interface DashboardChartsProps {
  statusData: StatusChartDatum[];
  categoryData: CategoryChartDatum[];
  sym: string;
  period: "month" | "year";
}

export default function DashboardCharts({ statusData, categoryData, sym, period }: DashboardChartsProps) {
  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium">订阅状态占比</CardTitle>
        </CardHeader>
        <CardContent>
          {statusData.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">暂无数据</p>
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie
                  data={statusData}
                  cx="50%"
                  cy="50%"
                  innerRadius={55}
                  outerRadius={85}
                  paddingAngle={3}
                  dataKey="value"
                >
                  {statusData.map((entry) => (
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

      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium">
            各类型支出占比（{period === "month" ? "本月" : "本年"}）
          </CardTitle>
        </CardHeader>
        <CardContent>
          {categoryData.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">暂无数据</p>
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart
                data={categoryData}
                layout="vertical"
                margin={{ left: 8, right: 32, top: 4, bottom: 4 }}
              >
                <XAxis type="number" tick={{ fontSize: 11 }} tickFormatter={(v: number) => `${sym}${v.toFixed(0)}`} />
                <YAxis type="category" dataKey="category" tick={{ fontSize: 11 }} width={52} />
                <Tooltip formatter={(value) => [typeof value === "number" ? `${sym}${value.toFixed(2)}` : `${sym}${value ?? ""}`, "支出"]} />
                <Bar dataKey="value" radius={[0, 4, 4, 0]}>
                  {categoryData.map((_, i) => (
                    <Cell key={i} fill={CATEGORY_COLORS[i % CATEGORY_COLORS.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
