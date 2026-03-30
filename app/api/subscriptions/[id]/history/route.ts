/**
 * 订阅历史记录 API 路由
 *
 * 该文件处理订阅续费历史的查询和创建操作
 *
 * 路由路径: /api/subscriptions/[id]/history
 *
 * 支持的 HTTP 方法:
 * - GET: 获取指定订阅的续费历史记录
 * - POST: 创建新的续费记录（手动续费）
 */

import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/db";
import { subscriptions, subscriptionHistory } from "@/db/schema";
import { requireApiAuth } from "@/lib/session";
import { and, eq, desc } from "drizzle-orm";
import { z } from "zod";

/**
 * 路由参数接口
 * @property params - 包含动态路由参数的 Promise
 * @property params.id - 订阅 ID（字符串格式）
 */
interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * 续费请求体的验证模式
 *
 * @property newExpireDate - 新的过期日期（必填，字符串格式）
 * @property cost - 续费费用（可选，非负数）
 * @property notes - 备注信息（可选）
 */
const renewSchema = z.object({
  newExpireDate: z.string().min(1),
  cost: z.number().nonnegative().nullable().optional(),
  notes: z.string().optional(),
});

/**
 * 获取订阅的续费历史记录
 *
 * @param _request - Next.js 请求对象（未使用）
 * @param params - 路由参数，包含订阅 ID
 * @returns 返回续费历史记录数组，或 404 错误
 *
 * @example
 * // 请求: GET /api/subscriptions/123/history
 * // 响应: [{ id: 1, subscriptionId: 123, renewalType: "manual", ... }, ...]
 *
 * 流程:
 * 1. 验证用户身份
 * 2. 查询订阅是否存在且属于当前用户
 * 3. 查询该订阅的所有续费历史记录
 * 4. 按创建时间倒序返回结果
 */
export async function GET(_request: NextRequest, { params }: RouteParams) {
  // 验证用户登录状态
  const session = await requireApiAuth();
  const { id } = await params;
  const db = await getDb();

  // 查询订阅记录，确保存在且属于当前用户
  const [sub] = await db
    .select()
    .from(subscriptions)
    .where(
      and(
        eq(subscriptions.id, parseInt(id)),
        eq(subscriptions.userId, session.userId)
      )
    )
    .limit(1);

  // 订阅不存在或无权访问
  if (!sub) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // 查询续费历史记录，按创建时间倒序排列
  const history = await db
    .select()
    .from(subscriptionHistory)
    .where(eq(subscriptionHistory.subscriptionId, parseInt(id)))
    .orderBy(desc(subscriptionHistory.createdAt));

  return NextResponse.json(history);
}

/**
 * 创建手动续费记录
 *
 * @param request - Next.js 请求对象，包含续费信息
 * @param params - 路由参数，包含订阅 ID
 * @returns 返回新创建的续费记录，或错误响应
 *
 * @example
 * // 请求: POST /api/subscriptions/123/history
 * // 请求体: { newExpireDate: "2025-12-31", cost: 99.99, notes: "年度续费" }
 * // 响应: { id: 1, subscriptionId: 123, renewalType: "manual", ... }
 *
 * 流程:
 * 1. 验证用户身份
 * 2. 验证请求体数据格式
 * 3. 查询订阅是否存在且属于当前用户
 * 4. 创建续费历史记录
 * 5. 更新订阅的过期日期和状态
 * 6. 返回新创建的续费记录
 */
export async function POST(request: NextRequest, { params }: RouteParams) {
  // 验证用户登录状态
  const session = await requireApiAuth();
  const { id } = await params;

  // 解析并验证请求体
  const body = await request.json() as unknown;
  const parsed = renewSchema.safeParse(body);

  // 请求体验证失败
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const db = await getDb();

  // 查询订阅记录，确保存在且属于当前用户
  const [sub] = await db
    .select()
    .from(subscriptions)
    .where(
      and(
        eq(subscriptions.id, parseInt(id)),
        eq(subscriptions.userId, session.userId)
      )
    )
    .limit(1);

  // 订阅不存在或无权访问
  if (!sub) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // 解析新的过期日期
  const newExpireDate = new Date(parsed.data.newExpireDate);

  // 创建续费历史记录
  const [record] = await db
    .insert(subscriptionHistory)
    .values({
      subscriptionId: parseInt(id),
      renewalType: "manual", // 标记为手动续费
      previousExpireDate: sub.expireDate, // 记录原过期日期
      newExpireDate,
      cost: parsed.data.cost ?? null,
      notes: parsed.data.notes ?? null,
    })
    .returning();

  // 更新订阅的过期日期和状态
  const [updatedSubscription] = await db
    .update(subscriptions)
    .set({ expireDate: newExpireDate, status: "active", updatedAt: new Date() })
    .where(eq(subscriptions.id, parseInt(id)))
    .returning();

  // 返回更新后的订阅数据（HTTP 201 Created）
  return NextResponse.json({ record, subscription: updatedSubscription }, { status: 201 });
}
