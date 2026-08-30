import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const createStaffSchema = z.object({
  name: z.string().min(1),
  contactInfo: z.string().optional().nullable(),
  designation: z.string().optional().nullable(),
  department: z.string().optional().nullable(),
});

// GET /api/staff?includeInactive=1
export async function GET(req: Request) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const teamId = (session.user as any).teamId as string;
  const includeInactive = new URL(req.url).searchParams.get(
    "includeInactive"
  );

  const staff = await prisma.staff.findMany({
    where: {
      teamId,
      ...(includeInactive ? {} : { isActive: true }),
    },
    orderBy: { sortOrder: "asc" },
  });

  return NextResponse.json(staff);
}

// POST /api/staff -- create a new staff member, appended to the end of
// the current display order.
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
  const parsed = createStaffSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const last = await prisma.staff.findFirst({
    where: { teamId },
    orderBy: { sortOrder: "desc" },
  });

  const staff = await prisma.staff.create({
    data: {
      teamId,
      name: parsed.data.name,
      contactInfo: parsed.data.contactInfo ?? null,
      designation: parsed.data.designation ?? null,
      department: parsed.data.department ?? null,
      sortOrder: (last?.sortOrder ?? -1) + 1,
    },
  });

  return NextResponse.json(staff, { status: 201 });
}
