import { relations, sql } from "drizzle-orm";
import {
  index,
  integer,
  real,
  sqliteTable,
  text,
  uniqueIndex,
} from "drizzle-orm/sqlite-core";

// 订阅类别枚举
export const SUBSCRIPTION_CATEGORIES = [
  "domain",
  "server",
  "streaming",
  "software",
  "saas",
  "tool",
  "other",
] as const;
export type SubscriptionCategory = (typeof SUBSCRIPTION_CATEGORIES)[number];

// 订阅状态枚举
export const SUBSCRIPTION_STATUSES = [
  "active",    // 活跃：正常计费和提醒
  "paused",    // 暂停：暂不计费或提醒
  "disabled",  // 禁用：已归档或失效
  "expired",   // 已过期：超过到期时间
] as const;
export type SubscriptionStatus = (typeof SUBSCRIPTION_STATUSES)[number];

// 计费周期枚举
export const BILLING_CYCLES = ["daily", "monthly", "quarterly", "yearly", "once"] as const;
export type BillingCycle = (typeof BILLING_CYCLES)[number];

// 通知渠道类型枚举
export const CHANNEL_TYPES = ["telegram", "webhook"] as const;
export type ChannelType = (typeof CHANNEL_TYPES)[number];

export const NOTIFY_DELIVERY_MODES = ["every_slot", "once_per_day"] as const;
export type NotifyDeliveryMode = (typeof NOTIFY_DELIVERY_MODES)[number];

export const REMINDER_MODES = ["daily_from_n_days", "once_on_nth_day"] as const;
export type ReminderMode = (typeof REMINDER_MODES)[number];

// 通知事件状态枚举
export const NOTIFICATION_EVENT_STATUSES = [
  "sent",    // 已发送
  "failed",  // 发送失败
  "skipped", // 已跳过 (如订阅已续费或取消)
] as const;
export type NotificationEventStatus = (typeof NOTIFICATION_EVENT_STATUSES)[number];

// -----------------------------------------------------------------------------
// [表] 订阅 (Subscriptions)
// 用于存储用户添加的所有订阅项目，包括基础信息、费用、周期和到期时间
// -----------------------------------------------------------------------------
export const subscriptions = sqliteTable(
  "subscriptions",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    userId: integer("user_id").notNull(),                         // 归属用户 ID
    name: text("name").notNull(),                                 // 订阅名称 (如 "Netflix", "AWS")
    category: text("category").notNull().default("other"),        // 类别
    url: text("url"),                                             // 相关链接 (如官网或后台)
    notes: text("notes"),                                         // 备注信息
    cost: real("cost"),                                           // 账单金额
    currency: text("currency").notNull().default("CNY"),          // 结算货币 (默认人民币)
    billingCycle: text("billing_cycle", { enum: BILLING_CYCLES }).notNull().default("yearly"), // 计费周期
    billingCycleCount: integer("billing_cycle_count").notNull().default(1),                    // 周期倍数 (如 3个月, 2年)
    autoRenew: integer("auto_renew", { mode: "boolean" }).notNull().default(false),            // 是否自动续费
    startDate: integer("start_date", { mode: "timestamp" }),      // 订阅开始日期
    expireDate: integer("expire_date", { mode: "timestamp" }).notNull(),                       // 订阅到期日期
    reminderDays: integer("reminder_days").notNull().default(7),  // 默认提前几天提醒
    reminderMode: text("reminder_mode", { enum: REMINDER_MODES }).notNull().default("daily_from_n_days"), // 提醒模式
    status: text("status", { enum: SUBSCRIPTION_STATUSES }).notNull().default("active"),       // 当前状态
    createdAt: integer("created_at", { mode: "timestamp" })
      .notNull()
      .default(sql`(unixepoch())`),
    updatedAt: integer("updated_at", { mode: "timestamp" })
      .notNull()
      .default(sql`(unixepoch())`),
  },
  (table) => [
    index("subscriptions_user_expire_idx").on(
      table.userId,
      table.expireDate,
      table.status
    ),
  ]
);

