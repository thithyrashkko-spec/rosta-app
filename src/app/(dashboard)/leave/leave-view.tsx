"use client";

import { useState } from "react";
import { LeaveCalendar } from "./leave-calendar";

type Period = {
  id: string;
  staffId: string;
  staffName: string;
  dutyCodeId: string;
  dutyCodeName: string;
  startDate: string;
  endDate: string;
  note: string | null;
};

export function LeaveView({
  initialPeriods,
  staff,
  dutyCodes,
}: {
  initialPeriods: Period[];
  staff: { id: string; name: string }[];
  dutyCodes: { id: string; name: string; isLeave: boolean }[];
}) {
  const [periods, setPeriods] = useState<Period[]>(initialPeriods);
  const [view, setView] = useState<"list" | "calendar">("list");
  const [staffId, setStaffId] = useState(staff[0]?.id ?? "");
  const [dutyCodeId, setDutyCodeId] = useState(
    dutyCodes.find((d) => d.isLeave)?.id ?? dutyCodes[0]?.id ?? ""
  );
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);

    const res = await fetch("/api/leave-periods", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ staffId, dutyCodeId, startDate, endDate, note }),
    });

    setSaving(false);

    if (!res.ok) {
      const data = await res.json().catch(() => null);
      setError(data?.error || "Couldn't save that leave period.");
      return;
    }

    const created = await res.json();
    setPeriods((prev) => [created, ...prev]);
    setStartDate("");
    setEndDate("");
    setNote("");
  }

  async function handleDelete(id: string) {
    if (!confirm("Remove this leave period? Days still linked to it will be cleared from the rota.")) {
      return;
    }
    setPeriods((prev) => prev.filter((p) => p.id !== id));
    await fetch(`/api/leave-periods/${id}`, { method: "DELETE" });
  }

  return (
    <div className="space-y-6">
      <form
        onSubmit={handleSubmit}
        className="space-y-4 rounded-xl border border-border bg-white p-6"
      >
        <h2 className="text-sm font-semibold">New leave period</h2>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <label className="text-xs font-medium text-gray-500">
              Staff
            </label>
            <select
              value={staffId}
              onChange={(e) => setStaffId(e.target.value)}
              className="w-full rounded-md border border-border px-3 py-2 text-sm"
            >
              {staff.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium text-gray-500">
              Leave type
            </label>
            <select
              value={dutyCodeId}
              onChange={(e) => setDutyCodeId(e.target.value)}
              className="w-full rounded-md border border-border px-3 py-2 text-sm"
            >
              {dutyCodes.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium text-gray-500">
              Start date
            </label>
            <input
              type="date"
              required
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="w-full rounded-md border border-border px-3 py-2 text-sm"
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium text-gray-500">
              End date
            </label>
            <input
              type="date"
              required
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="w-full rounded-md border border-border px-3 py-2 text-sm"
            />
          </div>
        </div>

        <div className="space-y-1">
          <label className="text-xs font-medium text-gray-500">
            Note (optional)
          </label>
          <input
            value={note}
            onChange={(e) => setNote(e.target.value)}
            className="w-full rounded-md border border-border px-3 py-2 text-sm"
          />
        </div>

        {error && <p className="text-sm text-red-600">{error}</p>}

        <button
          type="submit"
          disabled={saving || !staffId || !dutyCodeId || !startDate || !endDate}
          className="rounded-md bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-800 disabled:opacity-60"
        >
          {saving ? "Saving…" : "Create leave period"}
        </button>
      </form>

      <div className="flex rounded-md border border-border bg-white p-0.5 text-sm w-fit">
        <button
          onClick={() => setView("list")}
          className={`rounded px-3 py-1 ${
            view === "list" ? "bg-gray-900 text-white" : "text-gray-600"
          }`}
        >
          List
        </button>
        <button
          onClick={() => setView("calendar")}
          className={`rounded px-3 py-1 ${
            view === "calendar" ? "bg-gray-900 text-white" : "text-gray-600"
          }`}
        >
          Calendar
        </button>
      </div>

      {view === "calendar" ? (
        <LeaveCalendar periods={periods} />
      ) : (
        <div className="overflow-hidden rounded-xl border border-border bg-white">
          <div className="grid grid-cols-[1fr_1fr_1fr_1fr_auto] gap-2 border-b border-border bg-gray-50 px-4 py-2 text-xs font-medium uppercase tracking-wide text-gray-500">
            <div>Staff</div>
            <div>Type</div>
            <div>Start</div>
            <div>End</div>
            <div className="text-right">Actions</div>
          </div>

          {periods.map((p) => (
            <div
              key={p.id}
              className="grid grid-cols-[1fr_1fr_1fr_1fr_auto] items-center gap-2 border-b border-border px-4 py-2.5 text-sm last:border-b-0"
            >
              <div className="font-medium">{p.staffName}</div>
              <div>{p.dutyCodeName}</div>
              <div className="text-gray-500">{p.startDate}</div>
              <div className="text-gray-500">{p.endDate}</div>
              <div className="text-right">
                <button
                  onClick={() => handleDelete(p.id)}
                  className="text-gray-500 hover:text-red-600"
                >
                  Remove
                </button>
              </div>
            </div>
          ))}

          {periods.length === 0 && (
            <div className="px-4 py-8 text-center text-sm text-gray-400">
              No leave periods yet.
            </div>
          )}
        </div>
      )}
    </div>
  );
}
