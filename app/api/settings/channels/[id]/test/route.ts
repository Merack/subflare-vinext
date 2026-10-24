import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/db";
import { notificationChannels } from "@/db/schema";
import { requireApiAuth } from "@/lib/session";
import { and, eq } from "drizzle-orm";
import { registry } from "@/lib/notifications/registry";
import { buildTestNotification } from "@/lib/notifications/message";

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function POST(_request: NextRequest, { params }: RouteParams) {
  const session = await requireApiAuth();
  if (session instanceof NextResponse) return session;
  const { id } = await params;
  const db = await getDb();

  const [channel] = await db
    .select()
    .from(notificationChannels)
    .where(
      and(
        eq(notificationChannels.id, parseInt(id)),
        eq(notificationChannels.userId, session.userId)
      )
    )
    .limit(1);

  if (!channel) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const strategy = registry.get(channel.type);
  if (!strategy) {
    return NextResponse.json({ error: "Unsupported channel type" }, { status: 400 });
  }

  const config = JSON.parse(channel.config) as Record<string, unknown>;
  if (!strategy.validateConfig(config)) {
    return NextResponse.json({ error: "渠道配置不完整或格式错误" }, { status: 400 });
  }

  const result = await strategy.send(buildTestNotification(), config);

  if (!result.success) {
    return NextResponse.json({ error: result.error ?? "发送失败，请检查配置" }, { status: 400 });
  }

  return NextResponse.json({ success: true, providerMessageId: result.providerMessageId ?? null });
}
