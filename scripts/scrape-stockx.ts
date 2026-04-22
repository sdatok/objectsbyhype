/**
 * StockX Product Scraper: local utility only, never deployed.
 *
 * Usage:
 *   npx tsx scripts/scrape-stockx.ts \
 *     --url "https://stockx.com/arcteryx-bird-head-toque-nightscape" \
 *     --slug "arcteryx-bird-head-toque" \
 *     --price 120 \
 *     --sizes "S/M,L/XL"
 *
 * Prerequisites:
 *   npm install -D playwright tsx
 *   npx playwright install chromium
 *   cp .env.example .env  (fill in DATABASE_URL and BLOB_READ_WRITE_TOKEN)
 */

import { chromium } from "playwright";
import { PrismaClient } from "@prisma/client";
import { put } from "@vercel/blob";
import { ONE_SIZE } from "../lib/size-stock";
import * as fs from "fs";
import * as path from "path";
import * as https from "https";
import * as http from "http";

// Load env from .env file
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

function parseArgs() {
  const args = process.argv.slice(2);
  const result: Record<string, string> = {};
  for (let i = 0; i < args.length; i++) {
    if (args[i].startsWith("--")) {
      result[args[i].slice(2)] = args[i + 1] ?? "";
      i++;
    }
  }
  return result;
}

function slugify(str: string): string {
  return str
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

async function downloadBuffer(url: string): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const client = url.startsWith("https") ? https : http;
    client.get(url, (res) => {
      const chunks: Buffer[] = [];
      res.on("data", (chunk) => chunks.push(chunk));
      res.on("end", () => resolve(Buffer.concat(chunks)));
      res.on("error", reject);
    });
  });
}

async function uploadImageFromUrl(
  imageUrl: string,
  slug: string,
  index: number
): Promise<string> {
  console.log(`  Uploading image ${index + 1}: ${imageUrl.slice(0, 80)}...`);
  const buffer = await downloadBuffer(imageUrl);
  const ext = imageUrl.split("?")[0].split(".").pop() ?? "jpg";
  const filename = `products/${slug}-${index}.${ext}`;

  const blob = await put(filename, buffer, {
    access: "public",
    contentType: `image/${ext === "jpg" ? "jpeg" : ext}`,
    token: process.env.BLOB_READ_WRITE_TOKEN,
  });

  return blob.url;
}

async function scrapeStockX(url: string): Promise<{
  name: string;
  brand: string;
  description: string;
  images: string[];
}> {
  console.log(`\nLaunching browser...`);
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    userAgent:
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    viewport: { width: 1440, height: 900 },
  });

  const page = await context.newPage();

  try {
    console.log(`Navigating to: ${url}`);
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 30000 });
    await page.waitForTimeout(3000);

    // Extract product name
    const name = await page
      .locator("h1")
      .first()
      .textContent()
      .catch(() => "");

    // Extract brand from breadcrumb or meta
    const brand = await page
      .locator('[data-testid="product-brand"], .product-brand, [class*="brand"]')
      .first()
      .textContent()
      .catch(async () => {
        return page
          .locator('meta[property="product:brand"]')
          .getAttribute("content")
          .catch(() => "");
      });

    // Extract description
    const description = await page
      .locator(
        '[data-testid="product-description"], [class*="description"], .product-description'
      )
      .first()
      .textContent()
      .catch(() => "");

    // Extract images: StockX puts product images in various containers
    const imageUrls = await page.evaluate(() => {
      const images = new Set<string>();

      // Try various selectors StockX uses
      const selectors = [
        'img[src*="images.stockx.com"]',
        '[class*="media"] img',
        '[class*="product-image"] img',
        '[data-testid*="image"] img',
        ".carousel img",
        "picture img",
      ];

      for (const sel of selectors) {
        document.querySelectorAll<HTMLImageElement>(sel).forEach((img) => {
          const src = img.src || img.dataset.src || "";
          if (src && src.includes("stockx.com") && !src.includes("logo")) {
            // Get full resolution version
            const fullRes = src
              .replace(/\?.*$/, "")
              .replace(/_small|_thumb|_200|_400/g, "");
            images.add(fullRes);
          }
        });
      }

      return [...images].slice(0, 8);
    });

    await browser.close();

    return {
      name: (name ?? "").trim(),
      brand: (brand ?? "").trim(),
      description: (description ?? "").trim(),
      images: imageUrls,
    };
  } catch (err) {
    await browser.close();
    throw err;
  }
}

