import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const respondSchema = z.object({
  accept: z.boolean(),
});

// PATCH /api/duty-exchanges/[id]/respond -- only the partner (staffB) can
// respond, and only while it's still waiting on them.
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const teamId = (session.user as any).teamId as string;
  const staffId = (session.user as any).staffId as string | null;

  const body = await req.json();
  const parsed = respondSchema.safeParse(body);
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
  if (exchange.staffBId !== staffId) {
    return NextResponse.json(
      { error: "Only the invited staff member can respond to this." },
      { status: 403 }
    );
  }
  if (exchange.status !== "PENDING_PARTNER") {
    return NextResponse.json(
      { error: "This exchange isn't waiting on you anymore." },
      { status: 409 }
    );
  }

  const updated = await prisma.dutyExchange.update({
    where: { id },
    data: {
      status: parsed.data.accept ? "PENDING_ADMIN" : "REJECTED",
      partnerDecidedAt: new Date(),
    },
  });

  return NextResponse.json({ id: updated.id, status: updated.status });
}
