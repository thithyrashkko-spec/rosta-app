import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { DutyCodesTable } from "./duty-codes-table";

export default async function DutyCodesPage() {
  const session = await auth();
  const teamId = (session?.user as any)?.teamId as string;
  const isAdmin = (session?.user as any)?.role === "ADMIN";

  if (!isAdmin) {
    redirect("/rota");
  }

  const dutyCodes = await prisma.dutyCode.findMany({
    where: { teamId },
    orderBy: { sortOrder: "asc" },
  });

  return (
    <div className="max-w-3xl">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold">Duty codes</h1>
        <p className="text-sm text-gray-500">
          These show up as the colored chips on the rota grid. Order here
          also controls order in the cell picker.
        </p>
      </div>

      <DutyCodesTable initialCodes={dutyCodes} />
    </div>
  );
}
