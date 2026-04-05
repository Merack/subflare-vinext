import { CHANNEL_TYPES, type ChannelType } from "@/db/schema";
import type { NotificationChannelDescriptor } from "./types";
import { TelegramStrategy } from "./telegram";
import { getWebhookSummary, validateWebhookConfig } from "./webhook";
import { getWecomBotSummary, validateWecomBotConfig } from "./wecombot";
import { getBarkSummary, validateBarkConfig } from "./bark";
import { getNotifyXSummary, validateNotifyXConfig } from "./notifyx";
import { getResendSummary, validateResendConfig } from "./resend";
import { getSmtpSummary, validateSmtpConfig } from "./smtp-config";

function maskMiddle(value: string, left = 2, right = 2): string {
  if (value.length <= left + right) return value;
  return `${value.slice(0, left)}***${value.slice(-right)}`;
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

const telegramStrategy = new TelegramStrategy();

const telegramDescriptor: NotificationChannelDescriptor = {
  type: "telegram",
  label: "Telegram",
  namePlaceholder: "我的 Telegram",
  fields: [
    {
      key: "botToken",
      label: "Bot Token",
      placeholder: "123456:ABC...",
      requiredOnCreate: true,
      allowBlankOnEdit: true,
      inputType: "password",
      description: "编辑时留空表示保持原值不变",
    },
    {
      key: "chatId",
      label: "Chat ID",
      placeholder: "-100...",
      requiredOnCreate: true,
      allowBlankOnEdit: true,
      description: "编辑时留空表示保持原值不变",
    },
  ],
  validateConfig(config) {
    return telegramStrategy.validateConfig(config);
  },
  getSummary(config) {
    if (!isNonEmptyString(config.chatId)) {
      return { hasConfig: false, summary: null };
    }

    return {
      hasConfig: true,
      summary: `Chat ID ${maskMiddle(config.chatId.trim())}`,
    };
  },
};

const webhookDescriptor: NotificationChannelDescriptor = {
  type: "webhook",
  label: "Webhook",
  namePlaceholder: "我的 Webhook",
  fields: [
    {
      key: "url",
      label: "Webhook URL",
      placeholder: "https://example.com/webhook",
      requiredOnCreate: true,
      allowBlankOnEdit: true,
      description: "请输入完整 URL. 编辑时留空表示保持原值不变.",
    },
    {
      key: "method",
      label: "请求方法",
      requiredOnCreate: true,
      inputType: "select",
      options: [
        { value: "post", label: "POST" },
        { value: "get", label: "GET" },
        { value: "put", label: "PUT" },
      ],
      description: "默认使用 POST.",
    },
    {
      key: "headers",
      label: "自定义请求头(JSON, 可选)",
      placeholder: '{"Authorization":"Bearer xxx"}',
      allowBlankOnEdit: true,
      description: "请输入 JSON 对象，键和值都必须是非空字符串. 编辑时留空表示保持原值不变.",
    },
  ],
  validateConfig(config) {
    return validateWebhookConfig(config);
  },
  getSummary(config) {
    return getWebhookSummary(config);
  },
};

const wecomBotDescriptor: NotificationChannelDescriptor = {
  type: "wecombot",
  label: "WeCom Bot",
  namePlaceholder: "我的企业微信机器人",
  fields: [
    {
      key: "webhookUrl",
      label: "Webhook URL",
      placeholder: "https://qyapi.weixin.qq.com/cgi-bin/webhook/send?key=...",
      requiredOnCreate: true,
      allowBlankOnEdit: true,
      description: "请输入企业微信机器人 Webhook URL. 编辑时留空表示保持原值不变.",
    },
  ],
  validateConfig(config) {
    return validateWecomBotConfig(config);
  },
  getSummary(config) {
    return getWecomBotSummary(config);
  },
};

const barkDescriptor: NotificationChannelDescriptor = {
  type: "bark",
  label: "Bark",
  namePlaceholder: "我的 Bark",
  fields: [
    {
      key: "serverUrl",
      label: "Server URL",
      placeholder: "https://api.day.app",
      requiredOnCreate: true,
      allowBlankOnEdit: true,
      description: "支持官方服务或自建 Bark 服务地址. 编辑时留空表示保持原值不变.",
    },
    {
      key: "deviceKey",
      label: "Device Key",
      placeholder: "xxxxxxxxxxxxxxxxxxxxxxxx",
      requiredOnCreate: true,
      allowBlankOnEdit: true,
      inputType: "password",
      description: "请输入 Bark 设备 Key. 编辑时留空表示保持原值不变.",
    },
  ],
  validateConfig(config) {
    return validateBarkConfig(config);
  },
  getSummary(config) {
    return getBarkSummary(config);
  },
};

const notifyXDescriptor: NotificationChannelDescriptor = {
  type: "notifyx",
  label: "NotifyX",
  namePlaceholder: "我的 NotifyX",
  fields: [
    {
      key: "apiKey",
      label: "API Key",
      placeholder: "xxxxxxxxxxxxxxxxxxxxxxxx",
      requiredOnCreate: true,
      allowBlankOnEdit: true,
      inputType: "password",
      description: "请输入 NotifyX API Key. 编辑时留空表示保持原值不变.",
    },
  ],
  validateConfig(config) {
    return validateNotifyXConfig(config);
  },
  getSummary(config) {
    return getNotifyXSummary(config);
  },
};

const resendDescriptor: NotificationChannelDescriptor = {
  type: "resend",
  label: "Resend",
  namePlaceholder: "我的 Resend",
  fields: [
    {
      key: "apiKey",
      label: "API Key",
      placeholder: "re_xxxxxxxxxxxxxxxxxxxxxxxx",
      requiredOnCreate: true,
      allowBlankOnEdit: true,
      inputType: "password",
      description: "请输入 Resend API Key. 编辑时留空表示保持原值不变.",
    },
    {
      key: "from",
      label: "From",
      placeholder: "notice@example.com",
      requiredOnCreate: true,
      allowBlankOnEdit: true,
      description: "必须在 Resend 后台验证发件域",
    },
    {
      key: "to",
      label: "To",
      placeholder: "user@example.com",
      requiredOnCreate: true,
      allowBlankOnEdit: true,
      description: "请输入接收通知的邮箱地址. 编辑时留空表示保持原值不变.",
    },
  ],
  validateConfig(config) {
    return validateResendConfig(config);
  },
  getSummary(config) {
    return getResendSummary(config);
  },
};

const smtpDescriptor: NotificationChannelDescriptor = {
  type: "smtp",
  label: "SMTP",
  namePlaceholder: "我的 SMTP",
  fields: [
    {
      key: "host",
      label: "Host",
      placeholder: "smtp.example.com",
      requiredOnCreate: true,
      allowBlankOnEdit: true,
      description: "请输入 SMTP 服务器地址. 编辑时留空表示保持原值不变.",
    },
    {
      key: "port",
      label: "Port",
      placeholder: "587",
      requiredOnCreate: true,
      allowBlankOnEdit: true,
      description: "请输入 1-65535 之间的端口号. 编辑时留空表示保持原值不变.",
    },
    {
      key: "secure",
      label: "加密方式",
      requiredOnCreate: true,
      inputType: "select",
      options: [
        { value: "ssl_tls", label: "SSL/TLS (通常 465)" },
        { value: "starttls", label: "STARTTLS (通常 587)" },
        { value: "none", label: "无加密" },
      ],
      description: "请选择 SMTP 连接加密方式.",
    },
    {
      key: "username",
      label: "Username",
      placeholder: "user@example.com",
      requiredOnCreate: true,
      allowBlankOnEdit: true,
      description: "请输入 SMTP 用户名. 编辑时留空表示保持原值不变.",
    },
    {
      key: "password",
      label: "Password",
      placeholder: "••••••••",
      requiredOnCreate: true,
      allowBlankOnEdit: true,
      inputType: "password",
      description: "请输入 SMTP 密码或授权码. 编辑时留空表示保持原值不变.",
    },
    {
      key: "from",
      label: "From",
      placeholder: "notice@example.com",
      requiredOnCreate: true,
      allowBlankOnEdit: true,
      description: "请输入发件邮箱地址. 编辑时留空表示保持原值不变.",
    },
    {
      key: "to",
      label: "To",
      placeholder: "user@example.com",
      requiredOnCreate: true,
      allowBlankOnEdit: true,
      description: "请输入接收通知的邮箱地址. 编辑时留空表示保持原值不变.",
    },
  ],
  validateConfig(config) {
    return validateSmtpConfig(config);
  },
  getSummary(config) {
    return getSmtpSummary(config);
  },
};

export const channelDescriptors: Record<ChannelType, NotificationChannelDescriptor> = {
  telegram: telegramDescriptor,
  webhook: webhookDescriptor,
  wecombot: wecomBotDescriptor,
  bark: barkDescriptor,
  notifyx: notifyXDescriptor,
  resend: resendDescriptor,
  smtp: smtpDescriptor,
};

export function getChannelDescriptor(type: string): NotificationChannelDescriptor | undefined {
  return channelDescriptors[type as ChannelType];
}

export const channelTypeOptions = CHANNEL_TYPES.map((type) => ({
  value: type,
  label: channelDescriptors[type].label,
}));
