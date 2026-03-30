/**
 * @fileoverview 订阅管理工具函数库
 *
 * 提供订阅相关的常量映射、日期计算和状态判断等辅助功能
 * 主要用于订阅数据的展示格式化和业务逻辑处理
 *
 * @module lib/subscription-utils
 */

import type { BillingCycle, Subscription, SubscriptionStatus } from "@/db/schema";

/**
 * 订阅分类的中文标签映射
 *
 * 用于在 UI 中显示分类名称的本地化文本
 */
export const CATEGORY_LABELS: Record<string, string> = {
  domain: "域名",
  server: "服务器",
  streaming: "流媒体",
  software: "软件",
  saas: "SaaS",
  tool: "工具",
  other: "其他",
};

/**
 * 计费周期的中文标签映射
 *
 * 将计费周期枚举值转换为用户友好的中文显示文本
 */
export const BILLING_CYCLE_LABELS: Record<BillingCycle, string> = {
  daily: "每天",
  monthly: "每月",
  quarterly: "每季",
  yearly: "每年",
  once: "一次性",
};

/**
 * 订阅状态的中文标签映射
 *
 * 将状态枚举值转换为用户友好的中文显示文本
 */
export const STATUS_LABELS: Record<SubscriptionStatus, string> = {
  active: "正常",
  paused: "暂停",
  disabled: "已停用",
  expired: "已过期",
};

/**
 * 将日期转换为 HTML date input 元素所需的格式 (YYYY-MM-DD)
 *
 * @param date - 需要转换的日期，可以是 Date 对象、null 或 undefined
 * @returns 格式化后的日期字符串 (YYYY-MM-DD)，如果输入为空则返回空字符串
 *
 * @example
 * toDateInput(new Date("2024-03-15")) // "2024-03-15"
 * toDateInput(null) // ""
 */
export function toDateInput(date: Date | null | undefined): string {
  if (!date) return "";
  return new Date(date).toISOString().split("T")[0];
}

/**
 * 根据计费周期推进到期日期
 *
 * 计算给定日期经过指定数量的计费周期后的新日期
 * 例如：月付订阅在 3月15日 到期，推进一个月后为 4月15日
 *
 * @param expireDate - 当前到期日期
 * @param billingCycle - 计费周期类型
 * @param count - 推进的周期数量，默认为 1
 * @returns 推进后的新日期
 *
 * @example
 * // 月付订阅，推进一个月
 * advanceExpireDate(new Date("2024-03-15"), "monthly", 1) // 2024-04-15
 *
 * // 季付订阅，推进一个季度（3个月）
 * advanceExpireDate(new Date("2024-01-01"), "quarterly", 1) // 2024-04-01
 *
 * // 年付订阅，推进两年
 * advanceExpireDate(new Date("2024-03-15"), "yearly", 2) // 2026-03-15
 */
export function advanceExpireDate(expireDate: Date, billingCycle: BillingCycle, count = 1): Date {
  const next = new Date(expireDate);

  switch (billingCycle) {
    case "daily":
      next.setDate(next.getDate() + count);
      break;
    case "monthly":
      next.setMonth(next.getMonth() + count);
      break;
    case "quarterly":
      next.setMonth(next.getMonth() + count * 3);
      break;
    case "yearly":
      next.setFullYear(next.getFullYear() + count);
      break;
    case "once":
      // 一次性付款不推进日期
      break;
  }

  return next;
}

/**
 * 根据开始日期计算到期日期
 *
 * 给定订阅开始日期、计费周期和周期数，计算出到期日期
 * 主要用于创建订阅时自动计算首次到期日期
 *
 * @param startDate - 订阅开始日期 (YYYY-MM-DD 格式字符串)
 * @param billingCycle - 计费周期类型
 * @param count - 订阅周期数量
 * @returns 到期日期字符串 (YYYY-MM-DD)，如果输入无效或为一次性付款则返回空字符串
 *
 * @example
 * calcExpireDateFromStartDate("2024-03-15", "monthly", 1) // "2024-04-15"
 * calcExpireDateFromStartDate("2024-01-01", "yearly", 1) // "2025-01-01"
 */
export function calcExpireDateFromStartDate(startDate: string, billingCycle: BillingCycle, count: number): string {
  if (!startDate || billingCycle === "once") return "";
  const parsed = new Date(startDate);
  if (Number.isNaN(parsed.getTime())) return "";
  return toDateInput(advanceExpireDate(parsed, billingCycle, count));
}

/**
 * 计算距离到期日期还有多少天
 *
 * @param expireDate - 到期日期
 * @returns 剩余天数（向上取整），已过期返回负数
 *
 * @example
 * // 假设今天是 2024-03-10
 * getDaysLeft(new Date("2024-03-15")) // 5
 * getDaysLeft(new Date("2024-03-05")) // -5 (已过期5天)
 */
