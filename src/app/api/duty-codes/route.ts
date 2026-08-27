import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const createDutyCodeSchema = z.object({
  code: z.string().min(1).max(8),
  name: z.string().min(1),
  color: z.string().min(1),
  category: z.string().min(1),
  isWorkingDay: z.boolean().default(true),
  isLeave: z.boolean().default(false),
});

export async function GET(req: Request) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const teamId = (session.user as any).teamId as string;
  const includeInactive = new URL(req.url).searchParams.get(
    "includeInactive"
  );

  const codes = await prisma.dutyCode.findMany({
    where: { teamId, ...(includeInactive ? {} : { isActive: true }) },
    orderBy: { sortOrder: "asc" },
  });

  return NextResponse.json(codes);
}

// Also used for "add a new code on the fly from the rota grid".
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
  const parsed = createDutyCodeSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const existing = await prisma.dutyCode.findUnique({
    where: { teamId_code: { teamId, code: parsed.data.code } },
  });
  if (existing) {
    return NextResponse.json(
      { error: "A duty code with that short code already exists" },
      { status: 409 }
    );
  }

  const last = await prisma.dutyCode.findFirst({
    where: { teamId },
    orderBy: { sortOrder: "desc" },
  });

  const dutyCode = await prisma.dutyCode.create({
    data: {
      teamId,
      ...parsed.data,
      sortOrder: (last?.sortOrder ?? -1) + 1,
    },
  });

  return NextResponse.json(dutyCode, { status: 201 });
}
