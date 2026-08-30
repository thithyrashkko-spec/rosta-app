"use client";

import { useMemo, useState } from "react";
import {
  format,
  startOfMonth,
  endOfMonth,
  eachDayOfInterval,
  addMonths,
  getDate,
  max as dateMax,
  min as dateMin,
} from "date-fns";

type Period = {
  id: string;
  staffId: string;
  staffName: string;
  dutyCodeName: string;
  startDate: string;
  endDate: string;
};

const BAR_COLORS = [
  "#3b82f6",
  "#f59e0b",
  "#8b5cf6",
  "#10b981",
  "#ef4444",
  "#06b6d4",
  "#ec4899",
  "#84cc16",
  "#6366f1",
  "#64748b",
];

export function LeaveCalendar({ periods }: { periods: Period[] }) {
  const [anchor, setAnchor] = useState(() => new Date());

  const monthStart = startOfMonth(anchor);
  const monthEnd = endOfMonth(anchor);
  const days = useMemo(
    () => eachDayOfInterval({ start: monthStart, end: monthEnd }),
    [monthStart, monthEnd]
  );

  // Stable color per staff member so the same person always gets the same
  // bar color across months.
  const colorByStaff = useMemo(() => {
    const map = new Map<string, string>();
    let i = 0;
    for (const p of periods) {
      if (!map.has(p.staffId)) {
        map.set(p.staffId, BAR_COLORS[i % BAR_COLORS.length]);
        i++;
      }
    }
    return map;
  }, [periods]);

  const rowsInMonth = useMemo(() => {
    return periods
      .map((p) => {
        const start = new Date(p.startDate + "T00:00:00.000Z");
        const end = new Date(p.endDate + "T00:00:00.000Z");
        if (end < monthStart || start > monthEnd) return null;
        const clippedStart = dateMax([start, monthStart]);
        const clippedEnd = dateMin([end, monthEnd]);
        return {
          period: p,
          startCol: getDate(clippedStart),
          endCol: getDate(clippedEnd),
        };
      })
      .filter((r): r is NonNullable<typeof r> => r !== null);
  }, [periods, monthStart, monthEnd]);

  const gridTemplate = `repeat(${days.length}, minmax(26px, 1fr))`;

  return (
    <div className="rounded-xl border border-border bg-white p-4">
      <div className="mb-3 flex items-center gap-2">
        <button
          onClick={() => setAnchor(addMonths(anchor, -1))}
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
          onClick={() => setAnchor(addMonths(anchor, 1))}
          className="rounded-md border border-border bg-white px-2.5 py-1.5 text-sm hover:bg-gray-50"
        >
          Next →
        </button>
        <span className="ml-2 text-sm font-medium text-gray-700">
          {format(anchor, "MMMM yyyy")}
        </span>
      </div>

      <div className="overflow-x-auto">
        <div style={{ minWidth: days.length * 28 }}>
          <div
            className="grid gap-px"
            style={{ gridTemplateColumns: gridTemplate }}
          >
            {days.map((d) => (
              <div
                key={`num-${d.toISOString()}`}
                className="bg-gray-50 py-1 text-center text-[11px] font-medium text-gray-600"
              >
                {getDate(d)}
              </div>
            ))}
          </div>
          <div
            className="grid gap-px"
            style={{ gridTemplateColumns: gridTemplate }}
          >
            {days.map((d) => (
              <div
                key={`day-${d.toISOString()}`}
                className="bg-gray-50 pb-1 text-center text-[10px] text-gray-400"
              >
                {format(d, "EEE").slice(0, 1)}
              </div>
            ))}
          </div>

          <div className="mt-1 space-y-1">
            {rowsInMonth.map(({ period, startCol, endCol }) => (
              <div
                key={period.id}
                className="grid gap-px"
                style={{ gridTemplateColumns: gridTemplate }}
              >
                <div
                  className="flex items-center justify-center overflow-hidden truncate rounded px-1 py-1 text-[11px] font-semibold text-white"
                  style={{
                    gridColumn: `${startCol} / ${endCol + 1}`,
                    backgroundColor: colorByStaff.get(period.staffId),
                  }}
                  title={`${period.staffName} — ${period.dutyCodeName}`}
                >
                  {period.staffName}
                </div>
              </div>
            ))}
          </div>

          {rowsInMonth.length === 0 && (
            <div className="py-8 text-center text-sm text-gray-400">
              No leave in this month.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