async function main() {
  const args = parseArgs();

  if (!args.url) {
    console.error("Usage: npx tsx scripts/scrape-stockx.ts --url <stockx-url> [--slug <slug>] [--price <price>] [--sizes <S,M,L>] [--category <category>]");
    process.exit(1);
  }

  if (!process.env.DATABASE_URL) {
    console.error("DATABASE_URL not set in .env");
    process.exit(1);
  }

  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    console.error("BLOB_READ_WRITE_TOKEN not set in .env");
    process.exit(1);
  }

  const url = args.url;
  const priceArg = args.price ? parseFloat(args.price) : 0;
  const sizesArg = args.sizes ? args.sizes.split(",").map((s) => s.trim()) : [];
  const category = args.category ?? "Accessories";

  console.log(`\n=== Objectsbyhype · StockX Scraper ===`);

  const scraped = await scrapeStockX(url);

  console.log(`\nScraped:`);
  console.log(`  Name:   ${scraped.name || "(not detected)"}`);
  console.log(`  Brand:  ${scraped.brand || "(not detected)"}`);
  console.log(`  Images: ${scraped.images.length} found`);

  const name = scraped.name || args.slug || "Untitled Product";
  const brand = scraped.brand || "Unknown";
  const slug = args.slug ?? slugify(name);
  const description = scraped.description || `${brand} ${name}. Condition: New.`;

  // Upload images to Vercel Blob
  const uploadedUrls: string[] = [];
  if (scraped.images.length > 0) {
    console.log(`\nUploading ${scraped.images.length} images to Vercel Blob...`);
    for (let i = 0; i < scraped.images.length; i++) {
      try {
        const blobUrl = await uploadImageFromUrl(scraped.images[i], slug, i);
        uploadedUrls.push(blobUrl);
        console.log(`  ✓ ${blobUrl}`);
      } catch (err) {
        console.warn(`  ✗ Failed to upload image ${i + 1}:`, err);
      }
    }
  }

  // Check if slug already exists
  const existing = await prisma.product.findUnique({ where: { slug } });
  if (existing) {
    console.error(`\n✗ Product with slug "${slug}" already exists. Use --slug to provide a unique slug.`);
    await prisma.$disconnect();
    process.exit(1);
  }

  // Insert into database
  console.log(`\nInserting into database...`);
  const catalogSizes = sizesArg.length > 0 ? sizesArg : [];
  const stockSizes = catalogSizes.length > 0 ? catalogSizes : [ONE_SIZE];

  const product = await prisma.product.create({
    data: {
      name,
      brand,
      slug,
      description,
      price: priceArg,
      category,
      status: "DRAFT",
      sizes: catalogSizes,
      quantity: stockSizes.length,
      images: {
        create: uploadedUrls.map((url, idx) => ({
          url,
          displayOrder: idx,
        })),
      },
      sizeStocks: {
        create: stockSizes.map((size) => ({ size, quantity: 1 })),
      },
    },
    include: { images: true },
  });

  await prisma.$disconnect();

  console.log(`\n✓ Product created as DRAFT:`);
  console.log(`  ID:     ${product.id}`);
  console.log(`  Name:   ${product.name}`);
  console.log(`  Slug:   ${product.slug}`);
  console.log(`  Images: ${product.images.length} uploaded`);
  console.log(`\nNext: Open your admin panel, set the price, and publish it.`);
  console.log(`  http://localhost:3000/admin/products/${product.id}`);
}

main().catch((err) => {
  console.error("\n✗ Error:", err.message);
  process.exit(1);
});
