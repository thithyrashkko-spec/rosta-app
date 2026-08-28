import { NextResponse } from "next/server";
import { z } from "zod";
import { startOfWeek, endOfWeek } from "date-fns";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const createSchema = z.object({
  date: z.string(), // YYYY-MM-DD
  dutyCodeId: z.string(),
  note: z.string().optional(),
});

const WEEKLY_REQUEST_LIMIT = 2;

// GET /api/duty-requests -- staff see only their own; admins see everyone's.
// Optional ?start=&end= (YYYY-MM-DD) and ?status= filter the results; used
// by the rota grid to fetch just the pending requests in the visible range.
export async function GET(req: Request) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const teamId = (session.user as any).teamId as string;
  const role = (session.user as any).role as string;
  const staffId = (session.user as any).staffId as string | null;

  if (role !== "ADMIN" && !staffId) {
    return NextResponse.json([]);
  }

  const url = new URL(req.url);
  const start = url.searchParams.get("start");
  const end = url.searchParams.get("end");
  const status = url.searchParams.get("status");

  const requests = await prisma.dutyRequest.findMany({
    where: {
      teamId,
      ...(role === "ADMIN" ? {} : { staffId: staffId! }),
      ...(status ? { status: status as "PENDING" | "APPROVED" | "REJECTED" } : {}),
      ...(start && end
        ? {
            date: {
              gte: new Date(start + "T00:00:00.000Z"),
              lte: new Date(end + "T00:00:00.000Z"),
            },
          }
        : {}),
    },
    include: { dutyCode: true, staff: true },
    orderBy: { createdAt: "desc" },
    take: 200,
  });

  return NextResponse.json(
    requests.map((r: (typeof requests)[number]) => ({
      id: r.id,
      staffId: r.staffId,
      staffName: r.staff.name,
      date: r.date.toISOString().slice(0, 10),
      dutyCodeId: r.dutyCodeId,
      dutyCodeName: r.dutyCode.name,
      dutyCodeColor: r.dutyCode.color,
      note: r.note,
      status: r.status,
      createdAt: r.createdAt.toISOString(),
    }))
  );
}

// POST /api/duty-requests -- staff request a duty code for a date. Limited
// to WEEKLY_REQUEST_LIMIT per staff member per week (Sun-Sat), counted by
// the requested date's week, excluding requests that were rejected.
export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const teamId = (session.user as any).teamId as string;
  const staffId = (session.user as any).staffId as string | null;

  if (!staffId) {
    return NextResponse.json(
      {
        error:
          "Your login isn't linked to a staff record yet -- ask an admin to link it on the Users page.",
      },
      { status: 400 }
    );
  }

  const body = await req.json();
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const dutyCode = await prisma.dutyCode.findFirst({
    where: { id: parsed.data.dutyCodeId, teamId },
  });
  if (!dutyCode) {
    return NextResponse.json(
      { error: "Duty code not found" },
      { status: 404 }
    );
  }

  const targetDate = new Date(parsed.data.date + "T00:00:00.000Z");
  const weekStart = startOfWeek(targetDate, { weekStartsOn: 0 });
  const weekEnd = endOfWeek(targetDate, { weekStartsOn: 0 });

  const countThisWeek = await prisma.dutyRequest.count({
    where: {
      teamId,
      staffId,
      status: { in: ["PENDING", "APPROVED"] },
      date: { gte: weekStart, lte: weekEnd },
    },
  });

  if (countThisWeek >= WEEKLY_REQUEST_LIMIT) {
    return NextResponse.json(
      {
        error: `You've already made ${WEEKLY_REQUEST_LIMIT} requests for that week.`,
      },
      { status: 429 }
    );
  }

  const created = await prisma.dutyRequest.create({
    data: {
      teamId,
      staffId,
      date: targetDate,
      dutyCodeId: dutyCode.id,
      note: parsed.data.note || null,
    },
    include: { dutyCode: true, staff: true },
  });

  return NextResponse.json(
    {
      id: created.id,
      staffId: created.staffId,
      staffName: created.staff.name,
      date: created.date.toISOString().slice(0, 10),
      dutyCodeId: created.dutyCodeId,
      dutyCodeName: created.dutyCode.name,
      dutyCodeColor: created.dutyCode.color,
      note: created.note,
      status: created.status,
      createdAt: created.createdAt.toISOString(),
    },
    { status: 201 }
  );
}
