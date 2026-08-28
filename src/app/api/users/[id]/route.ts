import { NextResponse } from "next/server";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const updateSchema = z.object({
  role: z.enum(["ADMIN", "STAFF"]).optional(),
  password: z.string().min(6).optional(),
  staffId: z.string().nullable().optional(),
});

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
  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const existing = await prisma.user.findFirst({
    where: { id, teamId },
  });
  if (!existing) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const data: {
    role?: "ADMIN" | "STAFF";
    passwordHash?: string;
    staffId?: string | null;
  } = {};
  if (parsed.data.role) data.role = parsed.data.role;
  if (parsed.data.password) {
    data.passwordHash = await bcrypt.hash(parsed.data.password, 10);
  }
  if (parsed.data.staffId !== undefined) {
    if (parsed.data.staffId) {
      const staff = await prisma.staff.findFirst({
        where: { id: parsed.data.staffId, teamId },
      });
      if (!staff) {
        return NextResponse.json(
          { error: "Staff member not found" },
          { status: 404 }
        );
      }
      const alreadyLinked = await prisma.user.findFirst({
        where: { staffId: parsed.data.staffId, id: { not: id } },
      });
      if (alreadyLinked) {
        return NextResponse.json(
          { error: "That staff member already has a login linked" },
          { status: 409 }
        );
      }
    }
    data.staffId = parsed.data.staffId;
  }

  const user = await prisma.user.update({
    where: { id },
    data,
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      createdAt: true,
      staffId: true,
    },
  });

  return NextResponse.json(user);
}

// No DELETE: we don't hard-delete logins for the same reason we don't
// hard-delete Staff -- keeps updatedByUserId references on RotaEntry valid.
// An admin who wants to lock someone out should reset their password to
// something only the admin knows, or downgrade their role.
