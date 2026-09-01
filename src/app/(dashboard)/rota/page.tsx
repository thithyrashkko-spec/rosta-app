import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getDepartmentScope, staffDepartmentWhere } from "@/lib/department-scope";
import { RotaGrid } from "./rota-grid";

export default async function RotaPage() {
  const session = await auth();
  const teamId = (session?.user as any)?.teamId as string;
  const isAdmin = (session?.user as any)?.role === "ADMIN";
  const role = (session?.user as any)?.role as string;
  const viewerStaffId = (session?.user as any)?.staffId as string | null;

  const scope = await getDepartmentScope(role, viewerStaffId);

  if (scope.restricted && !scope.linked) {
    return (
      <div className="rounded-xl border border-border bg-amber-50 p-4 text-sm text-amber-800">
        Your login isn't linked to a staff record yet, so we don't know
        which department's rota to show you. Ask an admin to link your
        login on the Users page.
      </div>
    );
  }

  const [staff, dutyCodes, team] = await Promise.all([
    prisma.staff.findMany({
      where: { teamId, isActive: true, ...staffDepartmentWhere(scope) },
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
          department: s.department,
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
