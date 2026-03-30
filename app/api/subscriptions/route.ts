import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/db";
import { subscriptions, REMINDER_MODES } from "@/db/schema";
import { addBillingCycleCountIssue, BILLING_CYCLE_VALUES, normalizeAutoRenew, normalizeBillingCycleCount } from "@/lib/subscription-billing";
import { requireApiAuth } from "@/lib/session";
import { eq } from "drizzle-orm";
import { z } from "zod";

// 订阅表单数据验证 schema
// 使用 Zod 确保客户端传入的数据符合数据库要求
const subscriptionSchema = z.object({
  name: z.string().min(1, "名称不能为空"),                   // 订阅名称，必填
  category: z.string().min(1),                              // 类别，必填
  url: z.string().optional(),                               // 相关链接，选填
  notes: z.string().optional(),                             // 备注，选填
  cost: z.number().nonnegative().nullable().optional(),      // 费用，不能为负数，选填
  currency: z.string().default("CNY"),                      // 货币，默认为人民币
  billingCycle: z.enum(BILLING_CYCLE_VALUES), // 计费周期
  billingCycleCount: z.number().int().min(1).optional(),    // 周期乘数，非一次性时必填
  autoRenew: z.boolean().default(false),                    // 是否自动续费
  startDate: z.string().optional(),                         // 开始时间 (ISO 字符串格式)
  expireDate: z.string(),                                   // 到期时间 (ISO 字符串格式)，必填
  reminderDays: z.number().int().min(0).max(365).default(7),// 提前几天提醒，限制 0~365 天内，0 表示当天提醒
  reminderMode: z.enum(REMINDER_MODES).default("daily_from_n_days"),
  status: z.enum(["active", "paused", "disabled", "expired"]).default("active"), // 当前状态
}).superRefine((data, ctx) => {
  addBillingCycleCountIssue(data, ctx, "非一次性订阅必须提供计费周期次数");
});

// ============================================================================
// GET: 获取当前用户的所有订阅列表
// 路径: /api/subscriptions
// ============================================================================
export async function GET() {
  // 获取当前会话，验证用户是否已登录. 如果未登录将抛出异常
  const session = await requireApiAuth();
  const db = await getDb();
  
  // 从数据库中查询属于当前用户的、且未被软删除的所有订阅项，
  // 并且按到期时间 (expireDate) 升序排列 (即将到期的排在前面)
  const rows = await db
    .select()
    .from(subscriptions)
    .where(eq(subscriptions.userId, session.userId))
    .orderBy(subscriptions.expireDate);
    
  return NextResponse.json(rows);
}

// ============================================================================
// POST: 创建新的订阅项
// 路径: /api/subscriptions
// ============================================================================
export async function POST(request: NextRequest) {
  // 鉴权
  const session = await requireApiAuth();
  
  // 解析请求体数据
  const body = await request.json() as unknown;
  
  // 使用 Zod 进行数据验证
  const parsed = subscriptionSchema.safeParse(body);

  if (!parsed.success) {
    // 验证失败，返回 400 错误和具体的验证错误信息
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const data = parsed.data;
  const db = await getDb();

  // 将验证后的数据插入数据库
  const [created] = await db
    .insert(subscriptions)
    .values({
      ...data,
      userId: session.userId, // 强制绑定当前用户的 ID，防止伪造
      url: data.url || null,
      notes: data.notes || null,
      cost: data.cost ?? null,
      autoRenew: normalizeAutoRenew(data),
      billingCycleCount: normalizeBillingCycleCount(data),
      // 将字符串格式的日期转换为 Date 对象
      startDate: data.startDate ? new Date(data.startDate) : null,
      expireDate: new Date(data.expireDate),
    })
    .returning(); // 插入成功后返回新创建的记录

  // 返回 201 Created 状态和新记录
  return NextResponse.json(created, { status: 201 });
}
