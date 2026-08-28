import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const createSchema = z.object({
  date: z.string(), // YYYY-MM-DD
  partnerStaffId: z.string(),
  note: z.string().optional(),
});

// GET /api/duty-exchanges -- staff see exchanges they're part of (either
// side); admins see everyone's.
export async function GET() {
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

  const exchanges = await prisma.dutyExchange.findMany({
    where: {
      teamId,
      ...(role === "ADMIN"
        ? {}
        : { OR: [{ staffAId: staffId! }, { staffBId: staffId! }] }),
    },
    include: {
      staffA: true,
      staffB: true,
      staffADutyCode: true,
      staffBDutyCode: true,
    },
    orderBy: { createdAt: "desc" },
    take: 200,
  });

  return NextResponse.json(
    exchanges.map((e: (typeof exchanges)[number]) => ({
      id: e.id,
      date: e.date.toISOString().slice(0, 10),
      staffAId: e.staffAId,
      staffAName: e.staffA.name,
      staffBId: e.staffBId,
      staffBName: e.staffB.name,
      staffADutyName: e.staffADutyCode?.name ?? "Off / nothing assigned",
      staffBDutyName: e.staffBDutyCode?.name ?? "Off / nothing assigned",
      note: e.note,
      status: e.status,
      createdAt: e.createdAt.toISOString(),
    }))
  );
}

// POST /api/duty-exchanges -- staff propose swapping whatever they and a
// colleague each have on the same date. Snapshots both sides' current
// duty immediately; the partner then has to accept before it goes to an
// admin for final approval.
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

  if (parsed.data.partnerStaffId === staffId) {
    return NextResponse.json(
      { error: "You can't propose an exchange with yourself." },
      { status: 400 }
    );
  }

  const partner = await prisma.staff.findFirst({
    where: { id: parsed.data.partnerStaffId, teamId },
  });
  if (!partner) {
    return NextResponse.json(
      { error: "That staff member wasn't found." },
      { status: 404 }
    );
  }

  const date = new Date(parsed.data.date + "T00:00:00.000Z");

  const [myEntry, partnerEntry] = await Promise.all([
    prisma.rotaEntry.findUnique({
      where: { teamId_staffId_date: { teamId, staffId, date } },
    }),
    prisma.rotaEntry.findUnique({
      where: {
        teamId_staffId_date: {
          teamId,
          staffId: parsed.data.partnerStaffId,
          date,
        },
      },
    }),
  ]);

  const created = await prisma.dutyExchange.create({
    data: {
      teamId,
      date,
      staffAId: staffId,
      staffBId: parsed.data.partnerStaffId,
      staffADutyCodeId: myEntry?.dutyCodeId ?? null,
      staffBDutyCodeId: partnerEntry?.dutyCodeId ?? null,
      note: parsed.data.note || null,
    },
    include: {
      staffA: true,
      staffB: true,
      staffADutyCode: true,
      staffBDutyCode: true,
    },
  });

  return NextResponse.json(
    {
      id: created.id,
      date: created.date.toISOString().slice(0, 10),
      staffAId: created.staffAId,
      staffAName: created.staffA.name,
      staffBId: created.staffBId,
      staffBName: created.staffB.name,
      staffADutyName: created.staffADutyCode?.name ?? "Off / nothing assigned",
      staffBDutyName: created.staffBDutyCode?.name ?? "Off / nothing assigned",
      note: created.note,
      status: created.status,
      createdAt: created.createdAt.toISOString(),
    },
    { status: 201 }
  );
}
