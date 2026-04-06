CREATE TABLE IF NOT EXISTS `notification_channels` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_id` integer NOT NULL,
	`type` text NOT NULL,
	`name` text NOT NULL,
	`config` text NOT NULL,
	`enabled` integer DEFAULT true NOT NULL,
	`is_default` integer DEFAULT false NOT NULL,
	`last_error` text
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `notification_channels_user_enabled_idx` ON `notification_channels` (`user_id`,`enabled`,`type`);--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `notification_events` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`subscription_id` integer NOT NULL,
	`channel_id` integer NOT NULL,
	`trigger_date` integer NOT NULL,
	`trigger_local_date_key` text NOT NULL,
	`trigger_hour` integer NOT NULL,
	`offset_days` integer NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`message` text DEFAULT '' NOT NULL,
	`success` integer DEFAULT false NOT NULL,
	`provider_message_id` text,
	`error` text,
	`sent_at` integer,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`subscription_id`) REFERENCES `subscriptions`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`channel_id`) REFERENCES `notification_channels`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS `notification_events_dedup_unique` ON `notification_events` (`subscription_id`,`channel_id`,`trigger_date`,`offset_days`);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `notification_events_status_trigger_idx` ON `notification_events` (`status`,`trigger_date`);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `notification_events_subscription_local_date_idx` ON `notification_events` (`subscription_id`,`trigger_local_date_key`,`offset_days`);--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `subscription_history` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`subscription_id` integer NOT NULL,
	`renewal_type` text DEFAULT 'manual' NOT NULL,
	`previous_expire_date` integer NOT NULL,
	`new_expire_date` integer NOT NULL,
	`cost` real,
	`notes` text,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`subscription_id`) REFERENCES `subscriptions`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `subscription_history_subscription_idx` ON `subscription_history` (`subscription_id`);--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `subscriptions` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_id` integer NOT NULL,
	`name` text NOT NULL,
	`category` text DEFAULT 'other' NOT NULL,
	`url` text,
	`notes` text,
	`cost` real,
	`currency` text DEFAULT 'CNY' NOT NULL,
	`billing_cycle` text DEFAULT 'yearly' NOT NULL,
	`billing_cycle_count` integer DEFAULT 1 NOT NULL,
	`auto_renew` integer DEFAULT false NOT NULL,
	`start_date` integer,
	`expire_date` integer NOT NULL,
	`reminder_days` integer DEFAULT 7 NOT NULL,
	`reminder_mode` text DEFAULT 'daily_from_n_days' NOT NULL,
	`status` text DEFAULT 'active' NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `subscriptions_user_expire_idx` ON `subscriptions` (`user_id`,`expire_date`,`status`);--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `user_settings` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_id` integer NOT NULL,
	`timezone` text DEFAULT 'UTC' NOT NULL,
	`notify_hours_json` text DEFAULT '[0]' NOT NULL,
	`notify_delivery_mode` text DEFAULT 'every_slot' NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS `user_settings_user_id_unique` ON `user_settings` (`user_id`);