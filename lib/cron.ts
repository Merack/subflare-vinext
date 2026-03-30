/**
 * @fileoverview 订阅到期提醒定时任务模块
 * 
 * 该模块实现了订阅服务的到期提醒功能，主要职责包括：
 * - 根据用户设置的时区和提醒时间触发通知
 * - 检查所有活跃订阅的到期状态
 * - 发送到期提醒通知
 * - 处理自动续订逻辑
 * 
 * @module lib/cron
 */

import { and, eq, lte } from "drizzle-orm";
import { subscriptions, notificationChannels, subscriptionHistory, userSettings } from "@/db/schema";
import { dispatchNotification } from "@/lib/notifications/dispatcher";
import { advanceExpireDate } from "@/lib/subscription-utils";
import { SINGLE_USER_ID } from "@/lib/session";
import { getDb } from "@/db";

/**
 * 将 UTC 日期转换为指定时区的本地时间
 * 
 * 该函数用于将 UTC 时间转换为用户所在时区的本地时间，
 * 以便在正确的时间触发提醒通知
 * 
 * @param {Date} utcDate - UTC 日期对象
 * @param {string} timezone - IANA 时区标识符（如 "Asia/Shanghai"、"America/New_York"）
 * @returns {{ year: number; month: number; day: number; hour: number }} 本地时间对象
 *          - year: 四位年份
 *          - month: 月份（0-11，与 JavaScript Date 对象一致）
 *          - day: 日期（1-31）
 *          - hour: 小时（0-23）
 * 
 * @example
 * const utcDate = new Date("2024-01-15T12:00:00Z");
 * const local = toTimezone(utcDate, "Asia/Shanghai");
 * // local.hour 将是 20（UTC+8）
 */
function toTimezone(utcDate: Date, timezone: string): { year: number; month: number; day: number; hour: number } {
  // 使用 toLocaleString 方法将 UTC 时间转换为指定时区的格式化字符串
  const formatted = utcDate.toLocaleString("en-US", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    hour12: false, // 使用 24 小时制
  });

  // 解析格式化后的字符串，格式为 "MM/DD/YYYY, HH"
  const [datePart, hourPart] = formatted.split(", ");
  const [month, day, year] = datePart.split("/").map(Number);
  const hour = parseInt(hourPart, 10);

  // 返回本地时间对象，月份减 1 以符合 JavaScript Date 对象的月份表示（0-11）
  // 注意：当小时为 24 时（午夜），转换为 0
  return { year, month: month - 1, day, hour: hour === 24 ? 0 : hour };
}

/**
 * 执行定时任务的主函数
 * 
 * 该函数是定时任务的核心入口点，负责：
 * - 获取用户设置（时区、提醒时间）
 * - 检查当前时间是否为配置的提醒时间
 * - 查询所有活跃订阅
 * - 计算每个订阅的剩余天数
 * - 在匹配的提醒日期发送通知
 * - 处理到期当天的自动续订
 * 
 * @param {D1Database} d1 - Cloudflare D1 数据库实例
 * @returns {Promise<{ sent: number; skipped?: boolean }>} 执行结果
 *   - sent: 发送的通知数量
 *   - skipped: 是否跳过执行（当前时间不在提醒时间范围内）
 * 
 * @example
 * // 在 Cloudflare Worker 的 scheduled 事件中调用
 * export default {
 *   async scheduled(event, env, ctx) {
 *     const result = await runCron();
 *     console.log(`发送了 ${result.sent} 条通知`);
 *   }
 * }
 */