// -----------------------------------------------------------------------------
// [表] 通知渠道 (Notification Channels)
// 存储用户配置的各类提醒渠道，例如 Telegram Bot Token 和 Chat ID
// -----------------------------------------------------------------------------
export const notificationChannels = sqliteTable(
  "notification_channels",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    userId: integer("user_id").notNull(),                     // 归属用户 ID
    type: text("type", { enum: CHANNEL_TYPES }).notNull(),    // 渠道类型 (如 "telegram")
    name: text("name").notNull(),                             // 渠道自定义名称 (如 "我的 TG 机器人")
    config: text("config").notNull(),                         // 渠道配置 JSON (非敏感信息)
    enabled: integer("enabled", { mode: "boolean" }).notNull().default(true), // 是否启用该渠道
  },
  (table) => [
    index("notification_channels_user_enabled_idx").on(
      table.userId,
      table.enabled,
      table.type
    ),
  ]
);

// -----------------------------------------------------------------------------
// [表] 通知事件/日志 (Notification Events)
// 计划发送或已发送的通知消息记录，用于防止重复发送并提供发送状态追踪
// -----------------------------------------------------------------------------
export const notificationEvents = sqliteTable(
  "notification_events",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    subscriptionId: integer("subscription_id")
      .notNull()
      .references(() => subscriptions.id, { onDelete: "cascade" }), // 关联的订阅项
    channelId: integer("channel_id")
      .notNull()
      .references(() => notificationChannels.id, { onDelete: "cascade" }), // 使用的通知渠道
    triggerDate: integer("trigger_date", { mode: "timestamp" }).notNull(), // 本次命中的具体通知时段时间点
    triggerLocalDateKey: text("trigger_local_date_key").notNull(),            // 用户本地业务日键，如 2026-03-25
    triggerHour: integer("trigger_hour").notNull(),                           // 本次命中的通知小时（0-23）
    offsetDays: integer("offset_days").notNull(),                 // 相对到期日提前的天数 (用于追踪这是哪个阶段的提醒)
    status: text("status", { enum: NOTIFICATION_EVENT_STATUSES })
      .notNull(),                                                   // 当前发送状态
    message: text("message").notNull().default(""),               // 发送的通知内容
    providerMessageId: text("provider_message_id"),               // 渠道提供商返回的消息 ID (如 TG 的 message_id)
    error: text("error"),                                         // 失败原因
    sentAt: integer("sent_at", { mode: "timestamp" }),            // 实际发送时间
    createdAt: integer("created_at", { mode: "timestamp" })
      .notNull()
      .default(sql`(unixepoch())`),
  },
  (table) => [
    uniqueIndex("notification_events_dedup_unique").on(
      table.subscriptionId,
      table.channelId,
      table.triggerDate,
      table.offsetDays
    ),
    index("notification_events_status_trigger_idx").on(
      table.status,
      table.triggerDate
    ),
    index("notification_events_subscription_local_date_idx").on(
      table.subscriptionId,
      table.triggerLocalDateKey,
      table.offsetDays
    ),
  ]
);

// -----------------------------------------------------------------------------
// [关系] 订阅表关联
// -----------------------------------------------------------------------------
export const subscriptionsRelations = relations(subscriptions, ({ many }) => ({
  events: many(notificationEvents),     // 一个订阅有多个通知事件
  history: many(subscriptionHistory),   // 一个订阅有多次续费历史
}));

// -----------------------------------------------------------------------------
// [关系] 通知渠道表关联
// -----------------------------------------------------------------------------
export const notificationChannelsRelations = relations(notificationChannels, ({ many }) => ({
  events: many(notificationEvents),     // 一个渠道发送过多个通知事件
}));

