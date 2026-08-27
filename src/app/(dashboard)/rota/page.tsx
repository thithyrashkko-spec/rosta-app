import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { RotaGrid } from "./rota-grid";

export default async function RotaPage() {
  const session = await auth();
  const teamId = (session?.user as any)?.teamId as string;
  const isAdmin = (session?.user as any)?.role === "ADMIN";

  const [staff, dutyCodes, team] = await Promise.all([
    prisma.staff.findMany({
      where: { teamId, isActive: true },
      orderBy: { sortOrder: "asc" },
    }),
    prisma.dutyCode.findMany({
      where: { teamId, isActive: true },
      orderBy: { sortOrder: "asc" },
    }),
    prisma.team.findUnique({
      where: { id: teamId },
      select: { name: true, departmentUnit: true, logoDataUrl: true },
    }),
  ]);

  return (
    <div>
      <RotaGrid
        isAdmin={isAdmin}
        team={team}
        staff={staff.map((s: (typeof staff)[number]) => ({
          id: s.id,
          name: s.name,
          designation: s.designation,
        }))}
        dutyCodes={dutyCodes.map((d: (typeof dutyCodes)[number]) => ({
          id: d.id,
          code: d.code,
          name: d.name,
          color: d.color,
          category: d.category,
          isWorkingDay: d.isWorkingDay,
          isLeave: d.isLeave,
        }))}
      />
    </div>
  );
}
