import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getDepartmentScope, staffDepartmentWhere } from "@/lib/department-scope";

// GET /api/duty-requests/badges?start=&end=
// Returns just {staffId, date, status} for pending/approved requests in
// range -- no note or duty details. Visible to everyone within the
// viewer's own department, matching what the rota grid itself shows them.
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
  const start = url.searchParams.get("start");
  const end = url.searchParams.get("end");
  if (!start || !end) {
    return NextResponse.json(
      { error: "start and end query params are required (YYYY-MM-DD)" },
      { status: 400 }
    );
  }

  const requests = await prisma.dutyRequest.findMany({
    where: {
      teamId,
      status: { in: ["PENDING", "APPROVED"] },
      date: {
        gte: new Date(start + "T00:00:00.000Z"),
        lte: new Date(end + "T00:00:00.000Z"),
      },
      staff: staffDepartmentWhere(scope),
    },
    select: { staffId: true, date: true, status: true },
  });

  return NextResponse.json(
    requests.map((r: (typeof requests)[number]) => ({
      staffId: r.staffId,
      date: r.date.toISOString().slice(0, 10),
      status: r.status,
    }))
  );
}
