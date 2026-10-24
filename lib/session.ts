import { env } from "cloudflare:workers";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { NextResponse } from "next/server";

export const SESSION_TTL = 60 * 60 * 24 * 7; // 7 days
export const SESSION_COOKIE = "session_id";
export const SINGLE_USER_ID = 1;

// 由于没有设计多用户的打算, 就先把USER_ID移出来了, 保留这个interface以备将来加新内容
interface SessionPayload {
  createdAt: number;
}

export interface SessionContext {
  userId: number;
}

export async function createSession(): Promise<string> {
  const sessionId = crypto.randomUUID();
  const payload: SessionPayload = { createdAt: Date.now() };
  await env.KV.put(`session:${sessionId}`, JSON.stringify(payload), {
    expirationTtl: SESSION_TTL,
  });
  return sessionId;
}

export async function getSession(): Promise<SessionContext | null> {
  const cookieStore = await cookies();
  const sessionId = cookieStore.get(SESSION_COOKIE)?.value;
  if (!sessionId) return null;

  const raw = await env.KV.get(`session:${sessionId}`);
  if (!raw) return null;

  return { userId: SINGLE_USER_ID };
}

export async function deleteSession(): Promise<void> {
  const cookieStore = await cookies();
  const sessionId = cookieStore.get(SESSION_COOKIE)?.value;
  if (!sessionId) return;

  await env.KV.delete(`session:${sessionId}`);
}

export async function requirePageAuth(): Promise<SessionContext> {
  const session = await getSession();
  if (!session) {
    redirect("/login");
  }
  return session;
}

// 未登录时返回 401 响应, 由调用方直接 return (抛 Response 会被框架当成 500)
export async function requireApiAuth(): Promise<SessionContext | NextResponse> {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return session;
}
