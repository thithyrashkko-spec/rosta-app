"use client";

import { useMemo, useState, useTransition } from "react";
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  verticalListSortingStrategy,
  useSortable,
  arrayMove,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

type DutyCode = {
  id: string;
  code: string;
  name: string;
  color: string;
  category: string;
  isWorkingDay: boolean;
  isLeave: boolean;
  isActive: boolean;
  sortOrder: number;
};

export function DutyCodesTable({
  initialCodes,
}: {
  initialCodes: DutyCode[];
}) {
  const [codes, setCodes] = useState<DutyCode[]>(initialCodes);
  const [showInactive, setShowInactive] = useState(true);
  const [editing, setEditing] = useState<DutyCode | null>(null);
  const [adding, setAdding] = useState(false);
  const [, startTransition] = useTransition();

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } })
  );

  const visible = useMemo(
    () => codes.filter((c) => showInactive || c.isActive),
    [codes, showInactive]
  );

  async function handleToggleActive(c: DutyCode) {
    const next = !c.isActive;
    setCodes((prev) =>
      prev.map((p) => (p.id === c.id ? { ...p, isActive: next } : p))
    );
    await fetch(`/api/duty-codes/${c.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isActive: next }),
    });
  }

  async function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const activeIndex = visible.findIndex((c) => c.id === active.id);
    const overIndex = visible.findIndex((c) => c.id === over.id);
    if (activeIndex === -1 || overIndex === -1) return;

    const reordered = arrayMove(visible, activeIndex, overIndex);
    const visibleIds = new Set(visible.map((c) => c.id));
    let cursor = 0;
    const merged = codes.map((c) =>
      visibleIds.has(c.id) ? reordered[cursor++] : c
    );
    setCodes(merged);

    startTransition(() => {
      fetch("/api/duty-codes/reorder", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderedIds: merged.map((c) => c.id) }),
      });
    });
  }

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <label className="flex items-center gap-2 text-sm text-gray-600">
          <input
            type="checkbox"
            checked={showInactive}
            onChange={(e) => setShowInactive(e.target.checked)}
          />
          Show inactive codes
        </label>
        <button
          onClick={() => setAdding(true)}
          className="rounded-md bg-gray-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-gray-800"
        >
          + Add duty code
        </button>
      </div>

      <div className="overflow-hidden rounded-xl border border-border bg-white">
        <div className="grid grid-cols-[24px_60px_1.3fr_1fr_90px_90px_auto] gap-2 border-b border-border bg-gray-50 px-4 py-2 text-xs font-medium uppercase tracking-wide text-gray-500">
          <div />
          <div>Code</div>
          <div>Name</div>
          <div>Category</div>
          <div>Working</div>
          <div>Leave</div>
          <div className="text-right">Actions</div>
        </div>

        <DndContext
          id="duty-code-list"
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
        >
          <SortableContext
            items={visible.map((c) => c.id)}
            strategy={verticalListSortingStrategy}
          >
            {visible.map((c) => (
              <DutyCodeRow
                key={c.id}
                code={c}
                onEdit={() => setEditing(c)}
                onToggleActive={() => handleToggleActive(c)}
              />
            ))}
          </SortableContext>
        </DndContext>

        {visible.length === 0 && (
          <div className="px-4 py-8 text-center text-sm text-gray-400">
            No duty codes yet.
          </div>
        )}
      </div>

      {(adding || editing) && (
        <DutyCodeFormModal
          code={editing}
          onClose={() => {
            setAdding(false);
            setEditing(null);
          }}
          onSaved={(saved) => {
            setCodes((prev) => {
              const exists = prev.some((p) => p.id === saved.id);
              return exists
                ? prev.map((p) => (p.id === saved.id ? saved : p))
                : [...prev, saved];
            });
            setAdding(false);
            setEditing(null);
          }}
        />
      )}
    </div>
  );
}

function DutyCodeRow({
  code,
  onEdit,
  onToggleActive,
}: {
  code: DutyCode;
  onEdit: () => void;
  onToggleActive: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition } =
    useSortable({ id: code.id });
  const style = { transform: CSS.Transform.toString(transform), transition };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`grid grid-cols-[24px_60px_1.3fr_1fr_90px_90px_auto] items-center gap-2 border-b border-border px-4 py-2.5 text-sm last:border-b-0 ${
        !code.isActive ? "opacity-50" : ""
      }`}
    >
      <button
        {...attributes}
        {...listeners}
        className="cursor-grab text-gray-300 hover:text-gray-500"
        aria-label="Drag to reorder"
      >
        ⠿
      </button>
      <div className="flex items-center gap-1.5">
        <span
          className="h-3 w-3 shrink-0 rounded-sm"
          style={{ backgroundColor: code.color }}
        />
        <span className="font-medium">{code.code}</span>
      </div>
      <div>{code.name}</div>
      <div className="text-gray-500">{code.category}</div>
      <div className="text-gray-500">{code.isWorkingDay ? "Yes" : "No"}</div>
      <div className="text-gray-500">{code.isLeave ? "Yes" : "No"}</div>
      <div className="flex justify-end gap-3">
        <button onClick={onEdit} className="text-gray-500 hover:text-gray-900">
          Edit
        </button>
        <button
          onClick={onToggleActive}
          className="text-gray-500 hover:text-gray-900"
        >
          {code.isActive ? "Deactivate" : "Reactivate"}
        </button>
      </div>
    </div>
  );
}

function DutyCodeFormModal({
  code,
  onClose,
  onSaved,
}: {
  code: DutyCode | null;
  onClose: () => void;
  onSaved: (c: DutyCode) => void;
}) {
  const [shortCode, setShortCode] = useState(code?.code ?? "");
  const [name, setName] = useState(code?.name ?? "");
  const [color, setColor] = useState(code?.color ?? "#3b82f6");
  const [category, setCategory] = useState(code?.category ?? "");
  const [isWorkingDay, setIsWorkingDay] = useState(code?.isWorkingDay ?? true);
  const [isLeave, setIsLeave] = useState(code?.isLeave ?? false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);

    const url = code ? `/api/duty-codes/${code.id}` : "/api/duty-codes";
    const method = code ? "PATCH" : "POST";
    const body = code
      ? { name, color, category, isWorkingDay, isLeave }
      : { code: shortCode, name, color, category, isWorkingDay, isLeave };

    const res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    setSaving(false);

    if (!res.ok) {
      const data = await res.json().catch(() => null);
      setError(data?.error || "Couldn't save. Check the fields.");
      return;
    }

    onSaved(await res.json());
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 px-4">
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-sm space-y-4 rounded-xl bg-white p-6 shadow-lg"
      >
        <h2 className="text-lg font-semibold">
          {code ? "Edit duty code" : "Add duty code"}
        </h2>

        <div className="flex gap-2">
          <div className="w-24 space-y-1">
            <label className="text-sm font-medium">Short code</label>
            <input
              required
              disabled={!!code}
              maxLength={8}
              value={shortCode}
              onChange={(e) => setShortCode(e.target.value.toUpperCase())}
              className="w-full rounded-md border border-border px-2 py-2 text-sm disabled:bg-gray-50"
            />
          </div>
          <div className="space-y-1">
            <label className="text-sm font-medium">Color</label>
            <input
              type="color"
              value={color}
              onChange={(e) => setColor(e.target.value)}
              className="h-[38px] w-14 rounded-md border border-border"
            />
          </div>
        </div>

        <div className="space-y-1">
          <label className="text-sm font-medium">Full name</label>
          <input
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full rounded-md border border-border px-3 py-2 text-sm"
          />
        </div>

        <div className="space-y-1">
          <label className="text-sm font-medium">
            Category (free text — your own label)
          </label>
          <input
            required
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className="w-full rounded-md border border-border px-3 py-2 text-sm"
          />
        </div>

        <label className="flex items-center gap-2 text-sm text-gray-700">
          <input
            type="checkbox"
            checked={isWorkingDay}
            onChange={(e) => setIsWorkingDay(e.target.checked)}
          />
          Counts as working (coverage &amp; non-official tracking)
        </label>
        <label className="flex items-center gap-2 text-sm text-gray-700">
          <input
            type="checkbox"
            checked={isLeave}
            onChange={(e) => setIsLeave(e.target.checked)}
          />
          Counts as leave (reporting)
        </label>

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
            {saving ? "Saving…" : "Save"}
          </button>
        </div>
      </form>
    </div>
  );
}
