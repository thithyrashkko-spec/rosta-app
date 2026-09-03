import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const DAY_NAMES = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];

// GET /api/non-official/rules -- always returns all 7 weekdays, defaulting
// to disabled for any weekday that has no row yet.
export async function GET() {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const teamId = (session.user as any).teamId as string;

  const rules = await prisma.nonOfficialDayRule.findMany({ where: { teamId } });
  const byWeekday = new Map(
    rules.map((r: (typeof rules)[number]) => [r.weekday, r.enabled])
  );

  return NextResponse.json(
    DAY_NAMES.map((name, weekday) => ({
      weekday,
      name,
      enabled: byWeekday.get(weekday) ?? false,
    }))
  );
}

const updateSchema = z.object({
  weekday: z.number().min(0).max(6),
  enabled: z.boolean(),
});

// PATCH /api/non-official/rules -- admin only, sets a single weekday.
export async function PATCH(req: Request) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if ((session.user as any).role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const teamId = (session.user as any).teamId as string;

  const body = await req.json();
  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.flatten() },
      { status: 400 }
    );
  }

  await prisma.nonOfficialDayRule.upsert({
    where: {
      teamId_weekday: { teamId, weekday: parsed.data.weekday },
    },
    update: { enabled: parsed.data.enabled },
    create: {
      teamId,
      weekday: parsed.data.weekday,
      enabled: parsed.data.enabled,
    },
  });

  return NextResponse.json({ ok: true });
}
