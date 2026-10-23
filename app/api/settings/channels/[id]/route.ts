import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/db";
import { notificationChannels, CHANNEL_TYPES } from "@/db/schema";
import { requireApiAuth } from "@/lib/session";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { getChannelDescriptor } from "@/lib/notifications/channel-descriptors";

interface RouteParams {
  params: Promise<{ id: string }>;
}

const updateSchema = z.object({
  type: z.enum(CHANNEL_TYPES).optional(),
  name: z.string().min(1).optional(),
  config: z.record(z.string(), z.unknown()).optional(),
  enabled: z.boolean().optional(),
});

export async function PATCH(request: NextRequest, { params }: RouteParams) {
  const session = await requireApiAuth();
  if (session instanceof NextResponse) return session;
  const { id } = await params;
  const db = await getDb();

  const [existingChannel] = await db
    .select()
    .from(notificationChannels)
    .where(
      and(
        eq(notificationChannels.id, parseInt(id)),
        eq(notificationChannels.userId, session.userId)
      )
    )
    .limit(1);

  if (!existingChannel) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const body = await request.json() as unknown;
  const parsed = updateSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const nextType = parsed.data.type ?? existingChannel.type;
  const descriptor = getChannelDescriptor(nextType);
  if (!descriptor) {
    return NextResponse.json({ error: "Unsupported channel type" }, { status: 400 });
  }

  const existingConfig = JSON.parse(existingChannel.config) as Record<string, unknown>;
  const mergedConfig = parsed.data.config === undefined
    ? existingConfig
    : { ...existingConfig, ...parsed.data.config };

  if (parsed.data.config !== undefined && !descriptor.validateConfig(mergedConfig)) {
    return NextResponse.json({ error: "渠道配置不完整或格式错误" }, { status: 400 });
  }

  const updates: Record<string, unknown> = { ...parsed.data, type: nextType };

  if (parsed.data.config !== undefined) {
    updates.config = JSON.stringify(mergedConfig);
  }

  const [updated] = await db
    .update(notificationChannels)
    .set(updates)
    .where(
      and(
        eq(notificationChannels.id, parseInt(id)),
        eq(notificationChannels.userId, session.userId)
      )
    )
    .returning();

  if (!updated) return NextResponse.json({ error: "Not found" }, { status: 404 });

  return NextResponse.json(updated);
}

export async function DELETE(_request: NextRequest, { params }: RouteParams) {
  const session = await requireApiAuth();
  if (session instanceof NextResponse) return session;
  const { id } = await params;
  const db = await getDb();

  await db
    .delete(notificationChannels)
    .where(
      and(
        eq(notificationChannels.id, parseInt(id)),
        eq(notificationChannels.userId, session.userId)
      )
    );

  return NextResponse.json({ success: true });
}
