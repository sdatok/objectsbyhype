/**
 * Seeds dummy sell submissions for admin preview.
 * Run with: npm run seed:submissions
 */

import { PrismaClient } from "@prisma/client";
import * as fs from "fs";
import * as path from "path";

const envPath = path.join(process.cwd(), ".env");
if (fs.existsSync(envPath)) {
  const lines = fs.readFileSync(envPath, "utf-8").split("\n");
  for (const line of lines) {
    const [key, ...rest] = line.split("=");
    if (key && rest.length && !process.env[key.trim()]) {
      process.env[key.trim()] = rest.join("=").trim().replace(/^["']|["']$/g, "");
    }
  }
}

const prisma = new PrismaClient();

const submissions = [
  {
    name: "Marcus Thompson",
    email: "marcus.t@gmail.com",
    phone: "416-555-0192",
    itemName: "Arc'teryx Beta AR Jacket",
    brand: "Arc'teryx",
    description: "Size medium, Gore-Tex Pro shell in Pilot (dark navy). Worn maybe 5 times, no visible wear. Original tags and stuff sack included. Bought for $950 retail, looking to get reasonable offer.",
    askingPrice: 620,
    condition: "Like new",
    imageUrls: [],
    status: "PENDING" as const,
    adminNotes: null,
  },
  {
    name: "Priya Singh",
    email: "priyasingh94@hotmail.com",
    phone: null,
    itemName: "Supreme Box Logo Crewneck FW21",
    brand: "Supreme",
    description: "Black box logo crewneck from FW21 drop. Size large. Worn twice, washed once cold. No cracking on the logo. Have the receipt from the Supreme drop.",
    askingPrice: 380,
    condition: "Good",
    imageUrls: [],
    status: "REVIEWING" as const,
    adminNotes: "Checked StockX, current avg $340. Could offer $280 buy or list at $380 consign.",
  },
  {
    name: "Jordan Webb",
    email: "jordan.webb@outlook.com",
    phone: "778-555-0234",
    itemName: "Stone Island Shadow Project Hooded Jacket",
    brand: "Stone Island",
    description: "SS20 Stone Island Shadow Project, size XL. The one with the articulated sleeve. Paid $1100 USD. A small mark on the inner lining not visible when worn, priced accordingly. No badge issues.",
    askingPrice: 550,
    condition: "Good",
    imageUrls: [],
    status: "ACCEPTED_CONSIGN" as const,
    adminNotes: "Listed at $650. Agreed 70/30 split. Item dropping off Friday.",
  },
  {
    name: "Camille Roy",
    email: "camille.roy22@gmail.com",
    phone: "514-555-0871",
    itemName: "Fear of God Essentials Hoodie 'Oatmeal'",
    brand: "Fear of God",
    description: "FOG Essentials pullover hoodie in oatmeal. Season 7. Size small. No pilling, logo still clean. Comes with original bag.",
    askingPrice: 120,
    condition: "Like new",
    imageUrls: [],
    status: "DECLINED" as const,
    adminNotes: "Too common; FOG Essentials move slow. Passed.",
  },
  {
    name: "Ethan Kowalski",
    email: "ethan.kow@icloud.com",
    phone: null,
    itemName: "Stüssy x Nike Air Max 2013 'Brown'",
    brand: "Stüssy",
    description: "DS (deadstock) Stussy x Nike collab. Size 10. Never worn, kept in box with all laces and extra insoles. Box has minor shelf wear. Original receipt from SNKRS app included.",
    askingPrice: 900,
    condition: "New with tags",
    imageUrls: [],
    status: "PENDING" as const,
    adminNotes: null,
  },
];

async function main() {
  console.log("Seeding dummy submissions...\n");

  for (const sub of submissions) {
    const existing = await prisma.submission.findFirst({
      where: { email: sub.email, itemName: sub.itemName },
    });

    if (existing) {
      console.log(`  ⚠  Skipped (exists): ${sub.name} · ${sub.itemName}`);
      continue;
    }

    await prisma.submission.create({ data: sub });
    console.log(`  ✓  Created: ${sub.name} · ${sub.itemName} (${sub.status})`);
  }

  await prisma.$disconnect();
  console.log("\nDone. Check http://localhost:3000/admin/submissions");
}

main().catch((err) => {
  console.error("Failed:", err.message);
  process.exit(1);
});
