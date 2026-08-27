import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const updateStaffSchema = z.object({
  name: z.string().min(1).optional(),
  contactInfo: z.string().optional().nullable(),
  designation: z.string().optional().nullable(),
  isActive: z.boolean().optional(),
});

// PATCH /api/staff/[id] -- edit fields, or flip isActive to "mark left" /
// reinstate. We never delete a Staff row so historical RotaEntry data
// (which references staffId) always stays intact.
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
  const body = await req.json();
  const parsed = updateStaffSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const existing = await prisma.staff.findFirst({
    where: { id, teamId },
  });
  if (!existing) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const staff = await prisma.staff.update({
    where: { id },
    data: parsed.data,
  });

  return NextResponse.json(staff);
}