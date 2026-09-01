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

type Staff = {
  id: string;
  name: string;
  contactInfo: string | null;
  designation: string | null;
  department: string | null;
  isActive: boolean;
  sortOrder: number;
};

export function StaffTable({
  initialStaff,
  isAdmin,
}: {
  initialStaff: Staff[];
  isAdmin: boolean;
}) {
  const [staff, setStaff] = useState<Staff[]>(initialStaff);
  const [showInactive, setShowInactive] = useState(false);
  const [editing, setEditing] = useState<Staff | null>(null);
  const [adding, setAdding] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkDepartment, setBulkDepartment] = useState("");
  const [applyingBulk, setApplyingBulk] = useState(false);
  const [, startTransition] = useTransition();

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } })
  );

  const visible = useMemo(
    () => staff.filter((s) => showInactive || s.isActive),
    [staff, showInactive]
  );

  async function loadStaff() {
    const res = await fetch(`/api/staff?includeInactive=1`);
    if (res.ok) setStaff(await res.json());
  }

  async function handleMarkLeft(s: Staff) {
    const next = !s.isActive;
    // optimistic
    setStaff((prev) =>
      prev.map((p) => (p.id === s.id ? { ...p, isActive: next } : p))
    );
    await fetch(`/api/staff/${s.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isActive: next }),
    });
  }

  async function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const activeIndexInVisible = visible.findIndex((s) => s.id === active.id);
    const overIndexInVisible = visible.findIndex((s) => s.id === over.id);
    if (activeIndexInVisible === -1 || overIndexInVisible === -1) return;

    const reorderedVisible = arrayMove(
      visible,
      activeIndexInVisible,
      overIndexInVisible
    );

    // Merge the reordered visible rows back into the full list, preserving
    // the relative position of any rows currently hidden (inactive, when
    // showInactive is off).
    const visibleIds = new Set(visible.map((s) => s.id));
    let cursor = 0;
    const merged = staff.map((s) =>
      visibleIds.has(s.id) ? reorderedVisible[cursor++] : s
    );

    setStaff(merged);

    startTransition(() => {
      fetch("/api/staff/reorder", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderedIds: merged.map((s) => s.id) }),
      });
    });
  }

  function toggleSelect(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleSelectAll() {
    setSelectedIds((prev) =>
      prev.size === visible.length ? new Set() : new Set(visible.map((s) => s.id))
    );
  }

  async function applyBulkDepartment() {
    if (!bulkDepartment.trim() || selectedIds.size === 0) return;
    setApplyingBulk(true);
    const ids = Array.from(selectedIds);
    await Promise.all(
      ids.map((id) =>
        fetch(`/api/staff/${id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ department: bulkDepartment.trim() }),
        })
      )
    );
    setStaff((prev) =>
      prev.map((s) =>
        selectedIds.has(s.id) ? { ...s, department: bulkDepartment.trim() } : s
      )
    );
    setApplyingBulk(false);
    setSelectedIds(new Set());
    setBulkDepartment("");
  }

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <label className="flex items-center gap-2 text-sm text-gray-600">
          <input
            type="checkbox"
            checked={showInactive}
            onChange={(e) => {
              setShowInactive(e.target.checked);
              if (e.target.checked) loadStaff();
            }}
          />
          Show staff who have left
        </label>

        {isAdmin && (
          <button
            onClick={() => setAdding(true)}
            className="rounded-md bg-gray-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-gray-800"
          >
            + Add staff
          </button>
        )}
      </div>

      {isAdmin && selectedIds.size > 0 && (
        <div className="mb-4 flex flex-wrap items-center gap-2 rounded-md border border-border bg-gray-50 px-3 py-2">
          <span className="text-sm text-gray-600">
            {selectedIds.size} selected
          </span>
          <input
            value={bulkDepartment}
            onChange={(e) => setBulkDepartment(e.target.value)}
            placeholder="Department, e.g. Ambulance"
            className="rounded-md border border-border px-2 py-1 text-sm"
          />
          <button
            onClick={applyBulkDepartment}
            disabled={applyingBulk || !bulkDepartment.trim()}
            className="rounded-md bg-gray-900 px-3 py-1 text-sm font-medium text-white hover:bg-gray-800 disabled:opacity-50"
          >
            {applyingBulk ? "Applying…" : "Set department"}
          </button>
          <button
            onClick={() => setSelectedIds(new Set())}
            className="text-sm text-gray-500 hover:text-gray-900"
          >
            Clear selection
          </button>
        </div>
      )}

      <div className="overflow-hidden rounded-xl border border-border bg-white">
        <div className="grid grid-cols-[24px_20px_1.5fr_1.5fr_1fr_auto] gap-2 border-b border-border bg-gray-50 px-4 py-2 text-xs font-medium uppercase tracking-wide text-gray-500">
          <div />
          {isAdmin ? (
            <input
              type="checkbox"
              checked={selectedIds.size > 0 && selectedIds.size === visible.length}
              onChange={toggleSelectAll}
            />
          ) : (
            <div />
          )}
          <div>Name</div>
          <div>Contact</div>
          <div>Role</div>
          <div className="text-right">Actions</div>
        </div>

        <DndContext
          id="staff-list"
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
        >
          <SortableContext
            items={visible.map((s) => s.id)}
            strategy={verticalListSortingStrategy}
          >
            {visible.map((s) => (
              <StaffRow
                key={s.id}
                staff={s}
                isAdmin={isAdmin}
                selected={selectedIds.has(s.id)}
                onToggleSelect={() => toggleSelect(s.id)}
                onEdit={() => setEditing(s)}
                onToggleLeft={() => handleMarkLeft(s)}
              />
            ))}
          </SortableContext>
        </DndContext>

        {visible.length === 0 && (
          <div className="px-4 py-8 text-center text-sm text-gray-400">
            No staff yet.
          </div>
        )}
      </div>

      {(adding || editing) && (
        <StaffFormModal
          staff={editing}
          onClose={() => {
            setAdding(false);
            setEditing(null);
          }}
          onSaved={(saved) => {
            setStaff((prev) => {
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

function StaffRow({
  staff,
  isAdmin,
  selected,
  onToggleSelect,
  onEdit,
  onToggleLeft,
}: {
  staff: Staff;
  isAdmin: boolean;
  selected: boolean;
  onToggleSelect: () => void;
  onEdit: () => void;
  onToggleLeft: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition } =
    useSortable({ id: staff.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`grid grid-cols-[24px_20px_1.5fr_1.5fr_1fr_auto] items-center gap-2 border-b border-border px-4 py-2.5 text-sm last:border-b-0 ${
        !staff.isActive ? "opacity-50" : ""
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
      {isAdmin ? (
        <input
          type="checkbox"
          checked={selected}
          onChange={onToggleSelect}
        />
      ) : (
        <div />
      )}
      <div className="font-medium">
        {staff.name}
        {!staff.isActive && (
          <span className="ml-2 rounded bg-gray-100 px-1.5 py-0.5 text-xs font-normal text-gray-500">
            Left
          </span>
        )}
      </div>
      <div className="text-gray-500">{staff.contactInfo || "—"}</div>
      <div className="text-gray-500">
        {staff.designation || "—"}
        {staff.department && (
          <div className="text-xs text-gray-400">{staff.department}</div>
        )}
      </div>
      <div className="flex justify-end gap-3">
        {isAdmin && (
          <>
            <button
              onClick={onEdit}
              className="text-gray-500 hover:text-gray-900"
            >
              Edit
            </button>
            <button
              onClick={onToggleLeft}
              className="text-gray-500 hover:text-gray-900"
            >
              {staff.isActive ? "Mark left" : "Reinstate"}
            </button>
          </>
        )}
      </div>
    </div>
  );
}

function StaffFormModal({
  staff,
  onClose,
  onSaved,
}: {
  staff: Staff | null;
  onClose: () => void;
  onSaved: (s: Staff) => void;
}) {
  const [name, setName] = useState(staff?.name ?? "");
  const [contactInfo, setContactInfo] = useState(staff?.contactInfo ?? "");
  const [designation, setDesignation] = useState(staff?.designation ?? "");
  const [department, setDepartment] = useState(staff?.department ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);

    const url = staff ? `/api/staff/${staff.id}` : "/api/staff";
    const method = staff ? "PATCH" : "POST";

    const res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, contactInfo, designation, department }),
    });

    setSaving(false);

    if (!res.ok) {
      setError("Couldn't save. Check the fields and try again.");
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
          {staff ? "Edit staff" : "Add staff"}
        </h2>

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
          <label className="text-sm font-medium">Contact info</label>
          <input
            value={contactInfo}
            onChange={(e) => setContactInfo(e.target.value)}
            placeholder="Phone or email"
            className="w-full rounded-md border border-border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-gray-900/10"
          />
        </div>

        <div className="space-y-1">
          <label className="text-sm font-medium">Role / designation</label>
          <input
            value={designation}
            onChange={(e) => setDesignation(e.target.value)}
            className="w-full rounded-md border border-border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-gray-900/10"
          />
        </div>

        <div className="space-y-1">
          <label className="text-sm font-medium">Department / team</label>
          <input
            value={department}
            onChange={(e) => setDepartment(e.target.value)}
            placeholder="e.g. Ambulance, Paramedics"
            className="w-full rounded-md border border-border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-gray-900/10"
          />
          <p className="text-xs text-gray-400">
            Controls which separate rota this person shows up on.
          </p>
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
            {saving ? "Saving…" : "Save"}
          </button>
        </div>
      </form>
    </div>
  );
}
