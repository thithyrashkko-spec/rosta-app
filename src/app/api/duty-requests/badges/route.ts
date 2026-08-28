import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// GET /api/duty-requests/badges?start=&end=
// Returns just {staffId, date, status} for pending/approved requests in
// range -- no note or duty details. Unlike the full /api/duty-requests
// list (which staff can only see their own of), this is visible to
// everyone on the team, since the rota grid itself already shows every
// staff member's assignments to everyone.
export async function GET(req: Request) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const teamId = (session.user as any).teamId as string;

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
