import type { NotificationPayload, NotificationStrategy, SendResult } from "./types";

interface NotifyXConfig {
  apiKey: string;
}

interface NotifyXApiResponse {
  id?: number | string;
  message?: string;
  status?: string;
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

export function validateNotifyXConfig(config: Record<string, unknown>): boolean {
  return isNonEmptyString(config.apiKey);
}

export function getNotifyXSummary(config: Record<string, unknown>): {
  hasConfig: boolean;
  summary: string | null;
} {
  if (!validateNotifyXConfig(config)) {
    return { hasConfig: false, summary: null };
  }

  const apiKey = (config.apiKey as string).trim();

  return {
    hasConfig: true,
    summary: `Key ${apiKey.slice(0, 4)}***${apiKey.slice(-4)}`,
  };
}

export class NotifyXStrategy implements NotificationStrategy {
  readonly type = "notifyx";

  validateConfig(config: Record<string, unknown>): boolean {
    return validateNotifyXConfig(config);
  }

  async send(payload: NotificationPayload, config: Record<string, unknown>): Promise<SendResult> {
    if (!validateNotifyXConfig(config)) {
      return { success: false, error: "NotifyX 配置不完整或格式错误" };
    }

    const cfg = config as unknown as NotifyXConfig;
    const endpoint = `https://www.notifyx.cn/api/v1/send/${cfg.apiKey.trim()}`;

    try {
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: payload.title,
          content: payload.text,
        }),
      });

      const data = (await res.json()) as NotifyXApiResponse;

      if (!res.ok) {
        return { success: false, error: data.message ?? `NotifyX 请求失败: ${res.status}` };
      }

      if (data.status && data.status !== "queued") {
        return { success: false, error: data.message ?? `NotifyX 返回状态异常: ${data.status}` };
      }

      return {
        success: true,
        providerMessageId: data.id ? String(data.id) : undefined,
      };
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : "Network error" };
    }
  }
}
