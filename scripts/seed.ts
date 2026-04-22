/**
 * Seed script: inserts initial Objectsbyhype furniture products.
 * Run with: npm run seed
 *
 * Images are served from /public/products/ as static files.
 * When you set up Vercel Blob later, re-upload the images via the admin panel
 * and update the URLs to Blob URLs.
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
      process.env[key.trim()] = rest
        .join("=")
        .trim()
        .replace(/^["']|["']$/g, "");
    }
  }
}

const prisma = new PrismaClient();

const products = [
  {
    slug: "cloudline-boucle-accent-chair-ivory",
    name: "Cloudline Boucle Accent Chair - Ivory",
    brand: "Ligne Roset",
    description:
      "Soft boucle accent chair with sculpted arms and deep seating. Built for lounge corners and statement living rooms.",
    price: 1290,
    category: "Chairs",
    status: "ACTIVE" as const,
    sizes: ["One Size"],
    images: [{ url: "/products/valepink.jpg", displayOrder: 0 }],
  },
  {
    slug: "nova-arched-floor-lamp-brushed-chrome",
    name: "Nova Arched Floor Lamp - Brushed Chrome",
    brand: "Flos",
    description:
      "Minimal arched floor lamp with weighted marble base and dimmable warm light. Ideal for reading nooks and lounge seating.",
    price: 860,
    category: "Lamps",
    status: "ACTIVE" as const,
    sizes: ["Floor"],
    images: [
      { url: "/products/valedreams.jpg", displayOrder: 0 },
      { url: "/products/valedreamsback.jpg", displayOrder: 1 },
    ],
  },
  {
    slug: "atelier-handtufted-wool-rug-charcoal",
    name: "Atelier Hand-Tufted Wool Rug - Charcoal",
    brand: "Minotti",
    description:
      "Dense hand-tufted wool rug with a subtle tonal pattern. Adds warmth and texture to modern interior palettes.",
    price: 1750,
    category: "Carpets",
    status: "ACTIVE" as const,
    sizes: ["Large"],
    images: [
      { url: "/products/valesun.jpg", displayOrder: 0 },
      { url: "/products/valesunback.jpg", displayOrder: 1 },
    ],
  },
];

async function main() {
  console.log("Seeding database...\n");

  for (const product of products) {
    const existing = await prisma.product.findUnique({
      where: { slug: product.slug },
    });

    if (existing) {
      console.log(`  ⚠  Skipped (already exists): ${product.name}`);
      continue;
    }

    const created = await prisma.product.create({
      data: {
        slug: product.slug,
        name: product.name,
        brand: product.brand,
        description: product.description,
        price: product.price,
        category: product.category,
        status: product.status,
        sizes: product.sizes,
        quantity: product.sizes.length,
        images: { create: product.images },
        sizeStocks: {
          create: product.sizes.map((size) => ({
            size,
            quantity: 1,
          })),
        },
      },
    });

    console.log(`  ✓  Created: ${created.name}`);
  }

  await prisma.$disconnect();
  console.log("\nDone. Visit http://localhost:3000 to see your store.");
}

main().catch((err) => {
  console.error("Seed failed:", err.message);
  process.exit(1);
});
