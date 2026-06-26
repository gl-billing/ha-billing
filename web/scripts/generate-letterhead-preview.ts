import fs from "fs";
import path from "path";
import { buildLetterheadPreviewDocumentHtml } from "../src/lib/firm-letterhead";

const out = path.join(process.cwd(), "public", "brand", "letterhead-preview.html");
fs.writeFileSync(out, buildLetterheadPreviewDocumentHtml());
console.log(`Wrote ${out}`);
