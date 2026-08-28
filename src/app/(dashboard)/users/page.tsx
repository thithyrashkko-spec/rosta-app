import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { UsersTable } from "./users-table";

export default async function UsersPage() {
  const session = await auth();
  const teamId = (session?.user as any)?.teamId as string;
  const isAdmin = (session?.user as any)?.role === "ADMIN";

  if (!isAdmin) {
    redirect("/rota");
  }

  const [users, staff] = await Promise.all([
    prisma.user.findMany({
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
    }),
    prisma.staff.findMany({
      where: { teamId, isActive: true },
      select: { id: true, name: true },
      orderBy: { sortOrder: "asc" },
    }),
  ]);

  return (
    <div className="max-w-3xl">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold">Users</h1>
        <p className="text-sm text-gray-500">
          Create a login for each team member. Give someone the{" "}
          <strong>Staff</strong> role for view-only access to the rota, or{" "}
          <strong>Admin</strong> if they should be able to edit it. Link a
          login to a staff member so they can submit their own duty
          requests.
        </p>
      </div>

      <UsersTable
        initialUsers={users.map((u: (typeof users)[number]) => ({
          ...u,
          createdAt: u.createdAt.toISOString(),
        }))}
        staffOptions={staff}
      />
    </div>
  );
}
