import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const teamId = (session.user as any).teamId as string;

  const overrides = await prisma.nonOfficialDayOverride.findMany({
    where: { teamId },
    orderBy: { date: "desc" },
    take: 200,
  });

  return NextResponse.json(
    overrides.map((o: (typeof overrides)[number]) => ({
      id: o.id,
      date: o.date.toISOString().slice(0, 10),
      isNonOfficial: o.isNonOfficial,
    }))
  );
}

const createSchema = z.object({
  date: z.string(), // YYYY-MM-DD
  isNonOfficial: z.boolean(),
});

// POST /api/non-official/overrides -- admin only. isNonOfficial: true adds
// a custom holiday/extra-pay date; false marks a date as an exception to
// the weekday rule (e.g. "this particular Friday is a normal day").
export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if ((session.user as any).role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const teamId = (session.user as any).teamId as string;

  const body = await req.json();
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const date = new Date(parsed.data.date + "T00:00:00.000Z");

  const saved = await prisma.nonOfficialDayOverride.upsert({
    where: { teamId_date: { teamId, date } },
    update: { isNonOfficial: parsed.data.isNonOfficial },
    create: { teamId, date, isNonOfficial: parsed.data.isNonOfficial },
  });

  return NextResponse.json(
    {
      id: saved.id,
      date: saved.date.toISOString().slice(0, 10),
      isNonOfficial: saved.isNonOfficial,
    },
    { status: 201 }
  );
}
