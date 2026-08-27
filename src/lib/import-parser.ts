import * as XLSX from "xlsx";
import { format } from "date-fns";

export type ParsedStaff = { name: string; designation: string };
export type ParsedAssignment = { staffName: string; date: string; code: string };
export type ParsedImport = {
  staff: ParsedStaff[];
  assignments: ParsedAssignment[];
  dateColumns: string[];
  warnings: string[];
};

/**
 * Best-effort parser for a sheet laid out like: a row containing "SNO" in
 * some column, followed immediately (same row) by Designation, Name, RC No,
 * then one column per day; the row directly below holds the actual dates.
 * Staff rows follow below that. A row where exactly one day cell has a
 * multi-word phrase (e.g. "ANNUAL LEAVE") is treated as filling that duty
 * across every visible date for that staff member -- matching how merged
 * cells read back from Excel.
 *
 * This is intentionally forgiving rather than strict: unexpected layouts
 * produce warnings instead of throwing, so partial results are still usable.
 */
export function parseRosterSheet(
  workbook: XLSX.WorkBook,
  sheetName: string
): ParsedImport {
  const warnings: string[] = [];
  const sheet = workbook.Sheets[sheetName];
  if (!sheet) {
    return {
      staff: [],
      assignments: [],
      dateColumns: [],
      warnings: [`Sheet "${sheetName}" not found in the workbook.`],
    };
  }

  const rows: any[][] = XLSX.utils.sheet_to_json(sheet, {
    header: 1,
    raw: true,
    defval: "",
  });

  let headerRowIdx = -1;
  let snoCol = -1;
  for (let r = 0; r < rows.length && headerRowIdx === -1; r++) {
    for (let c = 0; c < (rows[r]?.length ?? 0); c++) {
      const val = String(rows[r][c] ?? "")
        .trim()
        .toLowerCase()
        .replace(/\./g, "")
        .replace(/\s/g, "");
      if (val === "sno" || val === "sno") {
        headerRowIdx = r;
        snoCol = c;
        break;
      }
    }
  }

  if (headerRowIdx === -1) {
    return {
      staff: [],
      assignments: [],
      dateColumns: [],
      warnings: [
        'Could not find a header row containing "SNO". Expected column order: SNO, Designation, Name, RC No, then one column per day.',
      ],
    };
  }

  const designationCol = snoCol + 1;
  const nameCol = snoCol + 2;
  const firstDayCol = snoCol + 4;

  const dateRowIdx = headerRowIdx + 1;
  const dateRow = rows[dateRowIdx] ?? [];
  const headerRow = rows[headerRowIdx] ?? [];
  const lastCol = Math.max(dateRow.length, headerRow.length);

  const dayColumns: { col: number; date: string }[] = [];
  for (let c = firstDayCol; c < lastCol; c++) {
    const raw = dateRow[c];
    let dateStr: string | null = null;
    if (raw instanceof Date && !isNaN(raw.getTime())) {
      dateStr = format(raw, "yyyy-MM-dd");
    } else if (typeof raw === "string" && raw.trim()) {
      const parsed = new Date(raw.trim());
      if (!isNaN(parsed.getTime())) dateStr = format(parsed, "yyyy-MM-dd");
    }
    if (dateStr) dayColumns.push({ col: c, date: dateStr });
  }

  if (dayColumns.length === 0) {
    warnings.push(
      "No dates found in the row directly below the headers -- expected actual dates there (e.g. 23-Aug-26)."
    );
  }

  const staffMap = new Map<string, ParsedStaff>();
  const assignments: ParsedAssignment[] = [];

  let blankStreak = 0;
  for (let r = dateRowIdx + 1; r < rows.length; r++) {
    const row = rows[r] ?? [];
    const designation = String(row[designationCol] ?? "").trim();
    const name = String(row[nameCol] ?? "").trim();

    const rowIsBlank =
      !designation &&
      !name &&
      dayColumns.every(({ col }) => !String(row[col] ?? "").trim());

    if (rowIsBlank) {
      blankStreak++;
      if (blankStreak >= 3) break;
      continue;
    }
    blankStreak = 0;

    // Section banner rows (e.g. "AMBULANCE DRIVERS") have no name -- skip;
    // each staff row's own Designation column already labels their role.
    if (!name) continue;

    const key = name.toLowerCase();
    if (!staffMap.has(key)) {
      staffMap.set(key, { name, designation: designation || "Staff" });
    }

    const filledDayCells = dayColumns
      .map(({ col, date }) => ({ date, text: String(row[col] ?? "").trim() }))
      .filter((c) => c.text);

    const isFullWeekPhrase =
      filledDayCells.length === 1 && filledDayCells[0].text.includes(" ");

    if (isFullWeekPhrase) {
      const code = filledDayCells[0].text;
      for (const { date } of dayColumns) {
        assignments.push({ staffName: name, date, code });
      }
      continue;
    }

    for (const { col, date } of dayColumns) {
      const code = String(row[col] ?? "").trim();
      if (!code) continue;
      assignments.push({ staffName: name, date, code });
    }
  }

  return {
    staff: Array.from(staffMap.values()),
    assignments,
    dateColumns: dayColumns.map((d) => d.date),
    warnings,
  };
}