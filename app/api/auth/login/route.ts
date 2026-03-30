/**
 * 登录 API 路由
 *
 * 处理用户登录请求，验证凭据并创建会话
 *
 * 环境变量配置：
 * - USERNAME: 登录用户名（可选，默认为 "admin"）
 * - PASSWORD: 登录密码（必需）
 *
 * @module app/api/auth/login
 */

import { NextRequest, NextResponse } from "next/server";
import { createSession, SESSION_COOKIE, SESSION_TTL } from "@/lib/session";
import { z } from "zod";

/**
 * 登录请求体的验证模式
 * 用户名和密码非空
 */
const loginSchema = z.object({
  username: z.string().min(1),
  password: z.string().min(1),
});

/**
 * 处理登录 POST 请求
 *
 * 验证用户凭据，成功后创建会话并设置 HTTP-only Cookie
 *
 * @param request - Next.js 请求对象
 * @returns JSON 响应：
 *   - 成功: { success: true } 并设置会话 Cookie
 *   - 失败: { error: string } 并返回相应的 HTTP 状态码
 *
 * 状态码说明：
 *   - 200: 登录成功
 *   - 400: 输入验证失败（用户名或密码为空）
 *   - 401: 凭据无效（用户名或密码错误）
 *   - 503: 系统未配置密码环境变量
 */
export async function POST(request: NextRequest) {
  // 解析并验证请求体
  const body = await request.json() as unknown;
  const parsed = loginSchema.safeParse(body);

  // 输入验证失败，返回 400 错误
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  }

  const { username, password } = parsed.data;

  // 检查密码环境变量是否已配置
  if (!process.env.PASSWORD) {
    return NextResponse.json(
      { error: "系统未配置密码，请设置 PASSWORD 环境变量" },
      { status: 503 }
    );
  }

  // 获取预期的凭据（用户名有默认值，密码必须由环境变量提供）
  const expectedUsername = process.env.USERNAME ?? "admin";
  const expectedPassword = process.env.PASSWORD;

  // 验证用户名和密码
  if (username !== expectedUsername || password !== expectedPassword) {
    return NextResponse.json({ error: "Invalid credentials" }, { status: 401 });
  }

  // 创建新会话
  const sessionId = await createSession();

  // 构建成功响应并设置会话 Cookie
  const response = NextResponse.json({ success: true });
  response.cookies.set(SESSION_COOKIE, sessionId, {
    httpOnly: true,                                    // 防止 JavaScript 访问，增强安全性
    secure: process.env.NODE_ENV === "production",     // 生产环境强制 HTTPS
    sameSite: "lax",                                   // 防止 CSRF 攻击
    maxAge: SESSION_TTL,                               // 会话有效期（秒）
    path: "/",                                         // Cookie 对全站有效
  });

  return response;
}
