"use client";

import { useEffect, useState } from "react";

type Rule = { weekday: number; name: string; enabled: boolean };
type Override = { id: string; date: string; isNonOfficial: boolean };

export function HolidaysView() {
  const [rules, setRules] = useState<Rule[]>([]);
  const [overrides, setOverrides] = useState<Override[]>([]);
  const [loading, setLoading] = useState(true);
  const [newDate, setNewDate] = useState("");
  const [newIsNonOfficial, setNewIsNonOfficial] = useState(true);
  const [saving, setSaving] = useState(false);

  async function load() {
    setLoading(true);
    const [rulesRes, overridesRes] = await Promise.all([
      fetch("/api/non-official/rules"),
      fetch("/api/non-official/overrides"),
    ]);
    if (rulesRes.ok) setRules(await rulesRes.json());
    if (overridesRes.ok) setOverrides(await overridesRes.json());
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  async function toggleRule(weekday: number, enabled: boolean) {
    setRules((prev) =>
      prev.map((r) => (r.weekday === weekday ? { ...r, enabled } : r))
    );
    await fetch("/api/non-official/rules", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ weekday, enabled }),
    });
  }

  async function addOverride(e: React.FormEvent) {
    e.preventDefault();
    if (!newDate) return;
    setSaving(true);
    const res = await fetch("/api/non-official/overrides", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ date: newDate, isNonOfficial: newIsNonOfficial }),
    });
    setSaving(false);
    if (res.ok) {
      const created = await res.json();
      setOverrides((prev) => [
        created,
        ...prev.filter((o) => o.date !== created.date),
      ]);
      setNewDate("");
    }
  }

  async function removeOverride(id: string) {
    setOverrides((prev) => prev.filter((o) => o.id !== id));
    await fetch(`/api/non-official/overrides/${id}`, { method: "DELETE" });
  }

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-border bg-white p-6">
        <h2 className="mb-3 text-sm font-semibold">Recurring weekday</h2>
        <p className="mb-3 text-xs text-gray-400">
          Every date that falls on a checked day counts as non-official,
          unless you add a specific-date exception below.
        </p>
        <div className="flex flex-wrap gap-4">
          {rules.map((r) => (
            <label
              key={r.weekday}
              className="flex items-center gap-2 text-sm text-gray-700"
            >
              <input
                type="checkbox"
                checked={r.enabled}
                onChange={(e) => toggleRule(r.weekday, e.target.checked)}
              />
              {r.name}
            </label>
          ))}
        </div>
      </div>

      <div className="rounded-xl border border-border bg-white p-6">
        <h2 className="mb-3 text-sm font-semibold">Specific dates</h2>
        <p className="mb-3 text-xs text-gray-400">
          Add a one-off holiday (even on a day that isn't normally
          non-official), or mark a specific date as an exception (e.g. this
          particular Friday is a normal working day).
        </p>

        <form onSubmit={addOverride} className="flex flex-wrap items-end gap-3">
          <div className="space-y-1">
            <label className="text-xs font-medium text-gray-500">Date</label>
            <input
              type="date"
              required
              value={newDate}
              onChange={(e) => setNewDate(e.target.value)}
              className="rounded-md border border-border px-3 py-2 text-sm"
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium text-gray-500">
              Treat this date as
            </label>
            <select
              value={newIsNonOfficial ? "yes" : "no"}
              onChange={(e) => setNewIsNonOfficial(e.target.value === "yes")}
              className="rounded-md border border-border px-3 py-2 text-sm"
            >
              <option value="yes">Non-official (holiday)</option>
              <option value="no">Normal working day (exception)</option>
            </select>
          </div>
          <button
            type="submit"
            disabled={saving}
            className="rounded-md bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-800 disabled:opacity-60"
          >
            {saving ? "Adding…" : "Add"}
          </button>
        </form>

        <div className="mt-5 overflow-hidden rounded-lg border border-border">
          <div className="grid grid-cols-[1fr_1fr_auto] gap-2 border-b border-border bg-gray-50 px-3 py-2 text-xs font-medium uppercase tracking-wide text-gray-500">
            <div>Date</div>
            <div>Type</div>
            <div className="text-right">Actions</div>
          </div>
          {overrides.map((o) => (
            <div
              key={o.id}
              className="grid grid-cols-[1fr_1fr_auto] items-center gap-2 border-b border-border px-3 py-2 text-sm last:border-b-0"
            >
              <div>{o.date}</div>
              <div className={o.isNonOfficial ? "text-amber-700" : "text-gray-500"}>
                {o.isNonOfficial ? "Non-official (holiday)" : "Normal day (exception)"}
              </div>
              <div className="text-right">
                <button
                  onClick={() => removeOverride(o.id)}
                  className="text-gray-500 hover:text-red-600"
                >
                  Remove
                </button>
              </div>
            </div>
          ))}
          {!loading && overrides.length === 0 && (
            <div className="px-3 py-6 text-center text-sm text-gray-400">
              No specific dates added yet.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
