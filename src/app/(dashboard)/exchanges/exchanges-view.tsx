"use client";

import { useEffect, useState } from "react";

type Exchange = {
  id: string;
  date: string;
  staffAId: string;
  staffAName: string;
  staffBId: string;
  staffBName: string;
  staffADutyName: string;
  staffBDutyName: string;
  note: string | null;
  status: "PENDING_PARTNER" | "PENDING_ADMIN" | "APPROVED" | "REJECTED";
  createdAt: string;
};

export function ExchangesView({
  isAdmin,
  currentStaffId,
  staff,
}: {
  isAdmin: boolean;
  currentStaffId: string | null;
  staff: { id: string; name: string }[];
}) {
  const [exchanges, setExchanges] = useState<Exchange[]>([]);

  async function load() {
    const res = await fetch("/api/duty-exchanges");
    if (res.ok) setExchanges(await res.json());
  }

  useEffect(() => {
    load();
  }, []);

  async function respond(id: string, accept: boolean) {
    setExchanges((prev) =>
      prev.map((e) =>
        e.id === id
          ? { ...e, status: accept ? "PENDING_ADMIN" : "REJECTED" }
          : e
      )
    );
    const res = await fetch(`/api/duty-exchanges/${id}/respond`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ accept }),
    });
    if (!res.ok) load();
  }

  async function decide(id: string, approve: boolean) {
    setExchanges((prev) =>
      prev.map((e) =>
        e.id === id
          ? { ...e, status: approve ? "APPROVED" : "REJECTED" }
          : e
      )
    );
    const res = await fetch(`/api/duty-exchanges/${id}/decide`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ approve }),
    });
    if (!res.ok) load();
  }

  const mine = currentStaffId
    ? exchanges.filter(
        (e) => e.staffAId === currentStaffId || e.staffBId === currentStaffId
      )
    : [];
  const awaitingAdmin = exchanges.filter((e) => e.status === "PENDING_ADMIN");

  return (
    <div className="space-y-6">
      {currentStaffId ? (
        <ProposeForm
          staff={staff.filter((s) => s.id !== currentStaffId)}
          onCreated={(e) => setExchanges((prev) => [e, ...prev])}
        />
      ) : (
        <div className="rounded-xl border border-border bg-amber-50 p-4 text-sm text-amber-800">
          Your login isn't linked to a staff record yet, so you can't
          propose exchanges. Ask an admin to link your login on the Users
          page.
        </div>
      )}

      {currentStaffId && (
        <div>
          <h2 className="mb-2 text-sm font-semibold text-gray-700">
            Your exchanges
          </h2>
          <ExchangeList
            exchanges={mine}
            currentStaffId={currentStaffId}
            onRespond={respond}
          />
        </div>
      )}

      {isAdmin && (
        <div>
          <h2 className="mb-2 text-sm font-semibold text-gray-700">
            Awaiting your approval
          </h2>
          {awaitingAdmin.length === 0 ? (
            <p className="text-sm text-gray-400">Nothing waiting.</p>
          ) : (
            <div className="overflow-hidden rounded-xl border border-border bg-white">
              {awaitingAdmin.map((e) => (
                <div
                  key={e.id}
                  className="flex items-center justify-between gap-3 border-b border-border px-4 py-3 text-sm last:border-b-0"
                >
                  <div>
                    <div className="font-medium">
                      {e.staffAName} ↔ {e.staffBName}
                    </div>
                    <div className="text-gray-500">
                      {e.date} — {e.staffAName} gets "{e.staffBDutyName}",{" "}
                      {e.staffBName} gets "{e.staffADutyName}"
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => decide(e.id, true)}
                      className="rounded-md bg-gray-900 px-2.5 py-1 text-xs font-medium text-white hover:bg-gray-800"
                    >
                      Approve
                    </button>
                    <button
                      onClick={() => decide(e.id, false)}
                      className="rounded-md border border-border px-2.5 py-1 text-xs text-gray-600 hover:bg-gray-50"
                    >
                      Reject
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function ExchangeList({
  exchanges,
  currentStaffId,
  onRespond,
}: {
  exchanges: Exchange[];
  currentStaffId: string;
  onRespond: (id: string, accept: boolean) => void;
}) {
  if (exchanges.length === 0) {
    return <p className="text-sm text-gray-400">No exchanges yet.</p>;
  }

  return (
    <div className="overflow-hidden rounded-xl border border-border bg-white">
      {exchanges.map((e) => {
        const iAmPartner = e.staffBId === currentStaffId;
        const otherName =
          e.staffAId === currentStaffId ? e.staffBName : e.staffAName;
        return (
          <div
            key={e.id}
            className="flex items-center justify-between gap-3 border-b border-border px-4 py-3 text-sm last:border-b-0"
          >
            <div>
              <div className="font-medium">
                {e.date} with {otherName}
              </div>
              <div className="text-gray-500">
                You'd get "
                {e.staffAId === currentStaffId
                  ? e.staffBDutyName
                  : e.staffADutyName}
                " · {otherName} would get "
                {e.staffAId === currentStaffId
                  ? e.staffADutyName
                  : e.staffBDutyName}
                "
              </div>
            </div>
            <div className="flex items-center gap-2">
              <StatusBadge status={e.status} />
              {iAmPartner && e.status === "PENDING_PARTNER" && (
                <>
                  <button
                    onClick={() => onRespond(e.id, true)}
                    className="rounded-md bg-gray-900 px-2.5 py-1 text-xs font-medium text-white hover:bg-gray-800"
                  >
                    Accept
                  </button>
                  <button
                    onClick={() => onRespond(e.id, false)}
                    className="rounded-md border border-border px-2.5 py-1 text-xs text-gray-600 hover:bg-gray-50"
                  >
                    Decline
                  </button>
                </>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function StatusBadge({ status }: { status: Exchange["status"] }) {
  const styles: Record<Exchange["status"], string> = {
    PENDING_PARTNER: "bg-amber-50 text-amber-700",
    PENDING_ADMIN: "bg-blue-50 text-blue-700",
    APPROVED: "bg-green-50 text-green-700",
    REJECTED: "bg-gray-100 text-gray-500",
  };
  const labels: Record<Exchange["status"], string> = {
    PENDING_PARTNER: "Awaiting partner",
    PENDING_ADMIN: "Awaiting admin",
    APPROVED: "Approved",
    REJECTED: "Rejected",
  };
  return (
    <span className={`rounded px-1.5 py-0.5 text-xs ${styles[status]}`}>
      {labels[status]}
    </span>
  );
}

function ProposeForm({
  staff,
  onCreated,
}: {
  staff: { id: string; name: string }[];
  onCreated: (e: Exchange) => void;
}) {
  const [date, setDate] = useState("");
  const [partnerStaffId, setPartnerStaffId] = useState(staff[0]?.id ?? "");
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);

    const res = await fetch("/api/duty-exchanges", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ date, partnerStaffId, note }),
    });

    setSaving(false);

    if (!res.ok) {
      const data = await res.json().catch(() => null);
      setError(data?.error || "Couldn't submit the exchange.");
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
        <label className="text-xs font-medium text-gray-500">
          Swap with
        </label>
        <select
          value={partnerStaffId}
          onChange={(e) => setPartnerStaffId(e.target.value)}
          className="rounded-md border border-border px-3 py-2 text-sm"
        >
          {staff.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
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
        disabled={saving || !date || !partnerStaffId}
        className="rounded-md bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-800 disabled:opacity-60"
      >
        {saving ? "Sending…" : "Propose exchange"}
      </button>

      {error && <p className="w-full text-sm text-red-600">{error}</p>}
    </form>
  );
}
