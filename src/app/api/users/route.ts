import { NextResponse } from "next/server";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const createUserSchema = z.object({
  email: z.string().email(),
  name: z.string().min(1),
  password: z.string().min(6),
  role: z.enum(["ADMIN", "STAFF"]),
});

export async function GET() {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if ((session.user as any).role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const teamId = (session.user as any).teamId as string;
  const users = await prisma.user.findMany({
    where: { teamId },
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      createdAt: true,
      staffId: true,
    },
    orderBy: { createdAt: "asc" },
  });

  return NextResponse.json(users);
}

// Create a new login for a team member. This is how you give other staff
// their own view-only (STAFF role) or admin access -- no email invite flow,
// you just hand them the email/password you set here.
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
  const parsed = createUserSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const existing = await prisma.user.findUnique({
    where: { email: parsed.data.email },
  });
  if (existing) {
    return NextResponse.json(
      { error: "A user with that email already exists" },
      { status: 409 }
    );
  }

  const passwordHash = await bcrypt.hash(parsed.data.password, 10);

  const user = await prisma.user.create({
    data: {
      teamId,
      email: parsed.data.email,
      name: parsed.data.name,
      passwordHash,
      role: parsed.data.role,
    },
    select: { id: true, email: true, name: true, role: true, createdAt: true, staffId: true },
  });

  return NextResponse.json(user, { status: 201 });
}
