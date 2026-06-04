import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const seoDir = path.resolve(__dirname, "../seo");
const jsonPath = path.join(seoDir, "public-pages.json");
const outPath = path.join(seoDir, "seoData.mjs");

const data = JSON.parse(fs.readFileSync(jsonPath, "utf8"));
const body = `/** Generated from public-pages.json — run: node scripts/sync-seo-data.mjs */\nexport const seoData = ${JSON.stringify(data, null, 2)};\n`;
fs.writeFileSync(outPath, body, "utf8");
console.log("sync-seo-data: wrote seo/seoData.mjs");
