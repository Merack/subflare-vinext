/**
 * @fileoverview 仪表盘数据汇总模块
 * 提供用户订阅数据的统计分析功能, 包括:
 * - 订阅状态统计 (总数/已过期/即将过期)
 * - 费用统计 (月度/年度, 预期/实际)
 * - 分类费用汇总
 * - 即将过期和已过期订阅列表
 * @module lib/dashboard
 */
import { getDb } from "@/db";
import { subscriptions } from "@/db/schema";
import { eq } from "drizzle-orm";
import type { Subscription } from "@/db/schema";

/**
 * 费用项
 * 表示单个费用记录, 包含金额和货币类型
 */
interface CostItems {
  cost: number;
  currency: string;
}

/**
 * 分类费用分组
 * 按订阅类别分组的费用项集合
 */
interface CategoryCostGroup {
  category: string;
  costItems: CostItems[];
}

/**
 * 仪表盘汇总数据
 * 包含用户订阅的完整统计信息
 */
export interface DashboardSummary {
  /** 订阅总数 */
  total: number;
  /** 已过期订阅数 */
  expired: number;
  /** 本月预期费用项 (按过期日期统计) */
  monthlyExpectedCostItems: CostItems[];
  /** 本月实际费用项 (按开始日期统计) */
  monthlyActualCostItems: CostItems[];
  /** 上月预期费用项 */
  prevMonthExpectedCostItems: CostItems[];
  /** 上月实际费用项 */
  prevMonthActualCostItems: CostItems[];
  /** 本年预期费用项 */
  yearlyExpectedCostItems: CostItems[];
  /** 本年实际费用项 */
  yearlyActualCostItems: CostItems[];
  /** 上年预期费用项 */
  prevYearExpectedCostItems: CostItems[];
  /** 上年实际费用项 */
  prevYearActualCostItems: CostItems[];
  /** 各状态订阅数量统计 */
  statusCounts: Record<string, number>;
  /** 按分类统计的月度费用 */
  categoryMonthlyCosts: CategoryCostGroup[];
  /** 按分类统计的年度费用 */
  categoryYearlyCosts: CategoryCostGroup[];
  /** 即将过期订阅列表 */
  expiringSoonList: Subscription[];
  /** 已过期订阅列表 (排除已禁用的) */
  expiredList: Subscription[];
}

/**
 * 仪表盘汇总响应
 * 包含汇总数据和汇率信息
 */
export interface DashboardSummaryResponse {
  /** 汇总数据 */
  summary: DashboardSummary;
  /** 汇率表 (货币代码 -> 汇率), 无汇率数据时为 null */
  exchangeRates: Record<string, number> | null;
}

/**
 * 获取用户仪表盘汇总数据
 * 
 * @param userId - 用户ID
 * @returns 包含完整统计信息的仪表盘汇总数据
 * 
 * @example
 * const summary = await getDashboardSummary(1)
 * console.log(`总订阅数: ${summary.total}`)
 * console.log(`本月预期费用: ${summary.monthlyExpectedCostItems}`)
 */
