import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { ImportForm } from "./import-form";

export default async function ImportPage() {
  const session = await auth();
  const isAdmin = (session?.user as any)?.role === "ADMIN";

  if (!isAdmin) {
    redirect("/rota");
  }

  return (
    <div className="max-w-2xl">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold">Import from Excel</h1>
        <p className="text-sm text-gray-500">
          Upload a roster sheet laid out as: SNO, Designation, Name, RC No,
          then one column per day, with a row of dates directly under the
          headers. This is best-effort — check the preview before
          confirming, and the summary afterward.
        </p>
      </div>

      <ImportForm />
    </div>
  );
}