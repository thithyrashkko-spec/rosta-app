"use client";

import { useState } from "react";

export function SettingsForm({
  initialName,
  initialDepartmentUnit,
  initialLogoDataUrl,
}: {
  initialName: string;
  initialDepartmentUnit: string;
  initialLogoDataUrl: string | null;
}) {
  const [name, setName] = useState(initialName);
  const [departmentUnit, setDepartmentUnit] = useState(initialDepartmentUnit);
  const [logoDataUrl, setLogoDataUrl] = useState<string | null>(
    initialLogoDataUrl
  );
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  function handleLogoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    // Keep it small -- this is stored directly in the database as text.
    if (file.size > 500_000) {
      alert("Please choose an image smaller than 500KB.");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => setLogoDataUrl(reader.result as string);
    reader.readAsDataURL(file);
  }

  async function handleSave() {
    setSaving(true);
    setSaved(false);
    await fetch("/api/team", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, departmentUnit, logoDataUrl }),
    });
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  return (
    <div className="space-y-5 rounded-xl border border-border bg-white p-6">
      <div className="space-y-1">
        <label className="text-sm font-medium">Organization name</label>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. Indira Gandhi Memorial Hospital"
          className="w-full rounded-md border border-border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-gray-900/10"
        />
      </div>

      <div className="space-y-1">
        <label className="text-sm font-medium">Department / Unit</label>
        <input
          value={departmentUnit}
          onChange={(e) => setDepartmentUnit(e.target.value)}
          placeholder="e.g. Transport Unit / Department of Trauma & Emergency"
          className="w-full rounded-md border border-border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-gray-900/10"
        />
      </div>

      <div className="space-y-1">
        <label className="text-sm font-medium">Logo</label>
        <div className="flex items-center gap-3">
          {logoDataUrl && (
            <img
              src={logoDataUrl}
              alt="Logo preview"
              className="h-12 w-12 rounded object-contain"
            />
          )}
          <input
            type="file"
            accept="image/*"
            onChange={handleLogoChange}
            className="text-sm"
          />
          {logoDataUrl && (
            <button
              onClick={() => setLogoDataUrl(null)}
              className="text-xs text-gray-400 hover:text-gray-600"
            >
              Remove
            </button>
          )}
        </div>
        <p className="text-xs text-gray-400">PNG or JPG, under 500KB.</p>
      </div>

      <div className="flex items-center gap-3 pt-2">
        <button
          onClick={handleSave}
          disabled={saving}
          className="rounded-md bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-800 disabled:opacity-60"
        >
          {saving ? "Saving…" : "Save"}
        </button>
        {saved && <span className="text-sm text-green-600">Saved</span>}
      </div>
    </div>
  );
}
