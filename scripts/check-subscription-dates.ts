/**
 * 订阅周期日期自检
 *
 * 运行：node --experimental-strip-types scripts/check-subscription-dates.ts
 * 说明：到期日按日历日存储（UTC 零点），这里覆盖月末和跨月的推进结果
 */
import assert from "node:assert/strict";
import {
  advanceExpireDate,
  calcExpireDateFromStartDate,
  getCalendarDayKey,
  getDaysLeft,
  getEffectiveStatus,
  getTodayKey,
} from "../lib/subscription-utils.ts";

const at = (iso: string) => new Date(iso);

// 月末不溢出：夹到目标月最后一天
assert.equal(advanceExpireDate(at("2026-01-31T00:00:00Z"), "monthly").toISOString(), "2026-02-28T00:00:00.000Z");
assert.equal(advanceExpireDate(at("2026-08-31T00:00:00Z"), "monthly").toISOString(), "2026-09-30T00:00:00.000Z");
assert.equal(advanceExpireDate(at("2024-01-31T00:00:00Z"), "monthly").toISOString(), "2024-02-29T00:00:00.000Z");
assert.equal(advanceExpireDate(at("2026-03-31T00:00:00Z"), "quarterly").toISOString(), "2026-06-30T00:00:00.000Z");

// 普通日期不受影响
assert.equal(advanceExpireDate(at("2026-03-15T00:00:00Z"), "monthly").toISOString(), "2026-04-15T00:00:00.000Z");
assert.equal(advanceExpireDate(at("2026-03-15T00:00:00Z"), "monthly", 3).toISOString(), "2026-06-15T00:00:00.000Z");
assert.equal(advanceExpireDate(at("2026-03-15T00:00:00Z"), "yearly", 2).toISOString(), "2028-03-15T00:00:00.000Z");
assert.equal(advanceExpireDate(at("2026-03-15T00:00:00Z"), "daily", 1).toISOString(), "2026-03-16T00:00:00.000Z");
assert.equal(advanceExpireDate(at("2026-03-15T00:00:00Z"), "once", 1).toISOString(), "2026-03-15T00:00:00.000Z");

// 表单里的"开始日期 + 周期"算到期日
assert.equal(calcExpireDateFromStartDate("2026-01-31", "monthly", 1), "2026-02-28");
assert.equal(calcExpireDateFromStartDate("2026-01-01", "yearly", 1), "2027-01-01");
assert.equal(calcExpireDateFromStartDate("2026-01-01", "once", 1), "");

// 到期当天算 0 天：既不算已过期，也不算“还剩 1 天”
assert.equal(getDaysLeft(at("2026-03-15T00:00:00Z"), "2026-03-15"), 0);
assert.equal(getDaysLeft(at("2026-03-15T00:00:00Z"), "2026-03-14"), 1);
assert.equal(getDaysLeft(at("2026-03-15T00:00:00Z"), "2026-03-16"), -1);
assert.equal(getCalendarDayKey(at("2026-03-15T00:00:00Z")), "2026-03-15");
assert.equal(getEffectiveStatus({ expireDate: at("2026-03-15T00:00:00Z"), status: "active", reminderDays: 7, reminderMode: "daily_from_n_days" }, "2026-03-15").isExpired, false);

// “今天”按用户时区取，不按服务端 UTC
assert.equal(getTodayKey("Asia/Shanghai", at("2026-03-14T16:30:00Z")), "2026-03-15");
assert.equal(getTodayKey("America/New_York", at("2026-03-15T02:00:00Z")), "2026-03-14");

console.log("订阅周期日期自检通过");
console.log("到期日边界自检通过");
