"use client";

import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  getVisibleDates,
  shiftAnchor,
  dateKey,
  dayLabel,
  dateLabel,
  rangeLabel,
  type ViewMode,
} from "@/lib/date-utils";

type Staff = { id: string; name: string; designation: string | null };
type DutyCode = {
  id: string;
  code: string;
  name: string;
  color: string;
  category: string;
  isWorkingDay: boolean;
  isLeave: boolean;
};

type UndoAction = {
  staffId: string;
  date: string;
  previousDutyCodeId: string | null;
  newDutyCodeId: string | null;
};

function entryKey(staffId: string, date: string) {
  return `${staffId}__${date}`;
}

export function RotaGrid({
  staff,
  dutyCodes: initialDutyCodes,
  isAdmin,
  team,
}: {
  staff: Staff[];
  dutyCodes: DutyCode[];
  isAdmin: boolean;
  team: {
    name: string;
    departmentUnit: string | null;
    logoDataUrl: string | null;
  } | null;
}) {
  const [viewMode, setViewMode] = useState<ViewMode>("week");
  const [anchor, setAnchor] = useState(() => new Date());
  const [dutyCodes, setDutyCodes] = useState<DutyCode[]>(initialDutyCodes);
  const [entries, setEntries] = useState<Record<string, string | null>>({});
  const [nonOfficialDates, setNonOfficialDates] = useState<Set<string>>(
    new Set()
  );
  const [loading, setLoading] = useState(false);
  const [picker, setPicker] = useState<{
    staffId: string;
    date: string;
    x: number;
    y: number;
  } | null>(null);
  const [addingCode, setAddingCode] = useState(false);

  const undoStack = useRef<UndoAction[]>([]);
  const redoStack = useRef<UndoAction[]>([]);
  const [, forceRender] = useState(0);

  const dutyCodeById = useMemo(
    () => new Map(dutyCodes.map((d) => [d.id, d])),
    [dutyCodes]
  );

  const dates = useMemo(() => getVisibleDates(anchor, viewMode), [
    anchor,
    viewMode,
  ]);

  const groups = useMemo(() => {
    const map = new Map<string, Staff[]>();
    for (const s of staff) {
      const key = s.designation?.trim() || "Staff";
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(s);
    }
    return Array.from(map.entries());
  }, [staff]);

  // Fetch entries whenever the visible date range changes.
  useEffect(() => {
    if (dates.length === 0) return;
    const start = dateKey(dates[0]);
    const end = dateKey(dates[dates.length - 1]);
    setLoading(true);
    fetch(`/api/rota?start=${start}&end=${end}`)
      .then((r) => r.json())
      .then((data: { entries: any[]; nonOfficialDates: string[] }) => {
        setEntries((prev) => {
          const next = { ...prev };
          for (const e of data.entries) {
            next[entryKey(e.staffId, e.date)] = e.dutyCodeId;
          }
          return next;
        });
        setNonOfficialDates(new Set(data.nonOfficialDates));
      })
      .finally(() => setLoading(false));
  }, [dates]);

  async function applyChange(
    staffId: string,
    date: string,
    dutyCodeId: string | null,
    recordUndo = true
  ) {
    const prevValue = entries[entryKey(staffId, date)] ?? null;
    setEntries((prev) => ({ ...prev, [entryKey(staffId, date)]: dutyCodeId }));

    const res = await fetch("/api/rota/entry", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ staffId, date, dutyCodeId }),
    });

    if (res.ok && recordUndo) {
      const data = await res.json();
      undoStack.current.push({
        staffId,
        date,
        previousDutyCodeId: data.previousDutyCodeId ?? prevValue,
        newDutyCodeId: dutyCodeId,
      });
      redoStack.current = [];
      forceRender((n) => n + 1);
    }
  }

  const handleUndo = useCallback(async () => {
    const action = undoStack.current.pop();
    if (!action) return;
    setEntries((prev) => ({
      ...prev,
      [entryKey(action.staffId, action.date)]: action.previousDutyCodeId,
    }));
    await fetch("/api/rota/entry", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        staffId: action.staffId,
        date: action.date,
        dutyCodeId: action.previousDutyCodeId,
      }),
    });
    redoStack.current.push(action);
    forceRender((n) => n + 1);
  }, []);

  const handleRedo = useCallback(async () => {
    const action = redoStack.current.pop();
    if (!action) return;
    setEntries((prev) => ({
      ...prev,
      [entryKey(action.staffId, action.date)]: action.newDutyCodeId,
    }));
    await fetch("/api/rota/entry", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        staffId: action.staffId,
        date: action.date,
        dutyCodeId: action.newDutyCodeId,
      }),
    });
    undoStack.current.push(action);
    forceRender((n) => n + 1);
  }, []);

  useEffect(() => {
    if (!isAdmin) return;
    function onKeyDown(e: KeyboardEvent) {
      const isMod = e.ctrlKey || e.metaKey;
      if (!isMod) return;
      if (e.key.toLowerCase() === "z" && !e.shiftKey) {
        e.preventDefault();
        handleUndo();
      } else if (
        (e.key.toLowerCase() === "z" && e.shiftKey) ||
        e.key.toLowerCase() === "y"
      ) {
        e.preventDefault();
        handleRedo();
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [handleUndo, handleRedo]);

  function openPicker(staffId: string, date: string, e: React.MouseEvent) {
    if (!isAdmin) return;
    const rect = (e.target as HTMLElement).getBoundingClientRect();
    setAddingCode(false);
    setPicker({ staffId, date, x: rect.left, y: rect.bottom + 4 });
  }

  async function handleAddDutyCode(form: {
    code: string;
    name: string;
    color: string;
    category: string;
    isWorkingDay: boolean;
    isLeave: boolean;
  }) {
    const res = await fetch("/api/duty-codes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    if (!res.ok) return;
    const created: DutyCode = await res.json();
    setDutyCodes((prev) => [...prev, created]);
    if (picker) {
      await applyChange(picker.staffId, picker.date, created.id);
    }
    setAddingCode(false);
    setPicker(null);
  }

  // Per-staff totals across the visible range: count of each duty code.
  function staffTotals(staffId: string) {
    const counts = new Map<string, number>();
    for (const d of dates) {
      const id = entries[entryKey(staffId, dateKey(d))];
      if (!id) continue;
      counts.set(id, (counts.get(id) ?? 0) + 1);
    }
    return counts;
  }

  return (
    <div>
      {team && (team.name || team.departmentUnit || team.logoDataUrl) && (
        <div className="mb-4 flex items-center gap-3 border-b border-border pb-4">
          {team.logoDataUrl && (
            <img
              src={team.logoDataUrl}
              alt={team.name}
              className="h-12 w-12 object-contain"
            />
          )}
          <div>
            {team.name && (
              <div className="text-base font-semibold">{team.name}</div>
            )}
            {team.departmentUnit && (
              <div className="text-sm text-gray-500">
                {team.departmentUnit}
              </div>
            )}
          </div>
          <div className="ml-auto text-sm text-gray-500">
            From: {dates.length > 0 ? dateLabel(dates[0]) : ""} To:{" "}
            {dates.length > 0 ? dateLabel(dates[dates.length - 1]) : ""}
          </div>
        </div>
      )}

      <Toolbar
        viewMode={viewMode}
        setViewMode={setViewMode}
        anchor={anchor}
        setAnchor={setAnchor}
        dates={dates}
        onUndo={handleUndo}
        onRedo={handleRedo}
        loading={loading}
        isAdmin={isAdmin}
      />

      {/* Shown only when printing/exporting to PDF -- the on-screen toolbar
          is hidden via print:hidden, so this stands in as the page title. */}
      <div className="mb-2 hidden print:block">
        <h2 className="text-lg font-semibold">{rangeLabel(dates, viewMode)}</h2>
      </div>

      <div className="mt-4 overflow-x-auto rounded-xl border border-border bg-white print:overflow-visible print:border-0">
        <table className="min-w-full border-collapse text-sm">
          <thead>
            <tr>
              <th className="sticky left-0 z-10 min-w-[200px] border-b border-r border-border bg-gray-50 px-3 py-2 text-left font-medium text-gray-600">
                Name
              </th>
              {dates.map((d) => {
                const key = dateKey(d);
                const isNonOfficial = nonOfficialDates.has(key);
                return (
                  <th
                    key={key}
                    className={`min-w-[84px] border-b border-border px-2 py-2 text-center font-medium ${
                      isNonOfficial
                        ? "bg-amber-50 italic text-amber-700"
                        : "bg-gray-50 text-gray-600"
                    }`}
                  >
                    <div>{dayLabel(d)}</div>
                    <div className="text-xs font-normal text-gray-400">
                      {dateLabel(d)}
                    </div>
                  </th>
                );
              })}
              <th className="min-w-[160px] border-b border-l border-border bg-gray-50 px-3 py-2 text-left font-medium text-gray-600">
                Totals
              </th>
            </tr>
          </thead>
          <tbody>
            {groups.map(([designation, members]) => {
              const usedDutyCodeIds = dutyCodes
                .filter((dc) =>
                  members.some((m) =>
                    dates.some(
                      (d) => entries[entryKey(m.id, dateKey(d))] === dc.id
                    )
                  )
                )
                .map((dc) => dc.id);

              return (
                <Fragment key={designation}>
                  <tr key={`group-${designation}`}>
                    <td
                      colSpan={dates.length + 2}
                      className="border-b border-border bg-teal-600 px-3 py-1.5 text-xs font-semibold uppercase tracking-wide text-white"
                    >
                      {designation}
                    </td>
                  </tr>
                  {members.map((s) => {
                    const totals = staffTotals(s.id);
                    return (
                      <tr key={s.id}>
                        <td className="sticky left-0 z-10 border-b border-r border-border bg-white px-3 py-2 font-medium">
                          {s.name}
                        </td>
                        {dates.map((d) => {
                          const key = dateKey(d);
                          const dutyCodeId = entries[entryKey(s.id, key)];
                          const duty = dutyCodeId
                            ? dutyCodeById.get(dutyCodeId)
                            : null;
                          return (
                            <td
                              key={key}
                              onClick={(e) => openPicker(s.id, key, e)}
                              className={`border-b border-border p-1 text-center align-middle ${
                                isAdmin ? "cursor-pointer" : ""
                              }`}
                            >
                              {duty ? (
                                <span
                                  className="inline-block w-full rounded px-1.5 py-1 text-xs font-semibold text-white"
                                  style={{ backgroundColor: duty.color }}
                                  title={duty.name}
                                >
                                  {duty.code}
                                </span>
                              ) : (
                                <span className="inline-block w-full rounded px-1.5 py-1 text-xs text-gray-300 hover:bg-gray-50">
                                  —
                                </span>
                              )}
                            </td>
                          );
                        })}
                        <td className="border-b border-l border-border px-3 py-2 text-xs text-gray-500">
                          {Array.from(totals.entries())
                            .map(
                              ([id, count]) =>
                                `${dutyCodeById.get(id)?.code ?? "?"} ${count}`
                            )
                            .join(" · ") || "—"}
                        </td>
                      </tr>
                    );
                  })}
                  {usedDutyCodeIds.map((dutyCodeId) => {
                    const duty = dutyCodeById.get(dutyCodeId);
                    return (
                      <tr
                        key={`${designation}-total-${dutyCodeId}`}
                        className="bg-gray-50"
                      >
                        <td className="sticky left-0 z-10 border-b border-r border-border bg-gray-50 px-3 py-1.5 text-xs font-medium text-gray-500">
                          Total {duty?.name ?? "?"}
                        </td>
                        {dates.map((d) => {
                          const key = dateKey(d);
                          const count = members.filter(
                            (m) => entries[entryKey(m.id, key)] === dutyCodeId
                          ).length;
                          return (
                            <td
                              key={key}
                              className="border-b border-border px-2 py-1.5 text-center text-xs text-gray-500"
                            >
                              {count}
                            </td>
                          );
                        })}
                        <td className="border-b border-l border-border bg-gray-50" />
                      </tr>
                    );
                  })}
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </div>

      {picker && (
        <DutyCodePicker
          x={picker.x}
          y={picker.y}
          dutyCodes={dutyCodes}
          adding={addingCode}
          onSelect={(id) => {
            applyChange(picker.staffId, picker.date, id);
            setPicker(null);
          }}
          onClear={() => {
            applyChange(picker.staffId, picker.date, null);
            setPicker(null);
          }}
          onStartAdd={() => setAddingCode(true)}
          onCancelAdd={() => setAddingCode(false)}
          onSubmitAdd={handleAddDutyCode}
          onClose={() => {
            setPicker(null);
            setAddingCode(false);
          }}
        />
      )}
    </div>
  );
}

function Toolbar({
  viewMode,
  setViewMode,
  anchor,
  setAnchor,
  dates,
  onUndo,
  onRedo,
  loading,
  isAdmin,
}: {
  viewMode: ViewMode;
  setViewMode: (m: ViewMode) => void;
  anchor: Date;
  setAnchor: (d: Date) => void;
  dates: Date[];
  onUndo: () => void;
  onRedo: () => void;
  loading: boolean;
  isAdmin: boolean;
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 print:hidden">
      <div className="flex items-center gap-2">
        <button
          onClick={() => setAnchor(shiftAnchor(anchor, viewMode, -1))}
          className="rounded-md border border-border bg-white px-2.5 py-1.5 text-sm hover:bg-gray-50"
        >
          ← Prev
        </button>
        <button
          onClick={() => setAnchor(new Date())}
          className="rounded-md border border-border bg-white px-2.5 py-1.5 text-sm hover:bg-gray-50"
        >
          Today
        </button>
        <button
          onClick={() => setAnchor(shiftAnchor(anchor, viewMode, 1))}
          className="rounded-md border border-border bg-white px-2.5 py-1.5 text-sm hover:bg-gray-50"
        >
          Next →
        </button>
        <span className="ml-2 text-sm font-medium text-gray-700">
          {rangeLabel(dates, viewMode)}
        </span>
        {loading && <span className="text-xs text-gray-400">Loading…</span>}
      </div>

      <div className="flex items-center gap-2">
        {isAdmin && (
          <>
            <button
              onClick={onUndo}
              className="rounded-md border border-border bg-white px-2.5 py-1.5 text-sm hover:bg-gray-50"
              title="Undo (Ctrl+Z)"
            >
              Undo
            </button>
            <button
              onClick={onRedo}
              className="rounded-md border border-border bg-white px-2.5 py-1.5 text-sm hover:bg-gray-50"
              title="Redo (Ctrl+Shift+Z)"
            >
              Redo
            </button>
          </>
        )}

        <button
          onClick={() => window.print()}
          className="rounded-md border border-border bg-white px-2.5 py-1.5 text-sm hover:bg-gray-50"
          title="Export the current view as a PDF"
        >
          Export PDF
        </button>

        <div className="ml-2 flex rounded-md border border-border bg-white p-0.5 text-sm">
          <button
            onClick={() => setViewMode("week")}
            className={`rounded px-2.5 py-1 ${
              viewMode === "week" ? "bg-gray-900 text-white" : "text-gray-600"
            }`}
          >
            Weekly
          </button>
          <button
            onClick={() => setViewMode("month")}
            className={`rounded px-2.5 py-1 ${
              viewMode === "month" ? "bg-gray-900 text-white" : "text-gray-600"
            }`}
          >
            Monthly
          </button>
        </div>
      </div>
    </div>
  );
}

function DutyCodePicker({
  x,
  y,
  dutyCodes,
  adding,
  onSelect,
  onClear,
  onStartAdd,
  onCancelAdd,
  onSubmitAdd,
  onClose,
}: {
  x: number;
  y: number;
  dutyCodes: DutyCode[];
  adding: boolean;
  onSelect: (id: string) => void;
  onClear: () => void;
  onStartAdd: () => void;
  onCancelAdd: () => void;
  onSubmitAdd: (form: {
    code: string;
    name: string;
    color: string;
    category: string;
    isWorkingDay: boolean;
    isLeave: boolean;
  }) => void;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [color, setColor] = useState("#3b82f6");
  const [category, setCategory] = useState("");
  const [isWorkingDay, setIsWorkingDay] = useState(true);
  const [isLeave, setIsLeave] = useState(false);

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        onClose();
      }
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, [onClose]);

  // Keep the popover on-screen.
  const style = {
    left: Math.min(x, window.innerWidth - 260),
    top: Math.min(y, window.innerHeight - 320),
  };

  return (
    <div
      ref={ref}
      style={style}
      className="fixed z-50 w-60 rounded-lg border border-border bg-white p-2 shadow-lg"
    >
      {!adding ? (
        <>
          <div className="max-h-64 space-y-0.5 overflow-y-auto">
            {dutyCodes.map((d) => (
              <button
                key={d.id}
                onClick={() => onSelect(d.id)}
                className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm hover:bg-gray-50"
              >
                <span
                  className="h-3 w-3 shrink-0 rounded-sm"
                  style={{ backgroundColor: d.color }}
                />
                <span className="font-medium">{d.code}</span>
                <span className="truncate text-gray-500">{d.name}</span>
              </button>
            ))}
          </div>
          <div className="mt-1 space-y-0.5 border-t border-border pt-1">
            <button
              onClick={onClear}
              className="w-full rounded-md px-2 py-1.5 text-left text-sm text-gray-500 hover:bg-gray-50"
            >
              Clear cell
            </button>
            <button
              onClick={onStartAdd}
              className="w-full rounded-md px-2 py-1.5 text-left text-sm text-gray-900 hover:bg-gray-50"
            >
              + New duty code
            </button>
          </div>
        </>
      ) : (
        <div className="space-y-2">
          <div className="flex gap-2">
            <input
              placeholder="Code"
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              maxLength={8}
              className="w-16 rounded-md border border-border px-2 py-1 text-sm"
            />
            <input
              type="color"
              value={color}
              onChange={(e) => setColor(e.target.value)}
              className="h-[30px] w-10 rounded-md border border-border"
            />
          </div>
          <input
            placeholder="Full name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full rounded-md border border-border px-2 py-1 text-sm"
          />
          <input
            placeholder="Category (free text)"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className="w-full rounded-md border border-border px-2 py-1 text-sm"
          />
          <label className="flex items-center gap-1.5 text-xs text-gray-600">
            <input
              type="checkbox"
              checked={isWorkingDay}
              onChange={(e) => setIsWorkingDay(e.target.checked)}
            />
            Counts as working
          </label>
          <label className="flex items-center gap-1.5 text-xs text-gray-600">
            <input
              type="checkbox"
              checked={isLeave}
              onChange={(e) => setIsLeave(e.target.checked)}
            />
            Counts as leave
          </label>
          <div className="flex justify-end gap-2 pt-1">
            <button
              onClick={onCancelAdd}
              className="rounded-md px-2 py-1 text-xs text-gray-500 hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              onClick={() =>
                onSubmitAdd({
                  code,
                  name,
                  color,
                  category,
                  isWorkingDay,
                  isLeave,
                })
              }
              disabled={!code || !name || !category}
              className="rounded-md bg-gray-900 px-2.5 py-1 text-xs font-medium text-white disabled:opacity-50"
            >
              Add &amp; assign
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
