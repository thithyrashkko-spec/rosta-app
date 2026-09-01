import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getNonOfficialDates } from "@/lib/non-official";
import { getDepartmentScope, staffDepartmentWhere } from "@/lib/department-scope";

// GET /api/rota?start=YYYY-MM-DD&end=YYYY-MM-DD
// Returns every RotaEntry for staff in the date range, plus which of those
// dates count as non-official, in one call -- the grid needs both to render.
// Non-admin viewers only get entries for their own department.
export async function GET(req: Request) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const teamId = (session.user as any).teamId as string;
  const role = (session.user as any).role as string;
  const staffId = (session.user as any).staffId as string | null;
  const scope = await getDepartmentScope(role, staffId);

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
      where: {
        teamId,
        date: { gte: start, lte: end },
        staff: staffDepartmentWhere(scope),
      },
      include: { dutyCode: true },
    }),
    getNonOfficialDates(teamId, start, end),
  ]);

  return NextResponse.json({
    entries: entries.map((e: (typeof entries)[number]) => ({
      id: e.id,
      staffId: e.staffId,
      date: e.date.toISOString().slice(0, 10),
      dutyCodeId: e.dutyCodeId,
      leavePeriodId: e.leavePeriodId,
    })),
    nonOfficialDates: Array.from(nonOfficialDates),
  });
}
