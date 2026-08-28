import Link from "next/link";
import { auth } from "@/lib/auth";
import { Providers } from "@/components/providers";
import { SignOutButton } from "@/components/sign-out-button";

const NAV_ITEMS = [
  { href: "/rota", label: "Rota" },
  { href: "/staff", label: "Staff" },
  { href: "/duty-codes", label: "Duty codes" },
  { href: "/leave", label: "Leave" },
  { href: "/requests", label: "Requests" },
  { href: "/reports", label: "Reports" },
];

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  const isAdmin = (session?.user as any)?.role === "ADMIN";

  return (
    <Providers>
      <div className="flex min-h-screen">
        <aside className="w-56 shrink-0 border-r border-border bg-white px-4 py-6 print:hidden">
          <div className="mb-8 px-2 text-lg font-semibold">Rota</div>
          <nav className="space-y-1">
            {NAV_ITEMS.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="block rounded-md px-2 py-1.5 text-sm text-gray-700 hover:bg-gray-100"
              >
                {item.label}
              </Link>
            ))}
            {isAdmin && (
              <>
                <Link
                  href="/users"
                  className="block rounded-md px-2 py-1.5 text-sm text-gray-700 hover:bg-gray-100"
                >
                  Users
                </Link>
                <Link
                  href="/settings"
                  className="block rounded-md px-2 py-1.5 text-sm text-gray-700 hover:bg-gray-100"
                >
                  Settings
                </Link>
                <Link
                  href="/import"
                  className="block rounded-md px-2 py-1.5 text-sm text-gray-700 hover:bg-gray-100"
                >
                  Import from Excel
                </Link>
              </>
            )}
          </nav>

          <div className="mt-10 border-t border-border pt-4 px-2 text-xs text-gray-500">
            <div className="mb-1 font-medium text-gray-700">
              {session?.user?.name}
            </div>
            <div className="mb-3">{(session?.user as any)?.role}</div>
            <SignOutButton />
          </div>
        </aside>

        <main className="flex-1 p-8 print:p-0">{children}</main>
      </div>
    </Providers>
  );
}
