"use client";

import { useState } from "react";

type UserRow = {
  id: string;
  email: string;
  name: string;
  role: "ADMIN" | "STAFF";
  createdAt: string;
};

export function UsersTable({ initialUsers }: { initialUsers: UserRow[] }) {
  const [users, setUsers] = useState<UserRow[]>(initialUsers);
  const [adding, setAdding] = useState(false);
  const [resettingId, setResettingId] = useState<string | null>(null);

  async function handleRoleChange(id: string, role: "ADMIN" | "STAFF") {
    setUsers((prev) => prev.map((u) => (u.id === id ? { ...u, role } : u)));
    await fetch(`/api/users/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ role }),
    });
  }

  return (
    <div>
      <div className="mb-4 flex justify-end">
        <button
          onClick={() => setAdding(true)}
          className="rounded-md bg-gray-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-gray-800"
        >
          + Add login
        </button>
      </div>

      <div className="overflow-hidden rounded-xl border border-border bg-white">
        <div className="grid grid-cols-[1.5fr_1fr_140px_auto] gap-2 border-b border-border bg-gray-50 px-4 py-2 text-xs font-medium uppercase tracking-wide text-gray-500">
          <div>Name / email</div>
          <div>Role</div>
          <div />
          <div className="text-right">Actions</div>
        </div>

        {users.map((u) => (
          <div
            key={u.id}
            className="grid grid-cols-[1.5fr_1fr_140px_auto] items-center gap-2 border-b border-border px-4 py-2.5 text-sm last:border-b-0"
          >
            <div>
              <div className="font-medium">{u.name}</div>
              <div className="text-gray-500">{u.email}</div>
            </div>
            <div>
              <select
                value={u.role}
                onChange={(e) =>
                  handleRoleChange(u.id, e.target.value as "ADMIN" | "STAFF")
                }
                className="rounded-md border border-border px-2 py-1 text-sm"
              >
                <option value="STAFF">Staff (view only)</option>
                <option value="ADMIN">Admin (can edit)</option>
              </select>
            </div>
            <div />
            <div className="text-right">
              <button
                onClick={() => setResettingId(u.id)}
                className="text-gray-500 hover:text-gray-900"
              >
                Reset password
              </button>
            </div>
          </div>
        ))}
      </div>

      {adding && (
        <AddUserModal
          onClose={() => setAdding(false)}
          onCreated={(u) => {
            setUsers((prev) => [...prev, u]);
            setAdding(false);
          }}
        />
      )}

      {resettingId && (
        <ResetPasswordModal
          userId={resettingId}
          onClose={() => setResettingId(null)}
        />
      )}
    </div>
  );
}

function AddUserModal({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: (u: UserRow) => void;
}) {
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<"ADMIN" | "STAFF">("STAFF");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);

    const res = await fetch("/api/users", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, name, password, role }),
    });

    setSaving(false);

    if (!res.ok) {
      const data = await res.json().catch(() => null);
      setError(data?.error || "Couldn't create the login.");
      return;
    }

    onCreated(await res.json());
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 px-4">
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-sm space-y-4 rounded-xl bg-white p-6 shadow-lg"
      >
        <h2 className="text-lg font-semibold">Add login</h2>

        <div className="space-y-1">
          <label className="text-sm font-medium">Name</label>
          <input
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full rounded-md border border-border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-gray-900/10"
          />
        </div>

        <div className="space-y-1">
          <label className="text-sm font-medium">Email</label>
          <input
            required
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full rounded-md border border-border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-gray-900/10"
          />
        </div>

        <div className="space-y-1">
          <label className="text-sm font-medium">Password</label>
          <input
            required
            minLength={6}
            type="text"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="At least 6 characters"
            className="w-full rounded-md border border-border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-gray-900/10"
          />
          <p className="text-xs text-gray-400">
            You'll share this with them directly — there's no invite email.
          </p>
        </div>

        <div className="space-y-1">
          <label className="text-sm font-medium">Access level</label>
          <select
            value={role}
            onChange={(e) => setRole(e.target.value as "ADMIN" | "STAFF")}
            className="w-full rounded-md border border-border px-3 py-2 text-sm"
          >
            <option value="STAFF">Staff — can view the rota only</option>
            <option value="ADMIN">Admin — can edit everything</option>
          </select>
        </div>

        {error && <p className="text-sm text-red-600">{error}</p>}

        <div className="flex justify-end gap-2 pt-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-md px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-100"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={saving}
            className="rounded-md bg-gray-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-gray-800 disabled:opacity-60"
          >
            {saving ? "Creating…" : "Create login"}
          </button>
        </div>
      </form>
    </div>
  );
}

function ResetPasswordModal({
  userId,
  onClose,
}: {
  userId: string;
  onClose: () => void;
}) {
  const [password, setPassword] = useState("");
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    await fetch(`/api/users/${userId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password }),
    });
    setSaving(false);
    setDone(true);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 px-4">
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-sm space-y-4 rounded-xl bg-white p-6 shadow-lg"
      >
        <h2 className="text-lg font-semibold">Reset password</h2>

        {done ? (
          <>
            <p className="text-sm text-gray-600">
              Password updated. Share the new password with them directly.
            </p>
            <div className="flex justify-end pt-2">
              <button
                type="button"
                onClick={onClose}
                className="rounded-md bg-gray-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-gray-800"
              >
                Done
              </button>
            </div>
          </>
        ) : (
          <>
            <div className="space-y-1">
              <label className="text-sm font-medium">New password</label>
              <input
                required
                minLength={6}
                type="text"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="At least 6 characters"
                className="w-full rounded-md border border-border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-gray-900/10"
              />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={onClose}
                className="rounded-md px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-100"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={saving}
                className="rounded-md bg-gray-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-gray-800 disabled:opacity-60"
              >
                {saving ? "Saving…" : "Set new password"}
              </button>
            </div>
          </>
        )}
      </form>
    </div>
  );
}
