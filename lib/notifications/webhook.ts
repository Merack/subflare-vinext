import type { NotificationPayload, NotificationStrategy, SendResult } from "./types";

const WEBHOOK_METHODS = ["post", "get", "put"] as const;
type WebhookMethod = (typeof WEBHOOK_METHODS)[number];

interface WebhookConfig {
  url: string;
  method?: string;
  headers?: string;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function normalizeMethod(value: unknown): WebhookMethod {
  return typeof value === "string" && WEBHOOK_METHODS.includes(value.toLowerCase() as WebhookMethod)
    ? value.toLowerCase() as WebhookMethod
    : "post";
}

function parseHeaders(value: unknown): Record<string, string> | null {
  if (value === undefined || value === null || value === "") {
    return {};
  }

  if (!isNonEmptyString(value)) {
    return null;
  }

  try {
    const parsed = JSON.parse(value);
    if (!isRecord(parsed)) {
      return null;
    }

    const headers: Record<string, string> = {};
    for (const [key, headerValue] of Object.entries(parsed)) {
      if (!isNonEmptyString(key) || !isNonEmptyString(headerValue)) {
        return null;
      }
      headers[key.trim()] = headerValue.trim();
    }

    return headers;
  } catch {
    return null;
  }
}

export function validateWebhookConfig(config: Record<string, unknown>): boolean {
  if (!isNonEmptyString(config.url)) {
    return false;
  }

  try {
    new URL(config.url.trim());
  } catch {
    return false;
  }

  if (config.method !== undefined && normalizeMethod(config.method) !== String(config.method).toLowerCase()) {
    return false;
  }

  return parseHeaders(config.headers) !== null;
}

export function getWebhookSummary(config: Record<string, unknown>): {
  hasConfig: boolean;
  summary: string | null;
} {
  if (!isNonEmptyString(config.url)) {
    return { hasConfig: false, summary: null };
  }

  try {
    const url = new URL(config.url.trim());
    return {
      hasConfig: true,
      summary: url.hostname || null,
    };
  } catch {
    return { hasConfig: false, summary: null };
  }
}

export class WebhookStrategy implements NotificationStrategy {
  readonly type = "webhook";

  validateConfig(config: Record<string, unknown>): boolean {
    return validateWebhookConfig(config);
  }

  async send(payload: NotificationPayload, config: Record<string, unknown>): Promise<SendResult> {
    if (!validateWebhookConfig(config)) {
      return { success: false, error: "Webhook 配置不完整或格式错误" };
    }

    const cfg = config as unknown as WebhookConfig;
    const method = normalizeMethod(cfg.method);
    const customHeaders = parseHeaders(cfg.headers);

    if (customHeaders === null) {
      return { success: false, error: "Webhook 请求头格式错误" };
    }

    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      "User-Agent": "Subflare-Webhook/1.0",
      ...customHeaders,
    };

    const init: RequestInit = {
      method: method.toUpperCase(),
      headers,
    };

    if (method !== "get") {
      init.body = JSON.stringify({ text: payload.text });
    }

    try {
      const res = await fetch(cfg.url.trim(), init);
      if (!res.ok) {
        return { success: false, error: `Webhook request failed: ${res.status}` };
      }

      return {
        success: true,
        providerMessageId: res.headers.get("x-request-id") ?? undefined,
      };
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : "Network error" };
    }
  }
}
