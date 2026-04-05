import nodemailer from "nodemailer";
import SMTPTransport from "nodemailer/lib/smtp-transport";
import type { NotificationStrategy, SendResult } from "./types";
import { getSmtpPort, isValidSmtpSecureMode, validateSmtpConfig } from "./smtp-config";

interface SmtpConfig {
  host: string;
  port: string;
  secure: "ssl_tls" | "starttls" | "none";
  username: string;
  password: string;
  from: string;
  to: string;
}
function getTransportSecurity(mode: SmtpConfig["secure"]): Pick<SMTPTransport.Options, "secure" | "requireTLS"> {
  if (mode === "ssl_tls") {
    return { secure: true, requireTLS: false };
  }

  if (mode === "starttls") {
    return { secure: false, requireTLS: true };
  }

  return { secure: false, requireTLS: false };
}

export class SmtpStrategy implements NotificationStrategy {
  readonly type = "smtp";

  validateConfig(config: Record<string, unknown>): boolean {
    return validateSmtpConfig(config);
  }

  async send(message: string, config: Record<string, unknown>): Promise<SendResult> {
    if (!validateSmtpConfig(config)) {
      return { success: false, error: "SMTP 配置不完整或格式错误" };
    }

    const cfg = config as unknown as SmtpConfig;
    const port = getSmtpPort(cfg.port);

    if (port === null || !isValidSmtpSecureMode(cfg.secure)) {
      return { success: false, error: "SMTP 配置不完整或格式错误" };
    }

    const security = getTransportSecurity(cfg.secure);
    const transportOptions: SMTPTransport.Options = {
      host: cfg.host.trim(),
      port,
      secure: security.secure,
      requireTLS: security.requireTLS,
      auth: {
        user: cfg.username.trim(),
        pass: cfg.password,
      },
    };
    const transporter = nodemailer.createTransport(transportOptions);

    try {
      const info = await transporter.sendMail({
        from: cfg.from.trim(),
        to: cfg.to.trim(),
        subject: "Subflare 通知",
        text: message,
      });

      return {
        success: true,
        providerMessageId: info.messageId,
      };
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : "Network error" };
    }
  }
}
