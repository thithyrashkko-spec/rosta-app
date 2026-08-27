import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const importSchema = z.object({
  staff: z.array(
    z.object({ name: z.string().min(1), designation: z.string() })
  ),
  assignments: z.array(
    z.object({
      staffName: z.string().min(1),
      date: z.string(),
      code: z.string().min(1),
    })
  ),
});

const COLOR_PALETTE = [
  "#3b82f6",
  "#f59e0b",
  "#6366f1",
  "#10b981",
  "#ef4444",
  "#8b5cf6",
  "#06b6d4",
  "#84cc16",
  "#ec4899",
  "#64748b",
];

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if ((session.user as any).role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const teamId = (session.user as any).teamId as string;

  const body = await req.json();
  const parsed = importSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const warnings: string[] = [];

  // --- Staff: match by name (case-insensitive), else create ---
  const existingStaff = await prisma.staff.findMany({ where: { teamId } });
  const staffIdByName = new Map<string, string>();
  for (const s of existingStaff) staffIdByName.set(s.name.toLowerCase(), s.id);

  let staffCreated = 0;
  let staffMatched = 0;
  let nextSortOrder =
    existingStaff.reduce(
      (max: number, s: (typeof existingStaff)[number]) =>
        Math.max(max, s.sortOrder),
      -1
    ) + 1;

  for (const s of parsed.data.staff) {
    const key = s.name.toLowerCase();
    if (staffIdByName.has(key)) {
      staffMatched++;
      continue;
    }
    const created = await prisma.staff.create({
      data: {
        teamId,
        name: s.name,
        designation: s.designation,
        sortOrder: nextSortOrder++,
      },
    });
    staffIdByName.set(key, created.id);
    staffCreated++;
  }

  // --- Duty codes: match by existing code or name (case-insensitive), else create ---
  const existingDutyCodes = await prisma.dutyCode.findMany({
    where: { teamId },
  });
  const dutyCodeIdByKey = new Map<string, string>();
  for (const d of existingDutyCodes as (typeof existingDutyCodes)[number][]) {
    dutyCodeIdByKey.set(d.code.toLowerCase(), d.id);
    dutyCodeIdByKey.set(d.name.toLowerCase(), d.id);
  }
  const usedCodesLower = new Set(
    existingDutyCodes.map((d: (typeof existingDutyCodes)[number]) =>
      d.code.toLowerCase()
    )
  );

  let dutyCodesCreated = 0;
  let nextCodeSortOrder =
    existingDutyCodes.reduce(
      (max: number, d: (typeof existingDutyCodes)[number]) =>
        Math.max(max, d.sortOrder),
      -1
    ) + 1;
  let colorIndex = 0;

  const codeIdByRawText = new Map<string, string>();
  const distinctRawCodes = Array.from(
    new Set(parsed.data.assignments.map((a) => a.code))
  );

  for (const raw of distinctRawCodes) {
    const key = raw.toLowerCase();
    let id = dutyCodeIdByKey.get(key);
    if (!id) {
      let shortCode = raw.slice(0, 8).toUpperCase();
      let candidate = shortCode;
      let n = 1;
      while (usedCodesLower.has(candidate.toLowerCase())) {
        n++;
        candidate = `${shortCode.slice(0, 6)}${n}`;
      }
      const lower = raw.toLowerCase();
      const created = await prisma.dutyCode.create({
        data: {
          teamId,
          code: candidate,
          name: raw,
          color: COLOR_PALETTE[colorIndex++ % COLOR_PALETTE.length],
          category: raw,
          isWorkingDay: !(
            lower.includes("off") ||
            lower.includes("leave") ||
            lower.includes("release")
          ),
          isLeave: lower.includes("leave"),
          sortOrder: nextCodeSortOrder++,
        },
      });
      usedCodesLower.add(candidate.toLowerCase());
      dutyCodeIdByKey.set(key, created.id);
      id = created.id;
      dutyCodesCreated++;
    }
    if (!id) continue;
    codeIdByRawText.set(raw, id);
  }

  // --- Rota entries: upsert one per (staff, date) ---
  let entriesWritten = 0;
  for (const a of parsed.data.assignments) {
    const staffId = staffIdByName.get(a.staffName.toLowerCase());
    const dutyCodeId = codeIdByRawText.get(a.code);
    if (!staffId || !dutyCodeId) {
      warnings.push(`Skipped ${a.staffName} on ${a.date} (${a.code}).`);
      continue;
    }
    const date = new Date(a.date + "T00:00:00.000Z");
    try {
      await prisma.rotaEntry.upsert({
        where: { teamId_staffId_date: { teamId, staffId, date } },
        update: { dutyCodeId },
        create: { teamId, staffId, date, dutyCodeId },
      });
      entriesWritten++;
    } catch {
      warnings.push(`Couldn't save ${a.staffName} on ${a.date}.`);
    }
  }

  return NextResponse.json({
    staffCreated,
    staffMatched,
    dutyCodesCreated,
    entriesWritten,
    warnings,
  });
}