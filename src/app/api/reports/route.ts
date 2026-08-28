import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getNonOfficialDates } from "@/lib/non-official";

// GET /api/reports?start=&end=
// Aggregates, for every staff member with any activity in range: a count
// per duty code, total leave days, and total non-official-day working
// count. Includes staff marked as left, as long as they have entries in
// range -- historical data stays visible even after someone leaves.
export async function GET(req: Request) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const teamId = (session.user as any).teamId as string;

  const url = new URL(req.url);
  const startStr = url.searchParams.get("start");
  const endStr = url.searchParams.get("end");
  if (!startStr || !endStr) {
    return NextResponse.json(
      { error: "start and end query params are required (YYYY-MM-DD)" },
      { status: 400 }
    );
  }
  const start = new Date(startStr + "T00:00:00.000Z");
  const end = new Date(endStr + "T00:00:00.000Z");

  const [entries, nonOfficialDates] = await Promise.all([
    prisma.rotaEntry.findMany({
      where: { teamId, date: { gte: start, lte: end } },
      include: { staff: true, dutyCode: true },
    }),
    getNonOfficialDates(teamId, start, end),
  ]);

  type StaffAgg = {
    staffId: string;
    staffName: string;
    isActive: boolean;
    byDuty: Record<string, number>;
    leaveDays: number;
    nonOfficialWorkedDays: number;
  };

  const staffMap = new Map<string, StaffAgg>();
  const dutyTotals = new Map<string, number>();
  const leaveBreakdown = new Map<string, number>();

  for (const e of entries as (typeof entries)[number][]) {
    if (!staffMap.has(e.staffId)) {
      staffMap.set(e.staffId, {
        staffId: e.staffId,
        staffName: e.staff.name,
        isActive: e.staff.isActive,
        byDuty: {},
        leaveDays: 0,
        nonOfficialWorkedDays: 0,
      });
    }
    const agg = staffMap.get(e.staffId)!;
    const dutyName = e.dutyCode.name;
    agg.byDuty[dutyName] = (agg.byDuty[dutyName] ?? 0) + 1;
    dutyTotals.set(dutyName, (dutyTotals.get(dutyName) ?? 0) + 1);

    if (e.dutyCode.isLeave) {
      agg.leaveDays += 1;
      leaveBreakdown.set(dutyName, (leaveBreakdown.get(dutyName) ?? 0) + 1);
    }

    const dateKey = e.date.toISOString().slice(0, 10);
    if (nonOfficialDates.has(dateKey) && e.dutyCode.isWorkingDay) {
      agg.nonOfficialWorkedDays += 1;
    }
  }

  const staffRows = Array.from(staffMap.values()).sort((a, b) =>
    a.staffName.localeCompare(b.staffName)
  );

  return NextResponse.json({
    staffRows,
    dutyTotals: Array.from(dutyTotals.entries()).map(([name, total]) => ({
      name,
      total,
    })),
    leaveBreakdown: Array.from(leaveBreakdown.entries()).map(
      ([name, total]) => ({ name, total })
    ),
  });
}
