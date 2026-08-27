import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const updateSchema = z.object({
  name: z.string().min(1).optional(),
  departmentUnit: z.string().optional().nullable(),
  // A data: URL (base64) -- simplest way to store a small logo without
  // needing separate file storage set up.
  logoDataUrl: z.string().optional().nullable(),
});

export async function GET() {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const teamId = (session.user as any).teamId as string;

  const team = await prisma.team.findUnique({
    where: { id: teamId },
    select: { name: true, departmentUnit: true, logoDataUrl: true },
  });

  return NextResponse.json(team);
}

export async function PATCH(req: Request) {
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

  const team = await prisma.team.update({
    where: { id: teamId },
    data: parsed.data,
    select: { name: true, departmentUnit: true, logoDataUrl: true },
  });

  return NextResponse.json(team);
}
