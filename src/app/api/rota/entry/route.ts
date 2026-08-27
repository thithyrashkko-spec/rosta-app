import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const entrySchema = z.object({
  staffId: z.string(),
  date: z.string(), // YYYY-MM-DD
  // null clears the cell (deletes the entry)
  dutyCodeId: z.string().nullable(),
});

// PUT /api/rota/entry -- upsert or clear a single grid cell. This is the
// autosave call the grid fires on every edit; it returns the previous
// dutyCodeId so the client can build an undo stack without a round trip.
export async function PUT(req: Request) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if ((session.user as any).role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const teamId = (session.user as any).teamId as string;
  const userId = (session.user as any).id as string;

  const body = await req.json();
  const parsed = entrySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const staff = await prisma.staff.findFirst({
    where: { id: parsed.data.staffId, teamId },
  });
  if (!staff) {
    return NextResponse.json({ error: "Staff not found" }, { status: 404 });
  }

  const date = new Date(parsed.data.date + "T00:00:00.000Z");

  const previous = await prisma.rotaEntry.findUnique({
    where: {
      teamId_staffId_date: { teamId, staffId: parsed.data.staffId, date },
    },
  });

  if (parsed.data.dutyCodeId === null) {
    if (previous) {
      await prisma.rotaEntry.delete({ where: { id: previous.id } });
    }
    return NextResponse.json({
      previousDutyCodeId: previous?.dutyCodeId ?? null,
      dutyCodeId: null,
    });
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

  const saved = await prisma.rotaEntry.upsert({
    where: {
      teamId_staffId_date: { teamId, staffId: parsed.data.staffId, date },
    },
    // Editing a day directly detaches it from any leave period it belonged
    // to, so the individual override sticks even if the period is later
    // bulk-edited.
    update: {
      dutyCodeId: dutyCode.id,
      leavePeriodId: null,
      updatedByUserId: userId,
    },
    create: {
      teamId,
      staffId: parsed.data.staffId,
      date,
      dutyCodeId: dutyCode.id,
      updatedByUserId: userId,
    },
  });

  return NextResponse.json({
    previousDutyCodeId: previous?.dutyCodeId ?? null,
    dutyCodeId: saved.dutyCodeId,
  });
}
