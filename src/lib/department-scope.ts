import { prisma } from "@/lib/prisma";

export type DepartmentScope =
  | { restricted: false }
  | { restricted: true; linked: false }
  | { restricted: true; linked: true; department: string | null };

// Admins see everything. A staff-role viewer only sees their own
// department (null/empty department is treated as one shared "General"
// bucket, matching how the rota grid groups unset departments together).
// A staff-role viewer whose login isn't linked to a Staff record sees
// nothing, since we have no way to know which department is theirs.
export async function getDepartmentScope(
  role: string,
  staffId: string | null
): Promise<DepartmentScope> {
  if (role === "ADMIN") return { restricted: false };
  if (!staffId) return { restricted: true, linked: false };

  const staff = await prisma.staff.findUnique({
    where: { id: staffId },
    select: { department: true },
  });

  return {
    restricted: true,
    linked: true,
    department: staff?.department?.trim() || null,
  };
}

// Prisma `where` fragment for the Staff model matching a scope's allowed
// department. Use directly for Staff queries, or nested under `staff: {}`
// for queries joining to Staff (RotaEntry, DutyRequest, etc.).
export function staffDepartmentWhere(scope: DepartmentScope) {
  if (!scope.restricted) return {};
  if (!scope.linked) return { id: "__no_access__" };
  if (scope.department) return { department: scope.department };
  return { OR: [{ department: null }, { department: "" }] };
}