export function getDaysLeft(expireDate: Date) {
  return Math.ceil((new Date(expireDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
}

/**
 * 获取订阅的有效状态信息
 *
 * 综合考虑订阅的原始状态、到期时间和提醒设置，计算出实际显示状态
 * 用于在 UI 中正确展示订阅的当前状态（如是否需要提醒续费、是否已过期等）
 *
 * @param subscription - 包含到期日期、状态和提醒天数的订阅对象
 * @returns 包含状态信息的对象
 * @property {number} daysLeft - 距离到期的天数
 * @property {boolean} isExpired - 是否已过期（未停用且已过到期日）
 * @property {boolean} isUrgent - 是否需要紧急提醒（在提醒天数内且状态正常）
 * @property {boolean} isDisabled - 是否已停用
 * @property {SubscriptionStatus} effectiveStatus - 实际生效的状态（过期时返回 "expired"）
 *
 * @example
 * const result = getEffectiveStatus({
 *   expireDate: new Date("2024-03-20"),
 *   status: "active",
 *   reminderDays: 7
 * })
 * // 如果今天是 2024-03-15:
 * // result.daysLeft = 5
 * // result.isUrgent = true (5 <= 7)
 * // result.isExpired = false
 */
export function getEffectiveStatus(subscription: Pick<Subscription, "expireDate" | "status" | "reminderDays" | "reminderMode">) {
  const daysLeft = getDaysLeft(subscription.expireDate);
  const isExpired = daysLeft < 0 && subscription.status !== "disabled";
  return {
    daysLeft,
    isExpired,
    isUrgent:
      subscription.status === "active"
      && daysLeft >= 0
      && (
        subscription.reminderMode === "daily_from_n_days"
          ? daysLeft <= subscription.reminderDays
          : daysLeft === subscription.reminderDays
      ),
    isDisabled: subscription.status === "disabled",
    effectiveStatus: (isExpired ? "expired" : subscription.status) as SubscriptionStatus,
  };
}

/**
 * 获取状态徽章的样式变体
 *
 * 根据订阅状态和是否过期，返回对应的 Badge 组件样式变体
 *
 * @param status - 订阅状态
 * @param isExpired - 是否已过期
 * @returns Badge 组件的 variant 属性值
 *
 * @example
 * getStatusBadgeVariant("active", false) // "secondary"
 * getStatusBadgeVariant("active", true) // "destructive"
 * getStatusBadgeVariant("paused", false) // "outline"
 */
export function getStatusBadgeVariant(status: SubscriptionStatus, isExpired: boolean): "destructive" | "secondary" | "outline" {
  if (isExpired) return "destructive";
  if (status === "active") return "secondary";
  return "outline";
}

/**
 * 获取状态的显示标签
 *
 * 返回订阅状态的中文显示文本，优先处理过期状态
 *
 * @param status - 订阅状态
 * @param isExpired - 是否已过期
 * @returns 状态的中文显示文本
 *
 * @example
 * getStatusLabel("active", false) // "正常"
 * getStatusLabel("active", true) // "已过期"
 * getStatusLabel("paused", false) // "暂停"
 */
export function getStatusLabel(status: SubscriptionStatus, isExpired: boolean): string {
  if (isExpired) return "已过期";
  return STATUS_LABELS[status] ?? status;
}

/**
 * 获取计费周期的显示标签
 *
 * 根据计费周期类型和数量，生成用户友好的显示文本
 * 当周期数量大于 1 时，会显示数量（如 "3 每月"）
 *
 * @param subscription - 包含计费周期和周期数量的订阅对象
 * @returns 计费周期的显示文本，如果无计费周期则返回 null
 *
 * @example
 * getCycleLabel({ billingCycle: "monthly", billingCycleCount: 1 }) // "每月"
 * getCycleLabel({ billingCycle: "monthly", billingCycleCount: 3 }) // "3 每月"
 * getCycleLabel({ billingCycle: "yearly", billingCycleCount: 2 }) // "2 每年"
 */
export function getCycleLabel(subscription: Pick<Subscription, "billingCycle" | "billingCycleCount">) {
  const billingCycle = subscription.billingCycle;
  const billingCycleCount = subscription.billingCycleCount ?? 1;
  if (!billingCycle) return null;
  return billingCycleCount > 1
    ? `${billingCycleCount} ${BILLING_CYCLE_LABELS[billingCycle] ?? billingCycle}`
    : BILLING_CYCLE_LABELS[billingCycle] ?? billingCycle;
}
