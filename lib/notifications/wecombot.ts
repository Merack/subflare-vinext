import type { NotificationPayload, NotificationStrategy, SendResult } from "./types";

interface WecomBotConfig {
  webhookUrl: string;
}

interface WecomBotApiResponse {
  errcode: number;
  errmsg: string;
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

export function validateWecomBotConfig(config: Record<string, unknown>): boolean {
  if (!isNonEmptyString(config.webhookUrl)) {
    return false;
  }

  try {
    const url = new URL(config.webhookUrl.trim());
    return (
      url.protocol === "https:" &&
      url.hostname === "qyapi.weixin.qq.com" &&
      url.pathname === "/cgi-bin/webhook/send" &&
      isNonEmptyString(url.searchParams.get("key"))
    );
  } catch {
    return false;
  }
}

export function getWecomBotSummary(config: Record<string, unknown>): {
  hasConfig: boolean;
  summary: string | null;
} {
  if (!isNonEmptyString(config.webhookUrl)) {
    return { hasConfig: false, summary: null };
  }

  try {
    const url = new URL(config.webhookUrl.trim());
    const key = url.searchParams.get("key");

    if (!key) {
      return { hasConfig: false, summary: null };
    }

    return {
      hasConfig: true,
      summary: `key ${key.slice(0, 4)}***${key.slice(-4)}`,
    };
  } catch {
    return { hasConfig: false, summary: null };
  }
}

export class WecomBotStrategy implements NotificationStrategy {
  readonly type = "wecombot";

  validateConfig(config: Record<string, unknown>): boolean {
    return validateWecomBotConfig(config);
  }

  async send(payload: NotificationPayload, config: Record<string, unknown>): Promise<SendResult> {
    if (!validateWecomBotConfig(config)) {
      return { success: false, error: "企业微信机器人配置不完整或格式错误" };
    }

    const cfg = config as unknown as WecomBotConfig;

    try {
      const res = await fetch(cfg.webhookUrl.trim(), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          msgtype: "text",
          text: {
            content: payload.text,
          },
        }),
      });

      const data = (await res.json()) as WecomBotApiResponse;

      if (!res.ok) {
        return { success: false, error: `企业微信请求失败: ${res.status}` };
      }

      if (data.errcode !== 0) {
        return { success: false, error: data.errmsg || `企业微信错误: ${data.errcode}` };
      }

      return {
        success: true,
        providerMessageId: undefined,
      };
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : "Network error" };
    }
  }
}
