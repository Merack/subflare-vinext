import { Resend } from "resend";
import type { NotificationPayload, NotificationStrategy, SendResult } from "./types";

interface ResendConfig {
  apiKey: string;
  from: string;
  to: string;
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function isValidEmailAddress(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

export function validateResendConfig(config: Record<string, unknown>): boolean {
  return (
    isNonEmptyString(config.apiKey)
    && isNonEmptyString(config.from)
    && isNonEmptyString(config.to)
    && isValidEmailAddress(config.from.trim())
    && isValidEmailAddress(config.to.trim())
  );
}

export function getResendSummary(config: Record<string, unknown>): {
  hasConfig: boolean;
  summary: string | null;
} {
  if (!validateResendConfig(config)) {
    return { hasConfig: false, summary: null };
  }

  return {
    hasConfig: true,
    summary: `${(config.from as string).trim()} → ${(config.to as string).trim()}`,
  };
}

export class ResendStrategy implements NotificationStrategy {
  readonly type = "resend";

  validateConfig(config: Record<string, unknown>): boolean {
    return validateResendConfig(config);
  }

  async send(payload: NotificationPayload, config: Record<string, unknown>): Promise<SendResult> {
    if (!validateResendConfig(config)) {
      return { success: false, error: "Resend 配置不完整或格式错误" };
    }

    const cfg = config as unknown as ResendConfig;
    const resend = new Resend(cfg.apiKey.trim());

    try {
      const { data, error } = await resend.emails.send({
        from: cfg.from.trim(),
        to: cfg.to.trim(),
        subject: payload.title,
        text: payload.text,
        html: payload.html,
      });

      if (error) {
        return { success: false, error: error.message };
      }

      return {
        success: true,
        providerMessageId: data?.id,
      };
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : "Network error" };
    }
  }
}
