import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { RequestsView } from "./requests-view";

export default async function RequestsPage() {
  const session = await auth();
  const teamId = (session?.user as any)?.teamId as string;
  const isAdmin = (session?.user as any)?.role === "ADMIN";
  const staffId = (session?.user as any)?.staffId as string | null;

  const dutyCodes = await prisma.dutyCode.findMany({
    where: { teamId, isActive: true },
    orderBy: { sortOrder: "asc" },
    select: { id: true, code: true, name: true, color: true },
  });

  return (
    <div className="max-w-3xl">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold">Duty requests</h1>
        <p className="text-sm text-gray-500">
          {isAdmin
            ? "Requests from your team, waiting on your decision."
            : "Request a specific duty or a day off on a date. Up to 2 requests per week."}
        </p>
      </div>

      <RequestsView
        isAdmin={isAdmin}
        hasLinkedStaff={!!staffId}
        dutyCodes={dutyCodes}
      />
    </div>
  );
}
