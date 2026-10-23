import type { NotificationPayload } from "./types";
import type { Subscription } from "@/db/schema";
import { CATEGORY_LABELS, getCycleLabel } from "../subscription-utils.ts";

/**
 * 转义 HTML 特殊字符，避免用户填写的名称/备注等破坏各渠道的 HTML 渲染
 */
export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/** 按用户时区取 YYYY-MM-DD，避免 Worker 默认 UTC 导致到期日差一天 */
function formatDateInTimezone(date: Date, timezone: string): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(date));
}

function buildPayload(title: string, lines: string[]): NotificationPayload {
  const text = lines.length > 0 ? `${title}\n\n${lines.join("\n")}` : title;
  const body = lines.length > 0
    ? `<p><b>${escapeHtml(title)}</b></p><p>${lines.map((line) => escapeHtml(line)).join("<br>")}</p>`
    : `<p><b>${escapeHtml(title)}</b></p>`;

  return { title, text, html: body };
}

/**
 * 构建订阅到期提醒消息
 *
 * 纯文本版本供不解析 HTML 的渠道使用（邮件 text 段、企业微信、Bark、NotifyX、Webhook），
 * HTML 版本供 Telegram 与邮件 html 段使用
 */
export function buildExpiryNotification(
  sub: Subscription,
  daysLeft: number,
  timezone: string
): NotificationPayload {
  const title = daysLeft === 0
    ? `⚠️ ${sub.name} 今天到期！`
    : `🔔 ${sub.name} 将在 ${daysLeft} 天后到期`;

  const lines = [`到期日：${formatDateInTimezone(sub.expireDate, timezone)}`];

  if (sub.cost != null) {
    const cycle = getCycleLabel(sub);
    lines.push(`金额：${sub.cost} ${sub.currency}${cycle ? ` / ${cycle}` : ""}`);
  }

  lines.push(`分类：${CATEGORY_LABELS[sub.category] ?? sub.category}`);
  lines.push(`自动续费：${sub.autoRenew ? "已开启" : "未开启"}`);

  const notes = sub.notes?.trim();
  if (notes) lines.push(`备注：${notes}`);

  const url = sub.url?.trim();
  if (url) lines.push(`链接：${url}`);

  return buildPayload(title, lines);
}

/** 渠道测试消息 */
export function buildTestNotification(): NotificationPayload {
  return buildPayload("Subflare 测试消息", ["✅ 通知渠道配置正确！"]);
}
