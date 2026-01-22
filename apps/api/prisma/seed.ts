import dotenv from "dotenv";
dotenv.config({ path: "./.env" });

import { PrismaClient, Role, BidStatus, LineStatus } from "@prisma/client";
import { PrismaMariaDb } from "@prisma/adapter-mariadb";
import mariadb from "mariadb";

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) throw new Error("DATABASE_URL is not set in apps/api/.env");

const u = new URL(DATABASE_URL);

const user = decodeURIComponent(u.username || "");
const password = decodeURIComponent(u.password || "");
const host = u.hostname || "localhost";
const port = u.port ? Number(u.port) : 3306;
const database = (u.pathname || "").replace(/^\//, "");

if (!user || !database) {
  throw new Error(
    `DATABASE_URL missing user or database. Got user='${user}', database='${database}'`
  );
}

// mariaDB driver expects options object; this works against MySQL too.
const pool = mariadb.createPool({
  host,
  port,
  user,
  password,
  database,
  connectionLimit: 10,
});

const adapter = new PrismaMariaDb(pool);
const prisma = new PrismaClient({ adapter });

function addDays(date: Date, days: number) {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

async function main() {
  const OFFICERS = 20;
  const LINES = 30;

  await prisma.auditLog.deleteMany();
  await prisma.shiftLine.deleteMany();
  await prisma.bidParticipant.deleteMany();
  await prisma.bidState.deleteMany();
  await prisma.bid.deleteMany();
  await prisma.user.deleteMany();

  const baseHire = new Date("2010-01-01T00:00:00.000Z");

  const createdUsers = [];
  for (let i = 1; i <= OFFICERS; i++) {
    const employeeId = String(2978340 + i); // 2978341..2978360
    const role = i === 1 ? Role.UNION_ADMIN : Role.BIDDER;

    const userRow = await prisma.user.create({
      data: {
        employeeId,
        name: i === 1 ? "Sanyam Singh" : `Officer ${i}`,
        hireDate: addDays(baseHire, i - 1), // earlier = more senior
        role,
      },
    });

    createdUsers.push(userRow);
  }

  const bid = await prisma.bid.create({
    data: {
      name: "Demo Bid - 20 Officers / 30 Lines",
      status: BidStatus.OPEN,
      openedAt: new Date(),
    },
  });

  const ranked = [...createdUsers].sort(
    (a, b) => a.hireDate.getTime() - b.hireDate.getTime()
  );

  for (let idx = 0; idx < ranked.length; idx++) {
    await prisma.bidParticipant.create({
      data: {
        bidId: bid.id,
        userId: ranked[idx].id,
        rank: idx + 1,
      },
    });
  }

  await prisma.bidState.create({
    data: { bidId: bid.id, currentRank: 1 },
  });

  const timePairs: Array<[string, string]> = [
    ["0300", "1100"],
    ["0500", "1300"],
    ["0700", "1500"],
    ["0900", "1700"],
    ["1100", "1900"],
    ["1300", "2100"],
    ["1500", "2300"],
    ["1700", "0100"],
  ];
  const daysOffOptions = ["Mon/Tue", "Tue/Wed", "Wed/Thu", "Thu/Fri", "Fri/Sat", "Sat/Sun", "Sun/Mon"];
  const locations = ["T1", "T2", "T3"];

  for (let i = 0; i < LINES; i++) {
    const lineId = 101 + i; // 101..130 (includes 102)
    const [timeStart, timeEnd] = timePairs[i % timePairs.length];
    const daysOff = daysOffOptions[i % daysOffOptions.length];
    const location = locations[i % locations.length];

    await prisma.shiftLine.create({
      data: {
        bidId: bid.id,
        lineId,
        timeStart,
        timeEnd,
        daysOff,
        location,
        status: LineStatus.OPEN,
      },
    });
  }

  await prisma.auditLog.create({
    data: {
      bidId: bid.id,
      actorId: ranked[0]?.id,
      action: "SEED_DEMO",
      details: { officers: OFFICERS, lines: LINES, seniority: "hireDate", round: 1, pickPerUser: 1 },
    },
  });

  console.log("✅ Seed complete");
  console.log("Bid ID:", bid.id);
  console.log("Admin employeeId:", "2978341");
  console.log("Bidders:", "2978342 ... 2978360");
  console.log("Shift lines:", "101..130 (LineID 102 exists)");
}

main()
  .catch((e) => {
    console.error("❌ Seed failed:", e);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });
