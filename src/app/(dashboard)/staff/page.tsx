import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { StaffTable } from "./staff-table";

export default async function StaffPage() {
  const session = await auth();
  const teamId = (session?.user as any)?.teamId as string;
  const isAdmin = (session?.user as any)?.role === "ADMIN";

  const staff = await prisma.staff.findMany({
    where: { teamId },
    orderBy: { sortOrder: "asc" },
  });

  return (
    <div className="max-w-4xl">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Staff</h1>
          <p className="text-sm text-gray-500">
            Manage your team roster. Marking someone as left hides them from
            new rotas but keeps their history intact.
          </p>
        </div>
      </div>

      <StaffTable initialStaff={staff} isAdmin={isAdmin} />
    </div>
  );
}
