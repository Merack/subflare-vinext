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

/** 到期日按日历日存储（UTC 零点），取 UTC 日期即可；按用户时区换算会让西半球少一天 */
function formatCalendarDate(date: Date): string {
  return new Date(date).toISOString().slice(0, 10);
}

function buildPayload(title: string, lines: string[]): NotificationPayload {
  const text = lines.length > 0 ? `${title}\n\n${lines.join("\n")}` : title;
  const escapedLines = lines.map((line) => escapeHtml(line));
  const body = lines.length > 0
    ? `<p><b>${escapeHtml(title)}</b></p><p>${escapedLines.join("<br>")}</p>`
    : `<p><b>${escapeHtml(title)}</b></p>`;
  // Telegram HTML 不支持 <p>/<br>，只用内联标签 + 换行
  const inline = lines.length > 0
    ? `<b>${escapeHtml(title)}</b>\n\n${escapedLines.join("\n")}`
    : `<b>${escapeHtml(title)}</b>`;

  return { title, text, html: body, htmlInline: inline };
}

/**
 * 构建订阅到期提醒消息
 *
 * 纯文本版本供不解析 HTML 的渠道使用（邮件 text 段、企业微信、Bark、NotifyX、Webhook），
 * HTML 版本供 Telegram 与邮件 html 段使用
 */
export function buildExpiryNotification(
  sub: Subscription,
  daysLeft: number
): NotificationPayload {
  const title = daysLeft === 0
    ? `⚠️ ${sub.name} 今天到期！`
    : `🔔 ${sub.name} 将在 ${daysLeft} 天后到期`;

  const lines = [`到期日：${formatCalendarDate(sub.expireDate)}`];

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
