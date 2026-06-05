import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const seoDir = path.resolve(__dirname, "../seo");
const publicDir = path.resolve(__dirname, "../public");
const jsonPath = path.join(seoDir, "public-pages.json");

const data = JSON.parse(fs.readFileSync(jsonPath, "utf8"));
const origin = data.siteOrigin.replace(/\/$/, "");
const lastmod = new Date().toISOString().slice(0, 10);

const STATIC_PRIORITY = {
  "/": { priority: "1.0", changefreq: "weekly" },
  "/pricing": { priority: "0.9", changefreq: "weekly" },
  "/calculators": { priority: "0.9", changefreq: "weekly" },
  "/reports": { priority: "0.9", changefreq: "weekly" },
  "/contact": { priority: "0.8", changefreq: "weekly" },
  "/login": { priority: "0.45", changefreq: "yearly" },
  "/signup": { priority: "0.45", changefreq: "yearly" },
  "/privacy": { priority: "0.3", changefreq: "yearly" },
  "/terms": { priority: "0.3", changefreq: "yearly" }
};

function locForPath(routePath) {
  return routePath === "/" ? `${origin}/` : `${origin}${routePath}`;
}

function sitemapEntry(routePath, priority, changefreq) {
  return [
    "  <url>",
    `    <loc>${locForPath(routePath)}</loc>`,
    `    <lastmod>${lastmod}</lastmod>`,
    `    <changefreq>${changefreq}</changefreq>`,
    `    <priority>${priority}</priority>`,
    "  </url>"
  ].join("\n");
}

const staticPaths = data.sitemap?.staticPaths ?? Object.keys(data.staticPages);
const calculatorPaths = Object.values(data.calculatorSlugs).map((entry) => entry.path);

const urls = [
  ...staticPaths.map((routePath) => {
    const meta = STATIC_PRIORITY[routePath] ?? { priority: "0.7", changefreq: "monthly" };
    return sitemapEntry(routePath, meta.priority, meta.changefreq);
  }),
  ...calculatorPaths.map((routePath) => sitemapEntry(routePath, "0.75", "monthly"))
];

const sitemapXml = [
  '<?xml version="1.0" encoding="UTF-8"?>',
  '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
  ...urls,
  "</urlset>",
  ""
].join("\n");

const disallowLines = (data.robotsDisallow ?? []).map((p) => `Disallow: ${p}`);
const robotsTxt = [
  "User-agent: *",
  "Allow: /",
  ...disallowLines,
  "",
  `Sitemap: ${origin}/sitemap.xml`,
  ""
].join("\n");

fs.writeFileSync(path.join(publicDir, "sitemap.xml"), sitemapXml, "utf8");
fs.writeFileSync(path.join(publicDir, "robots.txt"), robotsTxt, "utf8");

console.log(
  `generate-crawl-assets: wrote sitemap.xml (${staticPaths.length + calculatorPaths.length} URLs) and robots.txt`
);
