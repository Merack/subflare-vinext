import type { NotificationPayload, NotificationStrategy, SendResult } from "./types";

interface BarkConfig {
  serverUrl: string;
  deviceKey: string;
}

interface BarkApiResponse {
  code?: number;
  message?: string;
  timestamp?: number;
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function normalizeServerUrl(serverUrl: string): string {
  return serverUrl.trim().replace(/\/+$/, "");
}

function getServerOrigin(serverUrl: string): string | null {
  try {
    return new URL(normalizeServerUrl(serverUrl)).origin;
  } catch {
    return null;
  }
}

export function validateBarkConfig(config: Record<string, unknown>): boolean {
  if (!isNonEmptyString(config.serverUrl) || !isNonEmptyString(config.deviceKey)) {
    return false;
  }

  try {
    const url = new URL(normalizeServerUrl(config.serverUrl));
    return (url.protocol === "https:" || url.protocol === "http:") && config.deviceKey.trim().length > 0;
  } catch {
    return false;
  }
}

export function getBarkSummary(config: Record<string, unknown>): {
  hasConfig: boolean;
  summary: string | null;
} {
  if (!validateBarkConfig(config)) {
    return { hasConfig: false, summary: null };
  }

  const origin = getServerOrigin(config.serverUrl as string);
  const deviceKey = (config.deviceKey as string).trim();

  if (!origin) {
    return { hasConfig: false, summary: null };
  }

  return {
    hasConfig: true,
    summary: `${origin} · Key ${deviceKey.slice(0, 4)}***${deviceKey.slice(-4)}`,
  };
}

export class BarkStrategy implements NotificationStrategy {
  readonly type = "bark";

  validateConfig(config: Record<string, unknown>): boolean {
    return validateBarkConfig(config);
  }

  async send(payload: NotificationPayload, config: Record<string, unknown>): Promise<SendResult> {
    if (!validateBarkConfig(config)) {
      return { success: false, error: "Bark 配置不完整或格式错误" };
    }

    const cfg = config as unknown as BarkConfig;
    const endpoint = `${normalizeServerUrl(cfg.serverUrl)}/${cfg.deviceKey.trim()}`;

    try {
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          body: payload.text,
        }),
      });

      const data = (await res.json()) as BarkApiResponse;

      if (!res.ok) {
        return { success: false, error: data.message ?? `Bark 请求失败: ${res.status}` };
      }

      if (data.code !== 200) {
        return { success: false, error: data.message ?? `Bark 错误: ${data.code ?? "unknown"}` };
      }

      return {
        success: true,
        providerMessageId: data.timestamp ? String(data.timestamp) : undefined,
      };
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : "Network error" };
    }
  }
}
