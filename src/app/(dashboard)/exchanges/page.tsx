import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { ExchangesView } from "./exchanges-view";

export default async function ExchangesPage() {
  const session = await auth();
  const teamId = (session?.user as any)?.teamId as string;
  const isAdmin = (session?.user as any)?.role === "ADMIN";
  const staffId = (session?.user as any)?.staffId as string | null;

  const staff = await prisma.staff.findMany({
    where: { teamId, isActive: true },
    orderBy: { sortOrder: "asc" },
    select: { id: true, name: true },
  });

  return (
    <div className="max-w-3xl">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold">Duty exchange</h1>
        <p className="text-sm text-gray-500">
          Propose swapping what you have on a date with a colleague. They
          have to accept, then an admin gives final approval before it
          changes the rota. Not limited to 2 per week.
        </p>
      </div>

      <ExchangesView
        isAdmin={isAdmin}
        currentStaffId={staffId}
        staff={staff}
      />
    </div>
  );
}
