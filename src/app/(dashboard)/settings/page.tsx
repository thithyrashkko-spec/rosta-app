import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { SettingsForm } from "./settings-form";

export default async function SettingsPage() {
  const session = await auth();
  const teamId = (session?.user as any)?.teamId as string;
  const isAdmin = (session?.user as any)?.role === "ADMIN";

  if (!isAdmin) {
    redirect("/rota");
  }

  const team = await prisma.team.findUnique({
    where: { id: teamId },
    select: { name: true, departmentUnit: true, logoDataUrl: true },
  });

  return (
    <div className="max-w-lg">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold">Settings</h1>
        <p className="text-sm text-gray-500">
          This shows as a letterhead at the top of the rota and in PDF
          exports.
        </p>
      </div>

      <SettingsForm
        initialName={team?.name ?? ""}
        initialDepartmentUnit={team?.departmentUnit ?? ""}
        initialLogoDataUrl={team?.logoDataUrl ?? null}
      />
    </div>
  );
}
