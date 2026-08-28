import { ReportsView } from "./reports-view";

export default function ReportsPage() {
  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-semibold">Reports</h1>
        <p className="text-sm text-gray-500">
          Totals per person over a date range, plus a couple of charts.
        </p>
      </div>

      <ReportsView />
    </div>
  );
}
