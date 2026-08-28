import { NextResponse } from "next/server";
import { z } from "zod";
import { eachDayOfInterval } from "date-fns";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const createSchema = z.object({
  staffId: z.string(),
  dutyCodeId: z.string(),
  startDate: z.string(), // YYYY-MM-DD
  endDate: z.string(),
  note: z.string().optional(),
});

export async function GET() {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const teamId = (session.user as any).teamId as string;

  const periods = await prisma.leavePeriod.findMany({
    where: { teamId },
    include: { staff: true, dutyCode: true },
    orderBy: { startDate: "desc" },
    take: 200,
  });

  return NextResponse.json(
    periods.map((p: (typeof periods)[number]) => ({
      id: p.id,
      staffId: p.staffId,
      staffName: p.staff.name,
      dutyCodeId: p.dutyCodeId,
      dutyCodeName: p.dutyCode.name,
      startDate: p.startDate.toISOString().slice(0, 10),
      endDate: p.endDate.toISOString().slice(0, 10),
      note: p.note,
    }))
  );
}

// POST /api/leave-periods -- admin only. Creates the period, then fills a
// RotaEntry for every date in the range with the chosen duty code, tagged
// with leavePeriodId so a later individual-day edit can detach cleanly and
// deleting the period only removes days still linked to it.
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

  const [staff, dutyCode] = await Promise.all([
    prisma.staff.findFirst({
      where: { id: parsed.data.staffId, teamId },
    }),
    prisma.dutyCode.findFirst({
      where: { id: parsed.data.dutyCodeId, teamId },
    }),
  ]);
  if (!staff || !dutyCode) {
    return NextResponse.json(
      { error: "Staff or duty code not found" },
      { status: 404 }
    );
  }

  const start = new Date(parsed.data.startDate + "T00:00:00.000Z");
  const end = new Date(parsed.data.endDate + "T00:00:00.000Z");
  if (end < start) {
    return NextResponse.json(
      { error: "End date is before start date" },
      { status: 400 }
    );
  }

  const period = await prisma.leavePeriod.create({
    data: {
      teamId,
      staffId: staff.id,
      dutyCodeId: dutyCode.id,
      startDate: start,
      endDate: end,
      note: parsed.data.note || null,
    },
  });

  const days = eachDayOfInterval({ start, end });
  for (const day of days) {
    await prisma.rotaEntry.upsert({
      where: {
        teamId_staffId_date: { teamId, staffId: staff.id, date: day },
      },
      update: { dutyCodeId: dutyCode.id, leavePeriodId: period.id },
      create: {
        teamId,
        staffId: staff.id,
        date: day,
        dutyCodeId: dutyCode.id,
        leavePeriodId: period.id,
      },
    });
  }

  return NextResponse.json(
    {
      id: period.id,
      staffId: period.staffId,
      staffName: staff.name,
      dutyCodeId: period.dutyCodeId,
      dutyCodeName: dutyCode.name,
      startDate: period.startDate.toISOString().slice(0, 10),
      endDate: period.endDate.toISOString().slice(0, 10),
      note: period.note,
    },
    { status: 201 }
  );
}