export async function runCron(): Promise<{ sent: number; skipped?: boolean }> {

  const db = await getDb();

  // 获取当前 UTC 时间
  const now = new Date();

  // 查询用户设置（目前系统仅支持单用户，userId = 1）
  const [settings] = await db
    .select()
    .from(userSettings)
    .where(eq(userSettings.userId, SINGLE_USER_ID))
    .limit(1);

  const timezone = settings?.timezone ?? "UTC";
  const notifyDeliveryMode = settings?.notifyDeliveryMode ?? "every_slot";

  // 获取用户配置的提醒小时数，默认为 [0]（午夜 0 点）
  // notifyHoursJson 存储的是 JSON 数组字符串，如 "[0, 8, 18]"
  let notifyHours: number[] = [0];
  if (settings?.notifyHoursJson) {
    try {
      notifyHours = JSON.parse(settings.notifyHoursJson) as number[];
    } catch {
      // JSON 解析失败时使用默认值
      /* use default */
    }
  }

  // 将当前 UTC 时间转换为用户本地时间
  const local = toTimezone(now, timezone);

  // 检查当前小时是否在配置的提醒时间列表中
  // 如果不在，则跳过本次执行
  if (!notifyHours.includes(local.hour)) {
    return { sent: 0, skipped: true };
  }

  // 计算触发日期
  // 用于记录通知发送日期，避免重复发送
  const triggerLocalDateKey = `${local.year}-${String(local.month + 1).padStart(2, "0")}-${String(local.day).padStart(2, "0")}`;
  const triggerDate = new Date(now);

  // 查询所有活跃订阅
  const activeSubs = await db
    .select()
    .from(subscriptions)
    .where(
      and(
        eq(subscriptions.status, "active"),
        lte(subscriptions.expireDate, new Date(now.getTime() + 365 * 24 * 60 * 60 * 1000))
      )
    );

  // 查询所有已启用的通知渠道
  // 只有存在启用的通知渠道时才发送通知
  const enabledChannels = await db
    .select({ id: notificationChannels.id })
    .from(notificationChannels)
    .where(eq(notificationChannels.enabled, true));

  // 如果没有启用的通知渠道，直接返回
  if (enabledChannels.length === 0) {
    return { sent: 0 };
  }

  // 统计发送的通知数量
  let sent = 0;

  // 遍历所有活跃订阅，检查是否需要发送提醒
  for (const sub of activeSubs) {
    // 获取订阅的到期日期
    const expireDate = new Date(sub.expireDate);

    // 将到期日期转换为用户本地时间
    const expireLocal = toTimezone(expireDate, timezone);

    // 计算到期日期的零点时间戳（UTC）
    const expireDayTs = Date.UTC(expireLocal.year, expireLocal.month, expireLocal.day);

    // 计算今天的零点时间戳（UTC）
    const todayTs = Date.UTC(local.year, local.month, local.day);

    // 计算剩余天数（向上取整）
    const daysLeft = Math.ceil((expireDayTs - todayTs) / (1000 * 60 * 60 * 24));

    // 根据简单提醒模式判断是否命中发送条件
    const shouldNotify = sub.reminderMode === "daily_from_n_days"
      ? daysLeft >= 0 && daysLeft <= sub.reminderDays
      : daysLeft === sub.reminderDays;

    if (!shouldNotify) continue;

    // 构建通知消息
    // 当天到期和提前提醒使用不同的消息格式
    const message =
      daysLeft === 0
        ? `⚠️ <b>${sub.name}</b> 今天到期！`
        : `🔔 <b>${sub.name}</b> 将在 <b>${daysLeft}</b> 天后到期（${expireDate.toLocaleDateString("zh-CN")}）`;

    // 发送通知
    await dispatchNotification(
      db,
      sub.id,
      message,
      triggerDate,
      triggerLocalDateKey,
      local.hour,
      daysLeft,
      notifyDeliveryMode
    );
    sent++;

    // 处理自动续订
    // 条件：
    // 1. 今天到期（daysLeft === 0）
    // 2. 开启了自动续订（autoRenew）
    // 3. 不是一次性订阅（billingCycle !== "once"）
    if (daysLeft === 0 && sub.autoRenew && sub.billingCycle !== "once") {
      // 获取计费周期数量，默认为 1
      const count = sub.billingCycleCount ?? 1;

      // 计算新的到期日期
      const newExpireDate = advanceExpireDate(expireDate, sub.billingCycle, count);

      await db.insert(subscriptionHistory).values({
        subscriptionId: sub.id,
        renewalType: "auto",
        previousExpireDate: sub.expireDate,
        newExpireDate,
        cost: sub.cost,
        notes: null,
      });

      // 更新订阅的到期日期
      await db
        .update(subscriptions)
        .set({ expireDate: newExpireDate, updatedAt: new Date() })
        .where(eq(subscriptions.id, sub.id));
    }
  }

  return { sent };
}
