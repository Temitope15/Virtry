#!/usr/bin/env node
/**
 * Bulk-upload merchandise images to Cloudinary.
 *
 * Usage:
 *   1. Save your product photos under `assets/merch/` using the filenames
 *      listed in MERCH_FILES below.
 *   2. Copy `.env.local.example` to `.env.local` and fill in your credentials.
 *   3. Run:    node scripts/upload-merch.mjs
 *
 * Flags:
 *   --no-bg-removal   Skip Cloudinary's AI background removal.
 *   --dry-run         Print what would be uploaded; don't actually upload.
 *
 * Output: prints a JSON block you can paste into `lib/merchData.ts`.
 */

import { existsSync, readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { v2 as cloudinary } from "cloudinary";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");

loadEnvFile(resolve(ROOT, ".env.local"));

const args = new Set(process.argv.slice(2));
const REMOVE_BG = !args.has("--no-bg-removal");
const DRY_RUN = args.has("--dry-run");

const required = ["CLOUDINARY_CLOUD_NAME", "CLOUDINARY_API_KEY", "CLOUDINARY_API_SECRET"];
for (const k of required) {
  if (!process.env[k]) {
    console.error(`Missing env var: ${k}. Set it in .env.local`);
    process.exit(1);
  }
}

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
  secure: true,
});

/**
 * The five products from the youth-week catalog. `file` is the local image
 * name expected under `assets/merch/`; `id` is the stable app identifier.
 */
const MERCH_FILES = [
  { id: "jacket-black",   file: "jacket-black.jpg",   name: "Christ Dominion Hooded Jacket", type: "clothing", price: 65 },
  { id: "tee-white",      file: "tee-white.jpg",      name: "Keys of the Kingdom Tee",       type: "clothing", price: 25 },
  { id: "hoodie-navy",    file: "hoodie-navy.jpg",    name: "Keys of the Kingdom Hoodie",    type: "clothing", price: 55 },
  { id: "cap-grey-navy",  file: "cap-grey-navy.jpg",  name: "Christ Dominion Snapback",      type: "headwear", price: 20 },
  { id: "headband-black", file: "headband-black.jpg", name: "Keys of the Kingdom Headband",  type: "headwear", price: 10 },
];

const FOLDER = "virtry/merch";

async function main() {
  const results = [];
  for (const item of MERCH_FILES) {
    const localPath = resolve(ROOT, "assets", "merch", item.file);
    if (!existsSync(localPath)) {
      console.error(`✗ Missing file: ${localPath}`);
      continue;
    }

    const publicId = `${FOLDER}/${item.id}`;
    if (DRY_RUN) {
      console.log(`[dry-run] would upload ${localPath} → ${publicId}`);
      continue;
    }

    process.stdout.write(`↑ Uploading ${item.id} ... `);
    try {
      const res = await cloudinary.uploader.upload(localPath, {
        public_id: publicId,
        overwrite: true,
        resource_type: "image",
        ...(REMOVE_BG ? { background_removal: "cloudinary_ai" } : {}),
      });

      // Force PNG so transparency (after bg removal) is preserved on delivery.
      const deliveryUrl = cloudinary.url(publicId, {
        secure: true,
        format: "png",
        quality: "auto",
        version: res.version,
      });

      results.push({ ...item, cloudinaryUrl: deliveryUrl });
      console.log("done");
    } catch (err) {
      console.log("failed");
      console.error(`  ${err.message ?? err}`);
    }
  }

  if (results.length === 0) {
    console.log("\nNo uploads succeeded.");
    return;
  }

  console.log("\n--- Paste into lib/merchData.ts (MERCH_CATALOG) ---\n");
  const formatted = results.map(({ id, name, type, price, cloudinaryUrl }) => ({
    id, name, type, price, cloudinaryUrl,
  }));
  console.log(JSON.stringify(formatted, null, 2));

  if (REMOVE_BG) {
    console.log(
      "\nNote: background_removal runs asynchronously on Cloudinary's side.",
      "\nIf the URLs still show the grey background, wait ~30s and reload.",
    );
  }
}

function loadEnvFile(path) {
  if (!existsSync(path)) return;
  const text = readFileSync(path, "utf8");
  for (const line of text.split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (!m) continue;
    const [, k, vRaw] = m;
    if (process.env[k]) continue;
    process.env[k] = vRaw.replace(/^['"]|['"]$/g, "").trim();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
