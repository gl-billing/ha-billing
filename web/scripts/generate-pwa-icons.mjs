/**
 * Regenerate PWA / favicon assets from `/public/brand/logo.png`.
 * Run: node scripts/generate-pwa-icons.mjs
 */
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const webRoot = path.join(__dirname, "..");
const source = path.join(webRoot, "public/brand/logo.png");
const background = "#faf8f4";

async function writeSquareIcon(size, outputPath, paddingRatio = 0.06) {
  const inset = Math.round(size * paddingRatio);
  const inner = size - inset * 2;
  const logo = await sharp(source).resize(inner, inner, { fit: "contain" }).png().toBuffer();

  await sharp({
    create: {
      width: size,
      height: size,
      channels: 4,
      background
    }
  })
    .composite([{ input: logo, gravity: "center" }])
    .png()
    .toFile(outputPath);

  console.log(`Wrote ${path.relative(webRoot, outputPath)} (${size}×${size})`);
}

await writeSquareIcon(32, path.join(webRoot, "public/favicon.png"), 0.04);
await writeSquareIcon(180, path.join(webRoot, "public/apple-touch-icon.png"));
await writeSquareIcon(192, path.join(webRoot, "public/icons/icon-192.png"));
await writeSquareIcon(512, path.join(webRoot, "public/icons/icon-512.png"));
