import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const decideSchema = z.object({
  status: z.enum(["APPROVED", "REJECTED"]),
});

// PATCH /api/duty-requests/[id] -- admin approves or rejects. Approving
// writes straight into RotaEntry, same effect as a manual grid click.
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

  const request = await prisma.dutyRequest.findFirst({
    where: { id, teamId },
  });
  if (!request) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  if (request.status !== "PENDING") {
    return NextResponse.json(
      { error: "This request has already been decided." },
      { status: 409 }
    );
  }

  const updated = await prisma.dutyRequest.update({
    where: { id },
    data: {
      status: parsed.data.status,
      decidedAt: new Date(),
      decidedByUserId: userId,
    },
  });

  if (parsed.data.status === "APPROVED") {
    await prisma.rotaEntry.upsert({
      where: {
        teamId_staffId_date: {
          teamId,
          staffId: request.staffId,
          date: request.date,
        },
      },
      update: { dutyCodeId: request.dutyCodeId, leavePeriodId: null },
      create: {
        teamId,
        staffId: request.staffId,
        date: request.date,
        dutyCodeId: request.dutyCodeId,
      },
    });
  }

  return NextResponse.json({ id: updated.id, status: updated.status });
}
