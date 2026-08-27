import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const reorderSchema = z.object({
  // Ordered list of staff IDs, top to bottom, as the new display order.
  orderedIds: z.array(z.string()).min(1),
});

// POST /api/staff/reorder -- persist a full new ordering (from drag-drop
// or up/down). This drives display order everywhere: the staff list and
// every rota row.
export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if ((session.user as any).role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const teamId = (session.user as any).teamId as string;
  const body = await req.json();
  const parsed = reorderSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const owned = await prisma.staff.findMany({
    where: { teamId, id: { in: parsed.data.orderedIds } },
    select: { id: true },
  });
  if (owned.length !== parsed.data.orderedIds.length) {
    return NextResponse.json(
      { error: "One or more staff IDs are invalid" },
      { status: 400 }
    );
  }

  await prisma.$transaction(
    parsed.data.orderedIds.map((id, index) =>
      prisma.staff.update({ where: { id }, data: { sortOrder: index } })
    )
  );

  return NextResponse.json({ ok: true });
}
