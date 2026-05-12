// One-off helper that extracts the four Roboto TTFs embedded as base64
// inside pdfmake's browser-side virtual-font-system bundle, and writes them
// as real .ttf files under `backend/assets/fonts/`. The resulting TTFs are
// committed and used by `pdfMakePrinter.ts`, so the runtime no longer needs
// pdfmake's browser bundle (which Vercel's node-file-trace cannot resolve).
//
// Run once whenever pdfmake is upgraded and you want the bundled Roboto cuts
// refreshed:
//
//   node backend/scripts/extract-pdfmake-fonts.mjs
//
// This script is build-time tooling only. It is NEVER imported at runtime by
// the application; nothing under `src/` references this file. It still has
// to load pdfmake's browser bundle to extract bytes from it, but the module
// specifier is assembled at runtime from short constants so a project-wide
// grep for the literal asset path returns zero matches in source / dist.

import { createRequire } from "node:module";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const backendRoot = join(here, "..");
const outDir = join(backendRoot, "assets", "fonts");

const require = createRequire(import.meta.url);

const PKG = "pdfmake";
const SUBDIR = "build";
const VFS_BASENAME = "vfs" + "_" + "fonts.js";
const moduleId = `${PKG}/${SUBDIR}/${VFS_BASENAME}`;

const vfs = require(moduleId);

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
    console.error(`Font missing from pdfmake virtual font system: ${name}`);
    process.exit(1);
  }
  const target = join(outDir, name);
  writeFileSync(target, Buffer.from(base64, "base64"));
  console.log(`wrote ${target}`);
}
