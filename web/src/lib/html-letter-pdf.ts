import fs from "node:fs";
import path from "node:path";
import type { FirmPageSize } from "@/lib/firm-page-sizes";

function publicDir(): string {
  return path.join(process.cwd(), "public");
}

function brandAssetDataUri(file: string): string | null {
  const filePath = path.join(publicDir(), "brand", file);
  if (!fs.existsSync(filePath)) return null;
  const bytes = fs.readFileSync(filePath);
  const ext = path.extname(file).toLowerCase();
  const mime =
    ext === ".jpg" || ext === ".jpeg" ? "image/jpeg" : ext === ".webp" ? "image/webp" : "image/png";
  return `data:${mime};base64,${bytes.toString("base64")}`;
}

/** Inline /brand assets so Chromium can render letterhead without a live origin. */
export function inlineLetterHtmlAssets(html: string): string {
  return html.replace(/\/brand\/([A-Za-z0-9._-]+)/g, (match, file: string) => {
    const dataUri = brandAssetDataUri(file);
    return dataUri || match;
  });
}

function isServerless(): boolean {
  return Boolean(process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_VERSION);
}

async function launchLetterPdfBrowser() {
  const { chromium } = await import("playwright-core");

  if (isServerless()) {
    const chromiumPack = await import("@sparticuz/chromium");
    const pack = chromiumPack.default;
    return chromium.launch({
      args: pack.args,
      executablePath: await pack.executablePath(),
      headless: pack.headless === "shell" || pack.headless === true
    });
  }

  try {
    return await chromium.launch({ channel: "chrome", headless: true });
  } catch {
    return await chromium.launch({ headless: true });
  }
}

/** Render the same letter HTML used in the in-app preview to a PDF. */
export async function renderLetterHtmlToPdf(html: string, pageSize: FirmPageSize): Promise<Uint8Array> {
  const prepared = inlineLetterHtmlAssets(html);
  const browser = await launchLetterPdfBrowser();

  try {
    const page = await browser.newPage();
    await page.setContent(prepared, { waitUntil: "networkidle" });
    await page.evaluate(async () => {
      if (document.fonts?.ready) await document.fonts.ready;
    });
    await page.waitForTimeout(400);

    const pdf = await page.pdf({
      preferCSSPageSize: true,
      printBackground: true,
      margin: { top: "0", right: "0", bottom: "0", left: "0" }
    });

    return new Uint8Array(pdf);
  } finally {
    await browser.close();
  }
}
