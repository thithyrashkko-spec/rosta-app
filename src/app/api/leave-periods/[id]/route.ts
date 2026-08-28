import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function DELETE(
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

  const period = await prisma.leavePeriod.findFirst({
    where: { id, teamId },
  });
  if (!period) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  // Only remove days still linked to this period -- a day someone edited
  // directly on the grid already detached (leavePeriodId set to null) and
  // stays untouched.
  await prisma.rotaEntry.deleteMany({
    where: { teamId, leavePeriodId: id },
  });
  await prisma.leavePeriod.delete({ where: { id } });

  return NextResponse.json({ ok: true });
}
