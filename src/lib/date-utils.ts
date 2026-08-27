import {
  startOfWeek,
  endOfWeek,
  addWeeks,
  addMonths,
  startOfMonth,
  endOfMonth,
  eachDayOfInterval,
  format,
} from "date-fns";

export type ViewMode = "week" | "month";

export function getVisibleDates(anchor: Date, mode: ViewMode): Date[] {
  if (mode === "week") {
    const start = startOfWeek(anchor, { weekStartsOn: 0 });
    const end = endOfWeek(anchor, { weekStartsOn: 0 });
    return eachDayOfInterval({ start, end });
  }
  const start = startOfMonth(anchor);
  const end = endOfMonth(anchor);
  return eachDayOfInterval({ start, end });
}

export function shiftAnchor(
  anchor: Date,
  mode: ViewMode,
  direction: 1 | -1
): Date {
  return mode === "week"
    ? addWeeks(anchor, direction)
    : addMonths(anchor, direction);
}

export function dateKey(d: Date): string {
  return format(d, "yyyy-MM-dd");
}

export function dayLabel(d: Date): string {
  return format(d, "EEE");
}

export function dateLabel(d: Date): string {
  return format(d, "d MMM");
}

export function rangeLabel(dates: Date[], mode: ViewMode): string {
  if (dates.length === 0) return "";
  if (mode === "month") return format(dates[0], "MMMM yyyy");
  return `${format(dates[0], "d MMM")} – ${format(
    dates[dates.length - 1],
    "d MMM yyyy"
  )}`;
}
