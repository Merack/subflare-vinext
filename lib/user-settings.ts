/**
 * @fileoverview 读取用户设置里前端也要用的部分
 *
 * 目前只有时区：页面判断“今天”要和 cron 用同一个时区，否则两边对到期当天的判断会不一致
 *
 * @module lib/user-settings
 */
import { getDb } from "@/db";
import { userSettings } from "@/db/schema";
import { eq } from "drizzle-orm";
import { isValidTimeZone } from "@/lib/subscription-utils";

/** 取用户时区，没设置或存了非法值时退回 UTC（与 lib/cron.ts 的兜底一致） */
export async function getUserTimezone(userId: number): Promise<string> {
  const db = await getDb();
  const [settings] = await db
    .select({ timezone: userSettings.timezone })
    .from(userSettings)
    .where(eq(userSettings.userId, userId))
    .limit(1);

  const timezone = settings?.timezone ?? "UTC";
  return isValidTimeZone(timezone) ? timezone : "UTC";
}
