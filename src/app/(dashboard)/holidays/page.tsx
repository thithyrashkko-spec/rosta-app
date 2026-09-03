import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { HolidaysView } from "./holidays-view";

export default async function HolidaysPage() {
  const session = await auth();
  const isAdmin = (session?.user as any)?.role === "ADMIN";

  if (!isAdmin) {
    redirect("/rota");
  }

  return (
    <div className="max-w-2xl">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold">Holidays &amp; non-official days</h1>
        <p className="text-sm text-gray-500">
          These are the dates that count as non-official/extra-pay on the
          rota. Set a recurring weekday (like every Friday), or add specific
          one-off dates yourself.
        </p>
      </div>

      <HolidaysView />
    </div>
  );
}