// -----------------------------------------------------------------------------
// [关系] 通知事件表关联
// -----------------------------------------------------------------------------
export const notificationEventsRelations = relations(notificationEvents, ({ one }) => ({
  subscription: one(subscriptions, {    // 属于某个特定的订阅
    fields: [notificationEvents.subscriptionId],
    references: [subscriptions.id],
  }),
  channel: one(notificationChannels, {  // 通过某个特定的渠道发送
    fields: [notificationEvents.channelId],
    references: [notificationChannels.id],
  }),
}));

// 续费类型枚举
export const RENEWAL_TYPES = ["auto", "manual"] as const;
export type RenewalType = (typeof RENEWAL_TYPES)[number];

// -----------------------------------------------------------------------------
// [表] 订阅历史 (Subscription History)
// 记录订阅的续费操作，包括续费前后的日期、费用以及备注等
// -----------------------------------------------------------------------------
export const subscriptionHistory = sqliteTable(
  "subscription_history",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    subscriptionId: integer("subscription_id")
      .notNull()
      .references(() => subscriptions.id, { onDelete: "cascade" }), // 关联的订阅项
    renewalType: text("renewal_type", { enum: RENEWAL_TYPES }).notNull().default("manual"), // 续费类型：手动或自动
    previousExpireDate: integer("previous_expire_date", { mode: "timestamp" }).notNull(), // 上次到期日期
    newExpireDate: integer("new_expire_date", { mode: "timestamp" }).notNull(),           // 续费后的新到期日期
    cost: real("cost"),                                           // 此次续费的实际费用 (可能与原价不同)
    notes: text("notes"),                                         // 续费备注
    createdAt: integer("created_at", { mode: "timestamp" })
      .notNull()
      .default(sql`(unixepoch())`),
  },
  (table) => [
    index("subscription_history_subscription_idx").on(table.subscriptionId),
  ]
);

// -----------------------------------------------------------------------------
// [关系] 订阅历史表关联
// -----------------------------------------------------------------------------
export const subscriptionHistoryRelations = relations(subscriptionHistory, ({ one }) => ({
  subscription: one(subscriptions, {
    fields: [subscriptionHistory.subscriptionId],
    references: [subscriptions.id],
  }),
}));

// -----------------------------------------------------------------------------
// [表] 用户设置 (User Settings)
// 存储用户的全局偏好设置，如时区和通知时间段
// -----------------------------------------------------------------------------
export const userSettings = sqliteTable("user_settings", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  userId: integer("user_id").notNull().unique(),                          // 归属用户 ID（唯一）
  timezone: text("timezone").notNull().default("UTC"),                    // 用户时区 (IANA 格式，如 "Asia/Shanghai")
  notifyHoursJson: text("notify_hours_json").notNull().default("[0]"),    // 通知时间段 (JSON 数组，存储允许发送通知的小时，如 [0, 9, 18])
  notifyDeliveryMode: text("notify_delivery_mode", { enum: NOTIFY_DELIVERY_MODES }).notNull().default("every_slot"),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .default(sql`(unixepoch())`),
  updatedAt: integer("updated_at", { mode: "timestamp" })
    .notNull()
    .default(sql`(unixepoch())`),
});

export type Subscription = typeof subscriptions.$inferSelect;
export type NewSubscription = typeof subscriptions.$inferInsert;
export type NotificationChannel = typeof notificationChannels.$inferSelect;
export type NewNotificationChannel = typeof notificationChannels.$inferInsert;
export type NotificationEvent = typeof notificationEvents.$inferSelect;
export type NewNotificationEvent = typeof notificationEvents.$inferInsert;
export type SubscriptionHistoryRecord = typeof subscriptionHistory.$inferSelect;
export type NewSubscriptionHistoryRecord = typeof subscriptionHistory.$inferInsert;
export type UserSettings = typeof userSettings.$inferSelect;
export type NewUserSettings = typeof userSettings.$inferInsert;
