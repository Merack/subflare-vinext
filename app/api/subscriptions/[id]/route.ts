/**
 * 订阅详情 API 路由
 *
 * 该文件处理单个订阅的 CRUD 操作，包括：
 * - GET: 获取指定 ID 的订阅详情
 * - PUT: 更新指定 ID 的订阅信息
 * - DELETE: 删除指定 ID 的订阅
 *
 * 所有操作都需要用户认证，且只能操作当前用户自己的订阅数据
 */

import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/db";
import { subscriptions, REMINDER_MODES } from "@/db/schema";
import { addBillingCycleCountIssue, BILLING_CYCLE_VALUES, normalizeAutoRenew, normalizeBillingCycleCount } from "@/lib/subscription-billing";
import { requireApiAuth } from "@/lib/session";
import { and, eq } from "drizzle-orm";
import { z } from "zod";

/**
 * 更新订阅的数据验证模式
 *
 * 所有字段均为可选，允许部分更新订阅信息
 */
const updateSchema = z.object({
  /** 订阅名称，非空字符串 */
  name: z.string().min(1).optional(),
  /** 订阅分类，非空字符串 */
  category: z.string().min(1).optional(),
  /** 订阅相关网址 */
  url: z.string().optional(),
  /** 备注信息 */
  notes: z.string().optional(),
  /** 订阅费用，非负数，可为空 */
  cost: z.number().nonnegative().nullable().optional(),
  /** 货币类型 */
  currency: z.string().optional(),
  /** 计费周期：日/月/季/年/一次性 */
  billingCycle: z.enum(BILLING_CYCLE_VALUES).optional(),
  /** 计费周期次数，最小值为 1 */
  billingCycleCount: z.number().int().min(1).optional(),
  /** 是否自动续费 */
  autoRenew: z.boolean().optional(),
  /** 开始日期 */
  startDate: z.string().optional(),
  /** 到期日期 */
  expireDate: z.string().optional(),
  /** 提醒天数，范围 0-365，0 表示当天 */
  reminderDays: z.number().int().min(0).max(365).optional(),
  reminderMode: z.enum(REMINDER_MODES).optional(),
  /** 订阅状态：活跃/暂停/禁用/已过期 */
  status: z.enum(["active", "paused", "disabled", "expired"]).optional(),
}).superRefine((data, ctx) => {
  if (!data.billingCycle) return;
  addBillingCycleCountIssue(
    {
      billingCycle: data.billingCycle,
      billingCycleCount: data.billingCycleCount,
    },
    ctx,
    "非一次性订阅必须提供计费周期次数"
  );
});

/**
 * 路由参数接口
 *
 * Next.js 15+ 中 params 是 Promise 类型，需要异步解析
 */
interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * 获取单个订阅详情
 *
 * @param _request - Next.js 请求对象（未使用）
 * @param params - 路由参数，包含订阅 ID
 * @returns 订阅详情 JSON 或 404 错误
 *
 * @example
 * GET /api/subscriptions/123
 * Response: { id: 123, name: "Netflix", ... }
 */
export async function GET(_request: NextRequest, { params }: RouteParams) {
  // 验证用户身份，未登录会抛出 401 错误
  const session = await requireApiAuth();
  // 解析路由参数获取订阅 ID
  const { id } = await params;
  // 获取数据库连接
  const db = await getDb();

  // 查询订阅，确保只能查询当前用户的订阅
  const [row] = await db
    .select()
    .from(subscriptions)
    .where(
      and(
        eq(subscriptions.id, parseInt(id)),
        eq(subscriptions.userId, session.userId)
      )
    )
    .limit(1);

  // 未找到订阅返回 404
  if (!row) return NextResponse.json({ error: "Not found" }, { status: 404 });
  // 返回订阅详情
  return NextResponse.json(row);
}

/**
 * 更新单个订阅
 *
 * @param request - Next.js 请求对象，包含更新数据
 * @param params - 路由参数，包含订阅 ID
 * @returns 更新后的订阅 JSON 或错误响应
 *
 * @example
 * PUT /api/subscriptions/123
 * Body: { name: "Netflix Premium", cost: 15.99 }
 * Response: { id: 123, name: "Netflix Premium", cost: 15.99, ... }
 */
export async function PUT(request: NextRequest, { params }: RouteParams) {
  // 验证用户身份
  const session = await requireApiAuth();
  // 解析路由参数
  const { id } = await params;
  // 解析请求体
  const body = await request.json() as unknown;
  // 验证请求数据
  const parsed = updateSchema.safeParse(body);

  // 数据验证失败返回 400 错误
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const data = parsed.data;
  const db = await getDb();

  // 构建更新数据，自动设置更新时间
  const updateData: Record<string, unknown> = { ...data, updatedAt: new Date() };

  if (data.billingCycle !== undefined) {
    updateData.billingCycleCount = normalizeBillingCycleCount({
      billingCycle: data.billingCycle,
      billingCycleCount: data.billingCycleCount,
    });
    updateData.autoRenew = normalizeAutoRenew({
      billingCycle: data.billingCycle,
      autoRenew: data.autoRenew,
    });
  }

  // 处理日期字段：将字符串转换为 Date 对象
  if (data.startDate !== undefined) {
    updateData.startDate = data.startDate ? new Date(data.startDate) : null;
  }
  if (data.expireDate !== undefined) {
    updateData.expireDate = new Date(data.expireDate);
  }
  // 处理 URL 字段：空字符串转为 null
  if (data.url !== undefined) {
    updateData.url = data.url || null;
  }

  // 执行更新操作，确保只能更新当前用户的订阅
  const [updated] = await db
    .update(subscriptions)
    .set(updateData)
    .where(
      and(
        eq(subscriptions.id, parseInt(id)),
        eq(subscriptions.userId, session.userId)
      )
    )
    .returning();

  // 未找到订阅返回 404
  if (!updated) return NextResponse.json({ error: "Not found" }, { status: 404 });
  // 返回更新后的订阅数据
  return NextResponse.json(updated);
}

/**
 * 删除单个订阅
 *
 * @param _request - Next.js 请求对象（未使用）
 * @param params - 路由参数，包含订阅 ID
 * @returns 成功响应或 404 错误
 *
 * @example
 * DELETE /api/subscriptions/123
 * Response: { success: true }
 */
export async function DELETE(_request: NextRequest, { params }: RouteParams) {
  // 验证用户身份
  const session = await requireApiAuth();
  // 解析路由参数
  const { id } = await params;
  const db = await getDb();

  // 执行删除操作，确保只能删除当前用户的订阅
  const [deleted] = await db
    .delete(subscriptions)
    .where(
      and(
        eq(subscriptions.id, parseInt(id)),
        eq(subscriptions.userId, session.userId)
      )
    )
    .returning();

  // 未找到订阅返回 404
  if (!deleted) return NextResponse.json({ error: "Not found" }, { status: 404 });
  // 返回成功响应
  return NextResponse.json({ success: true });
}
