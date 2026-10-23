import { NextResponse } from "next/server";
import { getExchangeRates } from "@/lib/exchange-rates";
import {
  DashboardSummaryResponse,
  getDashboardSummary,
} from "@/lib/dashboard";
import { requireApiAuth } from "@/lib/session";

/**
 * GET 处理器 - 获取仪表板摘要数据
 *
 * @returns {Promise<NextResponse>} 包含所有仪表板统计数据的 JSON 响应
 *
 * 返回数据结构：
 * - total: 订阅总数
 * - expired: 已过期订阅数
 * - monthlyExpectedCostItems: 本月预期费用项目（按到期日期筛选）
 * - monthlyActualCostItems: 本月实际费用项目（按开始日期筛选）
 * - prevMonthExpectedCostItems: 上月预期费用项目
 * - prevMonthActualCostItems: 上月实际费用项目
 * - yearlyExpectedCostItems: 本年预期费用项目
 * - yearlyActualCostItems: 本年实际费用项目
 * - prevYearExpectedCostItems: 去年预期费用项目
 * - prevYearActualCostItems: 去年实际费用项目
 * - statusCounts: 按状态分类的订阅数量统计
 * - categoryMonthlyCosts: 按类别分组的月度费用
 * - categoryYearlyCosts: 按类别分组的年度费用
 * - expiringSoonList: 30天内即将到期的订阅列表
 * - expiredList: 已过期的订阅列表（最多20条）
 */
export async function GET() {
  const session = await requireApiAuth();
  if (session instanceof NextResponse) return session;
  const [summary, exchangeRates] = await Promise.all([
    getDashboardSummary(session.userId),
    getExchangeRates(),
  ]);

  return NextResponse.json({ summary, exchangeRates } satisfies DashboardSummaryResponse);
}