export async function getDashboardSummary(userId: number): Promise<DashboardSummary> {
  const db = await getDb();

  // 时间基准点
  const now = new Date();
  // 30天后的日期 (用于生成即将过期列表)
  const in30Days = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

  // 获取用户所有订阅数据
  const allSubs = await db
    .select()
    .from(subscriptions)
    .where(eq(subscriptions.userId, userId));

  // 基础统计: 总数/已过期
  const total = allSubs.length;
  const expired = allSubs.filter((s) => new Date(s.expireDate) < now).length;

  // 本月时间范围
  const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const thisMonthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);
  // 上月时间范围
  const prevMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const prevMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59);

  // 本年时间范围
  const thisYearStart = new Date(now.getFullYear(), 0, 1);
  const thisYearEnd = new Date(now.getFullYear(), 11, 31, 23, 59, 59);
  // 上年时间范围
  const prevYearStart = new Date(now.getFullYear() - 1, 0, 1);
  const prevYearEnd = new Date(now.getFullYear() - 1, 11, 31, 23, 59, 59);

  /**
   * 按过期日期筛选费用项
   * 用于统计预期费用 (假设订阅会在过期日期续费)
   * 
   * @param start - 开始日期
   * @param end - 结束日期
   * @returns 在指定时间范围内过期的订阅费用项列表
   */
  const filterByExpire = (start: Date, end: Date) =>
    allSubs
      .filter((s) => {
        if (!s.cost) return false;
        const expire = new Date(s.expireDate);
        return expire >= start && expire <= end;
      })
      .map((s) => ({ cost: s.cost!, currency: s.currency ?? "CNY" }));

  /**
   * 按开始日期筛选费用项
   * 用于统计实际费用 (订阅实际开始/续费的日期)
   * 
   * @param start - 开始日期
   * @param end - 结束日期
   * @returns 在指定时间范围内开始的订阅费用项列表
   */
  const filterByStart = (start: Date, end: Date) =>
    allSubs
      .filter((s) => {
        if (!s.cost || !s.startDate) return false;
        const d = new Date(s.startDate);
        return d >= start && d <= end;
      })
      .map((s) => ({ cost: s.cost!, currency: s.currency ?? "CNY" }));

  // 月度费用统计
  const monthlyExpectedCostItems = filterByExpire(thisMonthStart, thisMonthEnd);
  const monthlyActualCostItems = filterByStart(thisMonthStart, thisMonthEnd);
  const prevMonthExpectedCostItems = filterByExpire(prevMonthStart, prevMonthEnd);
  const prevMonthActualCostItems = filterByStart(prevMonthStart, prevMonthEnd);

  // 年度费用统计
  const yearlyExpectedCostItems = filterByExpire(thisYearStart, thisYearEnd);
  const yearlyActualCostItems = filterByStart(thisYearStart, thisYearEnd);
  const prevYearExpectedCostItems = filterByExpire(prevYearStart, prevYearEnd);
  const prevYearActualCostItems = filterByStart(prevYearStart, prevYearEnd);

  // 状态统计: active/paused/disabled/expired
  // 注意: 过期订阅如果未被禁用, 状态会显示为 expired
  const statusCounts: Record<string, number> = { active: 0, paused: 0, disabled: 0, expired: 0 };
  for (const s of allSubs) {
    const isExpired = new Date(s.expireDate) < now;
    const effectiveStatus = isExpired && s.status !== "disabled" ? "expired" : s.status;
    statusCounts[effectiveStatus] = (statusCounts[effectiveStatus] ?? 0) + 1;
  }

  /**
   * 构建分类费用统计
   * 按订阅类别分组统计费用
   * 
   * @param items - 订阅列表
   * @param start - 开始日期
   * @param end - 结束日期
   * @returns 按分类分组的费用项列表
   */
  const buildCategoryCosts = (items: Subscription[], start: Date, end: Date) => {
    const map: Record<string, Array<{ cost: number; currency: string }>> = {};
    for (const s of items) {
      if (!s.cost) continue;
      const expire = new Date(s.expireDate);
      if (expire < start || expire > end) continue;
      // 无分类的订阅归入 "other" 类别
      const cat = s.category ?? "other";
      if (!map[cat]) map[cat] = [];
      map[cat].push({ cost: s.cost, currency: s.currency ?? "CNY" });
    }
    return Object.entries(map).map(([category, costItems]) => ({ category, costItems }));
  };

  // 分类费用统计
  const categoryMonthlyCosts = buildCategoryCosts(allSubs, thisMonthStart, thisMonthEnd);
  const categoryYearlyCosts = buildCategoryCosts(allSubs, thisYearStart, thisYearEnd);

  // 即将过期列表 (30天内), 按过期日期升序排列
  const expiringSoonList = allSubs
    .filter((s) => {
      const d = new Date(s.expireDate);
      return d >= now && d <= in30Days;
    })
    .sort((a, b) => new Date(a.expireDate).getTime() - new Date(b.expireDate).getTime());

  // 已过期列表 (排除已禁用的), 按过期日期降序排列
  const expiredList = allSubs
    .filter((s) => new Date(s.expireDate) < now && s.status !== "disabled")
    .sort((a, b) => new Date(b.expireDate).getTime() - new Date(a.expireDate).getTime());
    // .slice(0, 20);

  return {
    total,
    expired,
    monthlyExpectedCostItems,
    monthlyActualCostItems,
    prevMonthExpectedCostItems,
    prevMonthActualCostItems,
    yearlyExpectedCostItems,
    yearlyActualCostItems,
    prevYearExpectedCostItems,
    prevYearActualCostItems,
    statusCounts,
    categoryMonthlyCosts,
    categoryYearlyCosts,
    expiringSoonList,
    expiredList,
  };
}
