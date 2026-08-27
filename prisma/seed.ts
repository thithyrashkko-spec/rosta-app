import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  const teamName = process.env.SEED_TEAM_NAME || "My Team";
  const adminEmail = process.env.SEED_ADMIN_EMAIL || "admin@example.com";
  const adminPassword = process.env.SEED_ADMIN_PASSWORD || "changeme123";
  const adminName = process.env.SEED_ADMIN_NAME || "Admin";

  const team = await prisma.team.upsert({
    where: { id: "seed-team" },
    update: {},
    create: { id: "seed-team", name: teamName },
  });

  const passwordHash = await bcrypt.hash(adminPassword, 10);

  await prisma.user.upsert({
    where: { email: adminEmail },
    update: {},
    create: {
      teamId: team.id,
      email: adminEmail,
      passwordHash,
      name: adminName,
      role: "ADMIN",
    },
  });

  // A starter set of duty codes so the rota grid isn't empty on day one.
  const existingCodes = await prisma.dutyCode.count({
    where: { teamId: team.id },
  });

  if (existingCodes === 0) {
    await prisma.dutyCode.createMany({
      data: [
        {
          teamId: team.id,
          code: "M",
          name: "Morning",
          color: "#3b82f6",
          category: "Morning",
          isWorkingDay: true,
          isLeave: false,
          sortOrder: 0,
        },
        {
          teamId: team.id,
          code: "A",
          name: "Afternoon",
          color: "#f59e0b",
          category: "Afternoon",
          isWorkingDay: true,
          isLeave: false,
          sortOrder: 1,
        },
        {
          teamId: team.id,
          code: "N",
          name: "Night",
          color: "#6366f1",
          category: "Night",
          isWorkingDay: true,
          isLeave: false,
          sortOrder: 2,
        },
        {
          teamId: team.id,
          code: "O",
          name: "Off",
          color: "#9ca3af",
          category: "Off",
          isWorkingDay: false,
          isLeave: false,
          sortOrder: 3,
        },
        {
          teamId: team.id,
          code: "AL",
          name: "Annual Leave",
          color: "#10b981",
          category: "Annual Leave",
          isWorkingDay: false,
          isLeave: true,
          sortOrder: 4,
        },
        {
          teamId: team.id,
          code: "SL",
          name: "Sick Leave",
          color: "#ef4444",
          category: "Sick Leave",
          isWorkingDay: false,
          isLeave: true,
          sortOrder: 5,
        },
        {
          teamId: team.id,
          code: "M(VC)",
          name: "Morning (Vehicle Check)",
          color: "#dc2626",
          category: "Morning",
          isWorkingDay: true,
          isLeave: false,
          sortOrder: 6,
        },
        {
          teamId: team.id,
          code: "A(VC)",
          name: "Afternoon (Vehicle Check)",
          color: "#dc2626",
          category: "Afternoon",
          isWorkingDay: true,
          isLeave: false,
          sortOrder: 7,
        },
        {
          teamId: team.id,
          code: "N(VC)",
          name: "Night (Vehicle Check)",
          color: "#16a34a",
          category: "Night",
          isWorkingDay: true,
          isLeave: false,
          sortOrder: 8,
        },
        {
          teamId: team.id,
          code: "RGT",
          name: "Released to General Transport",
          color: "#64748b",
          category: "Reassigned",
          isWorkingDay: false,
          isLeave: false,
          sortOrder: 9,
        },
      ],
    });
  }

  // Default non-official day rule: Fridays.
  await prisma.nonOfficialDayRule.upsert({
    where: { teamId_weekday: { teamId: team.id, weekday: 5 } },
    update: {},
    create: { teamId: team.id, weekday: 5, enabled: true },
  });

  console.log(`Seeded team "${team.name}".`);
  console.log(`Admin login: ${adminEmail} / ${adminPassword}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
