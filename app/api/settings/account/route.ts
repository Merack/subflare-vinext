import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/db";
import { userSettings } from "@/db/schema";
import { requireApiAuth } from "@/lib/session";
import { eq } from "drizzle-orm";
import { z } from "zod";

const updateSchema = z.object({
  timezone: z.string().min(1).optional(),
  notifyHours: z.array(z.number().int().min(0).max(23)).min(1).optional(),
  notifyDeliveryMode: z.enum(["every_slot", "once_per_day"]).optional(),
});

export async function GET() {
  const session = await requireApiAuth();
  const db = await getDb();

  const [settings] = await db
    .select()
    .from(userSettings)
    .where(eq(userSettings.userId, session.userId))
    .limit(1);

  if (!settings) {
    return NextResponse.json({
      timezone: "UTC",
      notifyHours: [0],
      notifyDeliveryMode: "every_slot",
    });
  }

  let notifyHours: number[] = [0];
  try {
    notifyHours = JSON.parse(settings.notifyHoursJson) as number[];
  } catch {}

  return NextResponse.json({
    timezone: settings.timezone,
    notifyHours,
    notifyDeliveryMode: settings.notifyDeliveryMode,
  });
}

export async function PUT(request: NextRequest) {
  const session = await requireApiAuth();
  const db = await getDb();

  const body = await request.json() as unknown;
  const parsed = updateSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const [existing] = await db
    .select({ id: userSettings.id })
    .from(userSettings)
    .where(eq(userSettings.userId, session.userId))
    .limit(1);

  const values: Record<string, unknown> = { updatedAt: new Date() };
  if (parsed.data.timezone) values.timezone = parsed.data.timezone;
  if (parsed.data.notifyHours) values.notifyHoursJson = JSON.stringify(parsed.data.notifyHours);
  if (parsed.data.notifyDeliveryMode) values.notifyDeliveryMode = parsed.data.notifyDeliveryMode;

  if (existing) {
    await db.update(userSettings).set(values).where(eq(userSettings.userId, session.userId));
  } else {
    await db.insert(userSettings).values({
      userId: session.userId,
      ...values,
      timezone: parsed.data.timezone ?? "UTC",
      notifyHoursJson: parsed.data.notifyHours ? JSON.stringify(parsed.data.notifyHours) : "[0]",
      notifyDeliveryMode: parsed.data.notifyDeliveryMode ?? "every_slot",
    });
  }

  return NextResponse.json({ success: true });
}
