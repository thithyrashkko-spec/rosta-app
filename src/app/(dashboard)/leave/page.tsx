import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { LeaveView } from "./leave-view";

export default async function LeavePage() {
  const session = await auth();
  const teamId = (session?.user as any)?.teamId as string;
  const isAdmin = (session?.user as any)?.role === "ADMIN";

  if (!isAdmin) {
    redirect("/rota");
  }

  const [periods, staff, dutyCodes] = await Promise.all([
    prisma.leavePeriod.findMany({
      where: { teamId },
      include: { staff: true, dutyCode: true },
      orderBy: { startDate: "desc" },
      take: 200,
    }),
    prisma.staff.findMany({
      where: { teamId, isActive: true },
      orderBy: { sortOrder: "asc" },
      select: { id: true, name: true },
    }),
    prisma.dutyCode.findMany({
      where: { teamId, isActive: true },
      orderBy: { sortOrder: "asc" },
      select: { id: true, name: true, isLeave: true },
    }),
  ]);

  return (
    <div className="max-w-3xl">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold">Leave</h1>
        <p className="text-sm text-gray-500">
          Book a multi-day leave period — it fills the rota for that whole
          range automatically. For a single day off, just set it directly on
          the Rota grid instead.
        </p>
      </div>

      <LeaveView
        initialPeriods={periods.map((p: (typeof periods)[number]) => ({
          id: p.id,
          staffId: p.staffId,
          staffName: p.staff.name,
          dutyCodeId: p.dutyCodeId,
          dutyCodeName: p.dutyCode.name,
          startDate: p.startDate.toISOString().slice(0, 10),
          endDate: p.endDate.toISOString().slice(0, 10),
          note: p.note,
        }))}
        staff={staff}
        dutyCodes={dutyCodes}
      />
    </div>
  );
}
