export interface SendResult {
  success: boolean;
  providerMessageId?: string;
  error?: string;
}

/**
 * 统一的通知消息载荷
 *
 * text 为纯文本（不含任何标签），title 可用作邮件主题或推送标题
 * html 为带块级标签的版本（邮件用），htmlInline 只含内联标签与换行（Telegram HTML 不支持 p/br）
 */
export interface NotificationPayload {
  title: string;
  text: string;
  html: string;
  htmlInline: string;
}

export interface NotificationStrategy {
  readonly type: string;
  send(payload: NotificationPayload, config: Record<string, unknown>): Promise<SendResult>;
  validateConfig(config: Record<string, unknown>): boolean;
}

export interface NotificationChannelFieldOption {
  value: string;
  label: string;
}

export interface NotificationChannelFieldDefinition {
  key: string;
  label: string;
  placeholder?: string;
  requiredOnCreate?: boolean;
  allowBlankOnEdit?: boolean;
  inputType?: "text" | "password" | "select";
  options?: NotificationChannelFieldOption[];
  description?: string;
}

export interface NotificationChannelDescriptor {
  type: string;
  label: string;
  namePlaceholder: string;
  fields: NotificationChannelFieldDefinition[];
  validateConfig(config: Record<string, unknown>): boolean;
  getSummary(config: Record<string, unknown>): {
    hasConfig: boolean;
    summary: string | null;
  };
}
