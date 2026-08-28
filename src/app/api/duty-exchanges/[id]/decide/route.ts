import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const decideSchema = z.object({
  approve: z.boolean(),
});

// PATCH /api/duty-exchanges/[id]/decide -- admin's final sign-off. Approving
// swaps the two staff members' RotaEntry for that date using the duty each
// had snapshotted at proposal time -- a null snapshot means that side had
// nothing assigned, so the other side's cell gets cleared instead of set.
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
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
  const parsed = decideSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const exchange = await prisma.dutyExchange.findFirst({
    where: { id, teamId },
  });
  if (!exchange) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  if (exchange.status !== "PENDING_ADMIN") {
    return NextResponse.json(
      { error: "This exchange isn't ready for admin approval yet." },
      { status: 409 }
    );
  }

  const updated = await prisma.dutyExchange.update({
    where: { id },
    data: {
      status: parsed.data.approve ? "APPROVED" : "REJECTED",
      adminDecidedAt: new Date(),
      decidedByUserId: userId,
    },
  });

  if (parsed.data.approve) {
    // staffA receives what staffB had, and vice versa.
    if (exchange.staffBDutyCodeId) {
      await prisma.rotaEntry.upsert({
        where: {
          teamId_staffId_date: {
            teamId,
            staffId: exchange.staffAId,
            date: exchange.date,
          },
        },
        update: { dutyCodeId: exchange.staffBDutyCodeId, leavePeriodId: null },
        create: {
          teamId,
          staffId: exchange.staffAId,
          date: exchange.date,
          dutyCodeId: exchange.staffBDutyCodeId,
        },
      });
    } else {
      await prisma.rotaEntry.deleteMany({
        where: { teamId, staffId: exchange.staffAId, date: exchange.date },
      });
    }

    if (exchange.staffADutyCodeId) {
      await prisma.rotaEntry.upsert({
        where: {
          teamId_staffId_date: {
            teamId,
            staffId: exchange.staffBId,
            date: exchange.date,
          },
        },
        update: { dutyCodeId: exchange.staffADutyCodeId, leavePeriodId: null },
        create: {
          teamId,
          staffId: exchange.staffBId,
          date: exchange.date,
          dutyCodeId: exchange.staffADutyCodeId,
        },
      });
    } else {
      await prisma.rotaEntry.deleteMany({
        where: { teamId, staffId: exchange.staffBId, date: exchange.date },
      });
    }
  }

  return NextResponse.json({ id: updated.id, status: updated.status });
}
