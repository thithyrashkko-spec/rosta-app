import { prisma } from "@/lib/prisma";

/**
 * Returns the set of dates (YYYY-MM-DD strings) within [start, end] that
 * count as "non-official" for a team: driven by a per-weekday rule (e.g.
 * "every Friday"), with per-date overrides taking precedence.
 */
export async function getNonOfficialDates(
  teamId: string,
  start: Date,
  end: Date
): Promise<Set<string>> {
  const [rules, overrides] = await Promise.all([
    prisma.nonOfficialDayRule.findMany({ where: { teamId, enabled: true } }),
    prisma.nonOfficialDayOverride.findMany({
      where: { teamId, date: { gte: start, lte: end } },
    }),
  ]);

  const ruleWeekdays = new Set(rules.map((r: { weekday: number }) => r.weekday));
  const overrideMap = new Map(
    overrides.map((o: { date: Date; isNonOfficial: boolean }) => [
      toDateKey(o.date),
      o.isNonOfficial,
    ])
  );

  const result = new Set<string>();
  for (
    let d = new Date(start);
    d <= end;
    d.setDate(d.getDate() + 1)
  ) {
    const key = toDateKey(d);
    const override = overrideMap.get(key);
    const isNonOfficial =
      override !== undefined ? override : ruleWeekdays.has(d.getDay());
    if (isNonOfficial) result.add(key);
  }

  return result;
}

export function toDateKey(d: Date): string {
  return d.toISOString().slice(0, 10);
}
