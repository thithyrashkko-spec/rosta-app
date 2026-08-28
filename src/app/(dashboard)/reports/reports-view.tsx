"use client";

import { useEffect, useMemo, useState } from "react";
import { format, startOfMonth, endOfMonth } from "date-fns";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
} from "recharts";

type StaffAgg = {
  staffId: string;
  staffName: string;
  isActive: boolean;
  byDuty: Record<string, number>;
  leaveDays: number;
  nonOfficialWorkedDays: number;
};

type ReportData = {
  staffRows: StaffAgg[];
  dutyTotals: { name: string; total: number }[];
  leaveBreakdown: { name: string; total: number }[];
};

const PIE_COLORS = [
  "#3b82f6",
  "#f59e0b",
  "#6366f1",
  "#10b981",
  "#ef4444",
  "#8b5cf6",
  "#06b6d4",
];

export function ReportsView() {
  const [start, setStart] = useState(() =>
    format(startOfMonth(new Date()), "yyyy-MM-dd")
  );
  const [end, setEnd] = useState(() =>
    format(endOfMonth(new Date()), "yyyy-MM-dd")
  );
  const [data, setData] = useState<ReportData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    fetch(`/api/reports?start=${start}&end=${end}`)
      .then((r) => r.json())
      .then(setData)
      .finally(() => setLoading(false));
  }, [start, end]);

  const dutyColumns = useMemo(() => {
    if (!data) return [];
    const names = new Set<string>();
    for (const row of data.staffRows) {
      for (const name of Object.keys(row.byDuty)) names.add(name);
    }
    return Array.from(names).sort();
  }, [data]);

  const dutiesPerStaffChart = useMemo(
    () =>
      data?.staffRows.map((r) => ({
        name: r.staffName,
        total: Object.values(r.byDuty).reduce((a, b) => a + b, 0),
      })) ?? [],
    [data]
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end gap-3 rounded-xl border border-border bg-white p-4">
        <div className="space-y-1">
          <label className="text-xs font-medium text-gray-500">From</label>
          <input
            type="date"
            value={start}
            onChange={(e) => setStart(e.target.value)}
            className="rounded-md border border-border px-3 py-2 text-sm"
          />
        </div>
        <div className="space-y-1">
          <label className="text-xs font-medium text-gray-500">To</label>
          <input
            type="date"
            value={end}
            onChange={(e) => setEnd(e.target.value)}
            className="rounded-md border border-border px-3 py-2 text-sm"
          />
        </div>
        {loading && <span className="text-xs text-gray-400">Loading…</span>}
      </div>

      <div className="overflow-x-auto rounded-xl border border-border bg-white">
        <table className="min-w-full border-collapse text-sm">
          <thead>
            <tr className="bg-gray-50">
              <th className="border-b border-border px-3 py-2 text-left font-medium text-gray-600">
                Staff
              </th>
              {dutyColumns.map((name) => (
                <th
                  key={name}
                  className="border-b border-border px-3 py-2 text-center font-medium text-gray-600"
                >
                  {name}
                </th>
              ))}
              <th className="border-b border-border px-3 py-2 text-center font-medium text-gray-600">
                Leave days
              </th>
              <th className="border-b border-border px-3 py-2 text-center font-medium text-gray-600">
                Non-official days worked
              </th>
            </tr>
          </thead>
          <tbody>
            {data?.staffRows.map((row) => (
              <tr key={row.staffId}>
                <td className="border-b border-border px-3 py-2 font-medium">
                  {row.staffName}
                  {!row.isActive && (
                    <span className="ml-2 rounded bg-gray-100 px-1.5 py-0.5 text-xs font-normal text-gray-500">
                      Left
                    </span>
                  )}
                </td>
                {dutyColumns.map((name) => (
                  <td
                    key={name}
                    className="border-b border-border px-3 py-2 text-center text-gray-600"
                  >
                    {row.byDuty[name] ?? 0}
                  </td>
                ))}
                <td className="border-b border-border px-3 py-2 text-center text-gray-600">
                  {row.leaveDays}
                </td>
                <td className="border-b border-border px-3 py-2 text-center text-gray-600">
                  {row.nonOfficialWorkedDays}
                </td>
              </tr>
            ))}
            {data && data.staffRows.length === 0 && (
              <tr>
                <td
                  colSpan={dutyColumns.length + 3}
                  className="px-3 py-8 text-center text-gray-400"
                >
                  No rota activity in this range.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <div className="rounded-xl border border-border bg-white p-4">
          <h2 className="mb-2 text-sm font-semibold text-gray-700">
            Duties per staff
          </h2>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={dutiesPerStaffChart}>
                <XAxis
                  dataKey="name"
                  tick={{ fontSize: 11 }}
                  interval={0}
                  angle={-30}
                  textAnchor="end"
                  height={60}
                />
                <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                <Tooltip />
                <Bar dataKey="total" fill="#3b82f6" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="rounded-xl border border-border bg-white p-4">
          <h2 className="mb-2 text-sm font-semibold text-gray-700">
            Leave breakdown
          </h2>
          <div className="h-64">
            {data && data.leaveBreakdown.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={data.leaveBreakdown}
                    dataKey="total"
                    nameKey="name"
                    outerRadius={80}
                    label={(entry) => `${entry.name}: ${entry.total}`}
                  >
                    {data.leaveBreakdown.map((_, i) => (
                      <Cell
                        key={i}
                        fill={PIE_COLORS[i % PIE_COLORS.length]}
                      />
                    ))}
                  </Pie>
                  <Legend />
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex h-full items-center justify-center text-sm text-gray-400">
                No leave in this range.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
