import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  getPublicPageSeoForPath,
  injectMetaIntoIndexHtml,
  listPrerenderPaths
} from "../seo/socialPreview.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const distDir = path.resolve(__dirname, "../dist");
const indexPath = path.join(distDir, "index.html");

if (!fs.existsSync(indexPath)) {
  console.error("prerender-public-meta: dist/index.html not found — run vite build first");
  process.exit(1);
}

const template = fs.readFileSync(indexPath, "utf8");

for (const routePath of listPrerenderPaths()) {
  const seo = getPublicPageSeoForPath(routePath);
  if (!seo) continue;

  const segments = routePath.split("/").filter(Boolean);
  const targetDir = path.join(distDir, ...segments);
  fs.mkdirSync(targetDir, { recursive: true });

  const html = injectMetaIntoIndexHtml(template, seo);
  fs.writeFileSync(path.join(targetDir, "index.html"), html, "utf8");
  console.log(`prerender-public-meta: ${routePath} → ${path.relative(distDir, path.join(targetDir, "index.html"))}`);
}

console.log("prerender-public-meta: done");
