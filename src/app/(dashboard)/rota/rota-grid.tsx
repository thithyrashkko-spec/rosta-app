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
      counts.set(id, (counts.get(id) ?? 0)