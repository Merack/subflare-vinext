function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function isValidEmailAddress(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function parsePort(value: unknown): number | null {
  if (!isNonEmptyString(value)) {
    return null;
  }

  const port = Number.parseInt(value.trim(), 10);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    return null;
  }

  return port;
}

export function isValidSmtpSecureMode(value: unknown): value is "ssl_tls" | "starttls" | "none" {
  return value === "ssl_tls" || value === "starttls" || value === "none";
}

export function validateSmtpConfig(config: Record<string, unknown>): boolean {
  return (
    isNonEmptyString(config.host)
    && parsePort(config.port) !== null
    && isValidSmtpSecureMode(config.secure)
    && isNonEmptyString(config.username)
    && isNonEmptyString(config.password)
    && isNonEmptyString(config.from)
    && isNonEmptyString(config.to)
    && isValidEmailAddress(config.from.trim())
    && isValidEmailAddress(config.to.trim())
  );
}

export function getSmtpSummary(config: Record<string, unknown>): {
  hasConfig: boolean;
  summary: string | null;
} {
  if (!validateSmtpConfig(config)) {
    return { hasConfig: false, summary: null };
  }

  return {
    hasConfig: true,
    summary: `${(config.from as string).trim()} → ${(config.to as string).trim()}`,
  };
}

export function getSmtpPort(port: unknown): number | null {
  return parsePort(port);
}
