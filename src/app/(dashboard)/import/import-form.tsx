"use client";

import { useState } from "react";
import * as XLSX from "xlsx";
import {
  parseRosterSheet,
  type ParsedImport,
} from "@/lib/import-parser";

export function ImportForm() {
  const [workbook, setWorkbook] = useState<XLSX.WorkBook | null>(null);
  const [sheetNames, setSheetNames] = useState<string[]>([]);
  const [selectedSheet, setSelectedSheet] = useState("");
  const [preview, setPreview] = useState<ParsedImport | null>(null);
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<{
    staffCreated: number;
    staffMatched: number;
    dutyCodesCreated: number;
    entriesWritten: number;
    warnings: string[];
  } | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setError(null);
    setResult(null);
    setPreview(null);

    try {
      const buf = await file.arrayBuffer();
      const wb = XLSX.read(buf, { type: "array", cellDates: true });
      setWorkbook(wb);
      setSheetNames(wb.SheetNames);
      setSelectedSheet(wb.SheetNames[0] ?? "");
    } catch {
      setError("Couldn't read that file. Make sure it's a .xlsx file.");
    }
  }

  function handlePreview() {
    if (!workbook || !selectedSheet) return;
    const parsed = parseRosterSheet(workbook, selectedSheet);
    setPreview(parsed);
    setResult(null);
  }

  async function handleImport() {
    if (!preview) return;
    setImporting(true);
    setError(null);
    try {
      const res = await fetch("/api/import/rota", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          staff: preview.staff,
          assignments: preview.assignments,
        }),
      });
      if (!res.ok) {
        setError("Import failed. Try again, or check the file format.");
        return;
      }
      setResult(await res.json());
      setPreview(null);
    } finally {
      setImporting(false);
    }
  }

  return (
    <div className="space-y-5">
      <div className="rounded-xl border border-border bg-white p-6">
        <label className="text-sm font-medium">Excel file</label>
        <input
          type="file"
          accept=".xlsx,.xls"
          onChange={handleFile}
          className="mt-2 block text-sm"
        />

        {sheetNames.length > 0 && (
          <div className="mt-4 space-y-1">
            <label className="text-sm font-medium">Sheet / tab</label>
            <select
              value={selectedSheet}
              onChange={(e) => setSelectedSheet(e.target.value)}
              className="w-full rounded-md border border-border px-3 py-2 text-sm"
            >
              {sheetNames.map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
            <p className="text-xs text-gray-400">
              Your workbook has multiple week tabs — pick the one you want to
              import. Import one week at a time.
            </p>
          </div>
        )}

        {sheetNames.length > 0 && (
          <button
            onClick={handlePreview}
            className="mt-4 rounded-md bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-800"
          >
            Preview
          </button>
        )}

        {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
      </div>

      {preview && (
        <div className="rounded-xl border border-border bg-white p-6">
          <h2 className="mb-3 text-sm font-semibold">Preview</h2>

          {preview.warnings.length > 0 && (
            <div className="mb-4 rounded-md bg-amber-50 p-3 text-sm text-amber-800">
              {preview.warnings.map((w, i) => (
                <div key={i}>{w}</div>
              ))}
            </div>
          )}

          <div className="grid grid-cols-3 gap-4 text-sm">
            <div>
              <div className="text-gray-400">Staff found</div>
              <div className="text-lg font-semibold">
                {preview.staff.length}
              </div>
            </div>
            <div>
              <div className="text-gray-400">Dates found</div>
              <div className="text-lg font-semibold">
                {preview.dateColumns.length}
              </div>
            </div>
            <div>
              <div className="text-gray-400">Assignments found</div>
              <div className="text-lg font-semibold">
                {preview.assignments.length}
              </div>
            </div>
          </div>

          {preview.dateColumns.length > 0 && (
            <p className="mt-3 text-xs text-gray-500">
              Date range: {preview.dateColumns[0]} to{" "}
              {preview.dateColumns[preview.dateColumns.length - 1]}
            </p>
          )}

          {preview.staff.length > 0 && (
            <div className="mt-4">
              <div className="mb-1 text-xs font-medium text-gray-500">
                Staff detected
              </div>
              <div className="flex flex-wrap gap-1.5">
                {preview.staff.map((s) => (
                  <span
                    key={s.name}
                    className="rounded bg-gray-100 px-2 py-1 text-xs text-gray-700"
                  >
                    {s.name} — {s.designation}
                  </span>
                ))}
              </div>
            </div>
          )}

          {preview.staff.length > 0 && preview.dateColumns.length > 0 && (
            <button
              onClick={handleImport}
              disabled={importing}
              className="mt-5 rounded-md bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-800 disabled:opacity-60"
            >
              {importing ? "Importing…" : "Confirm import"}
            </button>
          )}
        </div>
      )}

      {result && (
        <div className="rounded-xl border border-border bg-white p-6">
          <h2 className="mb-3 text-sm font-semibold">Import complete</h2>
          <ul className="space-y-1 text-sm text-gray-700">
            <li>{result.staffMatched} existing staff matched</li>
            <li>{result.staffCreated} new staff created</li>
            <li>{result.dutyCodesCreated} new duty codes created</li>
            <li>{result.entriesWritten} rota entries saved</li>
          </ul>
          {result.warnings.length > 0 && (
            <div className="mt-3 rounded-md bg-amber-50 p-3 text-xs text-amber-800">
              {result.warnings.map((w, i) => (
                <div key={i}>{w}</div>
              ))}
            </div>
          )}
          <p className="mt-4 text-sm text-gray-500">
            Go check the Rota page to review what came in.
          </p>
        </div>
      )}
    </div>
  );
}