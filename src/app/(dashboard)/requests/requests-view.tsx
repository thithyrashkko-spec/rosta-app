"use client";

import { useEffect, useState } from "react";

type DutyCode = { id: string; code: string; name: string; color: string };
type DutyRequest = {
  id: string;
  staffId: string;
  staffName: string;
  date: string;
  dutyCodeId: string;
  dutyCodeName: string;
  dutyCodeColor: string;
  note: string | null;
  status: "PENDING" | "APPROVED" | "REJECTED";
  createdAt: string;
};

export function RequestsView({
  isAdmin,
  hasLinkedStaff,
  dutyCodes,
}: {
  isAdmin: boolean;
  hasLinkedStaff: boolean;
  dutyCodes: DutyCode[];
}) {
  const [requests, setRequests] = useState<DutyRequest[]>([]);
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    const res = await fetch("/api/duty-requests");
    if (res.ok) setRequests(await res.json());
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  async function handleDecide(id: string, status: "APPROVED" | "REJECTED") {
    setRequests((prev) =>
      prev.map((r) => (r.id === id ? { ...r, status } : r))
    );
    const res = await fetch(`/api/duty-requests/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    if (!res.ok) load(); // revert to server state if it failed
  }

  return (
    <div className="space-y-5">
      {!isAdmin && (
        <RequestForm
          dutyCodes={dutyCodes}
          hasLinkedStaff={hasLinkedStaff}
          onCreated={(r) => setRequests((prev) => [r, ...prev])}
        />
      )}

      <div className="overflow-hidden rounded-xl border border-border bg-white">
        <div className="grid grid-cols-[1fr_1fr_1fr_100px_auto] gap-2 border-b border-border bg-gray-50 px-4 py-2 text-xs font-medium uppercase tracking-wide text-gray-500">
          {isAdmin && <div>Staff</div>}
          {!isAdmin && <div>Date</div>}
          <div>{isAdmin ? "Date" : "Duty"}</div>
          <div>{isAdmin ? "Duty" : "Note"}</div>
          <div>Status</div>
          <div className="text-right">{isAdmin ? "Decide" : ""}</div>
        </div>

        {requests.map((r) => (
          <div
            key={r.id}
            className="grid grid-cols-[1fr_1fr_1fr_100px_auto] items-center gap-2 border-b border-border px-4 py-2.5 text-sm last:border-b-0"
          >
            {isAdmin && <div className="font-medium">{r.staffName}</div>}
            <div>{r.date}</div>
            <div className="flex items-center gap-1.5">
              <span
                className="h-2.5 w-2.5 rounded-sm"
                style={{ backgroundColor: r.dutyCodeColor }}
              />
              {r.dutyCodeName}
            </div>
            {!isAdmin && (
              <div className="truncate text-gray-500">{r.note || "—"}</div>
            )}
            {isAdmin && (
              <div className="truncate text-gray-500">{r.note || "—"}</div>
            )}
            <div>
              <StatusBadge status={r.status} />
            </div>
            <div className="text-right">
              {isAdmin && r.status === "PENDING" && (
                <div className="flex justify-end gap-2">
                  <button
                    onClick={() => handleDecide(r.id, "APPROVED")}
                    className="rounded-md bg-gray-900 px-2 py-1 text-xs font-medium text-white hover:bg-gray-800"
                  >
                    Approve
                  </button>
                  <button
                    onClick={() => handleDecide(r.id, "REJECTED")}
                    className="rounded-md border border-border px-2 py-1 text-xs text-gray-600 hover:bg-gray-50"
                  >
                    Reject
                  </button>
                </div>
              )}
            </div>
          </div>
        ))}

        {!loading && requests.length === 0 && (
          <div className="px-4 py-8 text-center text-sm text-gray-400">
            No requests yet.
          </div>
        )}
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: DutyRequest["status"] }) {
  const styles = {
    PENDING: "bg-amber-50 text-amber-700",
    APPROVED: "bg-green-50 text-green-700",
    REJECTED: "bg-gray-100 text-gray-500",
  };
  return (
    <span className={`rounded px-1.5 py-0.5 text-xs ${styles[status]}`}>
      {status.charAt(0) + status.slice(1).toLowerCase()}
    </span>
  );
}

function RequestForm({
  dutyCodes,
  hasLinkedStaff,
  onCreated,
}: {
  dutyCodes: DutyCode[];
  hasLinkedStaff: boolean;
  onCreated: (r: DutyRequest) => void;
}) {
  const [date, setDate] = useState("");
  const [dutyCodeId, setDutyCodeId] = useState(dutyCodes[0]?.id ?? "");
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!hasLinkedStaff) {
    return (
      <div className="rounded-xl border border-border bg-amber-50 p-4 text-sm text-amber-800">
        Your login isn't linked to a staff record yet, so you can't submit
        requests. Ask an admin to link your login on the Users page.
      </div>
    );
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);

    const res = await fetch("/api/duty-requests", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ date, dutyCodeId, note }),
    });

    setSaving(false);

    if (!res.ok) {
      const data = await res.json().catch(() => null);
      setError(data?.error || "Couldn't submit the request.");
      return;
    }

    onCreated(await res.json());
    setDate("");
    setNote("");
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="flex flex-wrap items-end gap-3 rounded-xl border border-border bg-white p-4"
    >
      <div className="space-y-1">
        <label className="text-xs font-medium text-gray-500">Date</label>
        <input
          type="date"
          required
          value={date}
          onChange={(e) => setDate(e.target.value)}
          className="rounded-md border border-border px-3 py-2 text-sm"
        />
      </div>

      <div className="space-y-1">
        <label className="text-xs font-medium text-gray-500">Duty</label>
        <select
          value={dutyCodeId}
          onChange={(e) => setDutyCodeId(e.target.value)}
          className="rounded-md border border-border px-3 py-2 text-sm"
        >
          {dutyCodes.map((d) => (
            <option key={d.id} value={d.id}>
              {d.name}
            </option>
          ))}
        </select>
      </div>

      <div className="min-w-[160px] flex-1 space-y-1">
        <label className="text-xs font-medium text-gray-500">
          Note (optional)
        </label>
        <input
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Reason, if any"
          className="w-full rounded-md border border-border px-3 py-2 text-sm"
        />
      </div>

      <button
        type="submit"
        disabled={saving || !date || !dutyCodeId}
        className="rounded-md bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-800 disabled:opacity-60"
      >
        {saving ? "Submitting…" : "Submit request"}
      </button>

      {error && <p className="w-full text-sm text-red-600">{error}</p>}
    </form>
  );
}
