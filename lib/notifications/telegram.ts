import type { NotificationStrategy, SendResult } from "./types";

interface TelegramConfig {
  chatId: string;
  botToken?: string;
}

interface TelegramApiResponse {
  ok: boolean;
  result?: { message_id: number };
  description?: string;
}

export class TelegramStrategy implements NotificationStrategy {
  readonly type = "telegram";

  validateConfig(config: Record<string, unknown>): boolean {
    return typeof config.chatId === "string"
      && config.chatId.trim().length > 0
      && typeof config.botToken === "string"
      && config.botToken.trim().length > 0;
  }

  async send(
    message: string,
    config: Record<string, unknown>
  ): Promise<SendResult> {
    const cfg = config as unknown as TelegramConfig;
    const token = cfg.botToken;

    if (!token) {
      return { success: false, error: "Bot token not configured" };
    }

    try {
      const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: cfg.chatId,
          text: message,
          parse_mode: "HTML",
        }),
      });

      const data = (await res.json()) as TelegramApiResponse;

      if (!data.ok) {
        return { success: false, error: data.description ?? "Telegram API error" };
      }

      return {
        success: true,
        providerMessageId: String(data.result?.message_id ?? ""),
      };
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : "Network error" };
    }
  }
}
