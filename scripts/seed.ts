/**
 * Seed script: creates/updates initial Objectsbyhype furniture products.
 * Run with: npm run seed
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
    images: [
      { url: "/objectsbyhype_images/3b713453ec591d795b66f2d3e75e1bf2.jpg", displayOrder: 0 },
      { url: "/objectsbyhype_images/111d8e13c2a0849202a060351e11a234.webp", displayOrder: 1 },
    ],
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
      { url: "/objectsbyhype_images/98ad6a19f0eb4bc102adf96ededd9072.jpg", displayOrder: 0 },
      { url: "/objectsbyhype_images/d9e9530052e73a8a617ee58b47056869.jpg", displayOrder: 1 },
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
      { url: "/objectsbyhype_images/037b23a4a8083da4f4ef166c8e2cace1.jpg", displayOrder: 0 },
      { url: "/objectsbyhype_images/7fcaf64bd28f2c7623a97e8e34144992.jpg", displayOrder: 1 },
    ],
  },
];

async function main() {
  console.log("Seeding database...\n");

  for (const product of products) {
    const upserted = await prisma.$transaction(async (tx) => {
      const saved = await tx.product.upsert({
        where: { slug: product.slug },
        update: {
          name: product.name,
          brand: product.brand,
          description: product.description,
          price: product.price,
          category: product.category,
          status: product.status,
          sizes: product.sizes,
          quantity: product.sizes.length,
        },
        create: {
          slug: product.slug,
          name: product.name,
          brand: product.brand,
          description: product.description,
          price: product.price,
          category: product.category,
          status: product.status,
          sizes: product.sizes,
          quantity: product.sizes.length,
        },
      });

      await tx.productImage.deleteMany({
        where: { productId: saved.id },
      });

      await tx.productImage.createMany({
        data: product.images.map((img) => ({
          productId: saved.id,
          url: img.url,
          displayOrder: img.displayOrder,
        })),
      });

      await tx.productSizeStock.deleteMany({
        where: { productId: saved.id },
      });

      await tx.productSizeStock.createMany({
        data: product.sizes.map((size) => ({
          productId: saved.id,
          size,
          quantity: 1,
        })),
      });

      return saved;
    });

    console.log(`  ✓  Upserted: ${upserted.name}`);
  }

  await prisma.$disconnect();
  console.log("\nDone. Visit http://localhost:3000 to see your store.");
}

main().catch((err) => {
  console.error("Seed failed:", err.message);
  process.exit(1);
});
