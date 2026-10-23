/**
 * 通知消息构建自检
 *
 * 运行：node --experimental-strip-types scripts/check-notification-message.ts
 * 说明：仓库没有测试框架，这里用 node:assert 覆盖消息构建的关键分支
 */
import assert from "node:assert/strict";
import type { Subscription } from "../db/schema";
import { buildExpiryNotification, buildTestNotification } from "../lib/notifications/message.ts";

function makeSub(overrides: Partial<Subscription> = {}): Subscription {
  return {
    id: 1,
    userId: 1,
    name: "Netflix",
    category: "streaming",
    url: null,
    notes: null,
    cost: 68,
    currency: "CNY",
    billingCycle: "monthly",
    billingCycleCount: 1,
    autoRenew: true,
    startDate: null,
    expireDate: new Date("2026-03-24T16:00:00Z"),
    reminderDays: 7,
    reminderMode: "daily_from_n_days",
    status: "active",
    createdAt: new Date(0),
    updatedAt: new Date(0),
    ...overrides,
  } as Subscription;
}

// 提前提醒：含金额/周期/分类/自动续费，纯文本无标签且多行
const payload = buildExpiryNotification(makeSub(), 7, "Asia/Shanghai");
assert.equal(payload.title, "🔔 Netflix 将在 7 天后到期");
assert.match(payload.text, /^🔔 Netflix 将在 7 天后到期\n\n/);
assert.match(payload.text, /到期日：2026-03-25/, "按用户时区取日期");
assert.match(payload.text, /金额：68 CNY \/ 每月/);
assert.match(payload.text, /分类：流媒体/);
assert.match(payload.text, /自动续费：已开启/);
assert.doesNotMatch(payload.text, /<\/?[a-z]+>/i, "纯文本版本不能含标签");
assert.match(payload.html, /<b>🔔 Netflix 将在 7 天后到期<\/b>/);
assert.match(payload.html, /<br>/);

// 可省略字段为空时不出现
assert.doesNotMatch(payload.text, /备注：|链接：/);

// 当天到期 + 备注/链接 + HTTP 特殊字符转义
const expired = buildExpiryNotification(
  makeSub({
    name: "A <script>&\"B\"",
    expireDate: new Date("2026-03-25T01:00:00Z"),
    notes: "家庭共享",
    url: "https://example.com/a?b=1&c=2",
    cost: null,
    autoRenew: false,
  }),
  0,
  "Asia/Shanghai"
);
assert.match(expired.title, /今天到期！/);
assert.match(expired.text, /备注：家庭共享/);
assert.match(expired.text, /链接：https:\/\/example\.com\/a\?b=1&c=2/);
assert.match(expired.text, /自动续费：未开启/);
assert.doesNotMatch(expired.text, /金额：/, "cost 为空时不带金额行");
assert.doesNotMatch(expired.html, /<script>/, "HTML 版本必须转义用户输入");
assert.match(expired.html, /&lt;script&gt;/);
assert.match(expired.html, /&amp;c=2/);

// 测试消息
const test = buildTestNotification();
assert.equal(test.title, "Subflare 测试消息");
assert.match(test.text, /✅ 通知渠道配置正确！/);
assert.doesNotMatch(test.text, /<\/?[a-z]+>/i);

console.log("通知消息自检通过");
