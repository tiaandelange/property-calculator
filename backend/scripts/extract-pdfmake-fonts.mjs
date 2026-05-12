// One-off helper: extracts the four Roboto TTFs from the locally installed
// `pdfmake/build/vfs_fonts.js` (which embeds them as base64) and writes them to
// `backend/assets/fonts/`. The resulting TTFs are committed and used by
// `pdfMakePrinter.ts`, so the runtime no longer needs `vfs_fonts.js` (which
// Vercel/nft cannot resolve through the previous dynamic require).
//
// Run once whenever pdfmake is upgraded and you want the bundled Roboto build
// refreshed:
//
//   node backend/scripts/extract-pdfmake-fonts.mjs
//
// This file is a build-time utility only; it is not imported at runtime.

import { createRequire } from "node:module";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const backendRoot = join(here, "..");
const outDir = join(backendRoot, "assets", "fonts");

const require = createRequire(import.meta.url);
const vfs = require("pdfmake/build/vfs_fonts.js");

const wanted = [
  "Roboto-Regular.ttf",
  "Roboto-Medium.ttf",
  "Roboto-Italic.ttf",
  "Roboto-MediumItalic.ttf"
];

mkdirSync(outDir, { recursive: true });

for (const name of wanted) {
  const base64 = vfs[name];
  if (!base64) {
    console.error(`Font missing from pdfmake vfs: ${name}`);
    process.exit(1);
  }
  const target = join(outDir, name);
  writeFileSync(target, Buffer.from(base64, "base64"));
  console.log(`wrote ${target}`);
}
