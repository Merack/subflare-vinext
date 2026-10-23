import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/db";
import { notificationChannels, CHANNEL_TYPES } from "@/db/schema";
import { requireApiAuth } from "@/lib/session";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { getChannelDescriptor } from "@/lib/notifications/channel-descriptors";

const channelSchema = z.object({
  type: z.enum(CHANNEL_TYPES),
  name: z.string().min(1),
  config: z.record(z.string(), z.unknown()),
  enabled: z.boolean().default(true),
});

function getChannelSummary(type: string, configRaw: string) {
  try {
    const descriptor = getChannelDescriptor(type);
    const config = JSON.parse(configRaw) as Record<string, unknown>;

    if (!descriptor) {
      return { hasConfig: false, summary: null };
    }

    return descriptor.getSummary(config);
  } catch {
    return { hasConfig: false, summary: null };
  }
}

export async function GET() {
  const session = await requireApiAuth();
  if (session instanceof NextResponse) return session;
  const db = await getDb();

  const channels = await db
    .select()
    .from(notificationChannels)
    .where(eq(notificationChannels.userId, session.userId));

  return NextResponse.json(
    channels.map((channel) => ({
      id: channel.id,
      type: channel.type,
      name: channel.name,
      enabled: channel.enabled,
      ...getChannelSummary(channel.type, channel.config),
    }))
  );
}

export async function POST(request: NextRequest) {
  const session = await requireApiAuth();
  if (session instanceof NextResponse) return session;
  const db = await getDb();

  const body = await request.json() as unknown;
  const parsed = channelSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const descriptor = getChannelDescriptor(parsed.data.type);
  if (!descriptor || !descriptor.validateConfig(parsed.data.config)) {
    return NextResponse.json({ error: "渠道配置不完整或格式错误" }, { status: 400 });
  }

  const [channel] = await db
    .insert(notificationChannels)
    .values({
      ...parsed.data,
      userId: session.userId,
      config: JSON.stringify(parsed.data.config),
    })
    .returning();

  return NextResponse.json(channel, { status: 201 });
}
