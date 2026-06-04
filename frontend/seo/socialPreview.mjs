import { seoData } from "./seoData.mjs";

const SITE_ORIGIN = seoData.siteOrigin.replace(/\/$/, "");
const OG = seoData.ogImage;

export function absoluteUrl(pathname) {
  const path = pathname.startsWith("/") ? pathname : `/${pathname}`;
  return `${SITE_ORIGIN}${path}`;
}

export function ogImageUrl() {
  return absoluteUrl(OG.path);
}

export function normalizePathname(pathname) {
  const path = (pathname || "/").split("?")[0]?.split("#")[0] || "/";
  return path.endsWith("/") && path.length > 1 ? path.slice(0, -1) : path || "/";
}

export function getPublicPageSeoForPath(pathname) {
  const normalized = normalizePathname(pathname);
  if (seoData.staticPages[normalized]) {
    return seoData.staticPages[normalized];
  }
  const calcMatch = /^\/calculators\/([^/]+)$/.exec(normalized);
  if (calcMatch && seoData.calculatorSlugs[calcMatch[1]]) {
    return seoData.calculatorSlugs[calcMatch[1]];
  }
  if (calcMatch) {
    return {
      title: "Property Calculator | Proplytic",
      description: seoData.staticPages["/calculators"].description,
      path: normalized
    };
  }
  return null;
}

export function listPrerenderPaths() {
  const paths = Object.keys(seoData.staticPages).filter((p) => p !== "/");
  for (const slug of Object.keys(seoData.calculatorSlugs)) {
    paths.push(`/calculators/${slug}`);
  }
  return [...new Set(paths)];
}

export function isSocialPreviewCrawler(userAgent) {
  if (!userAgent) return false;
  return /facebookexternalhit|facebot|twitterbot|linkedinbot|whatsapp|slackbot|discordbot|telegrambot|pinterest|embedly|quora link preview|redditbot|googlebot|bingpreview/i.test(
    userAgent
  );
}

function escapeHtml(text) {
  return String(text)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function buildSocialPreviewHtml(seo) {
  const canonical = absoluteUrl(seo.path);
  const image = ogImageUrl();
  const title = escapeHtml(seo.title);
  const description = escapeHtml(seo.description);
  const alt = escapeHtml(OG.alt);

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${title}</title>
  <meta name="description" content="${description}" />
  <link rel="canonical" href="${canonical}" />
  <meta property="og:type" content="website" />
  <meta property="og:site_name" content="Proplytic" />
  <meta property="og:locale" content="en_ZA" />
  <meta property="og:title" content="${title}" />
  <meta property="og:description" content="${description}" />
  <meta property="og:url" content="${canonical}" />
  <meta property="og:image" content="${image}" />
  <meta property="og:image:secure_url" content="${image}" />
  <meta property="og:image:type" content="image/png" />
  <meta property="og:image:width" content="${OG.width}" />
  <meta property="og:image:height" content="${OG.height}" />
  <meta property="og:image:alt" content="${alt}" />
  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:title" content="${title}" />
  <meta name="twitter:description" content="${description}" />
  <meta name="twitter:image" content="${image}" />
  <meta name="twitter:image:alt" content="${alt}" />
</head>
<body>
  <p><a href="${canonical}">Proplytic</a></p>
  <script>location.replace(${JSON.stringify(canonical)});</script>
</body>
</html>`;
}

function replaceMetaContent(html, attr, key, value) {
  const re = new RegExp(
    `<meta[\\s\\S]*?${attr}="${key}"[\\s\\S]*?content="[^"]*"[\\s\\S]*?/?>`,
    "i"
  );
  return html.replace(
    re,
    `<meta ${attr}="${key}" content="${escapeHtml(value)}" />`
  );
}

/** Patch Vite index.html template meta for a public page. */
export function injectMetaIntoIndexHtml(html, seo) {
  const canonical = absoluteUrl(seo.path);
  const image = ogImageUrl();
  const title = seo.title;
  const description = seo.description;

  let out = html;
  out = out.replace(/<title>[^<]*<\/title>/, `<title>${escapeHtml(title)}</title>`);
  out = replaceMetaContent(out, "name", "description", description);
  out = out.replace(
    /<link\s+rel="canonical"\s+href="[^"]*"\s*\/>/,
    `<link rel="canonical" href="${canonical}" />`
  );
  for (const [prop, content] of [
    ["og:title", title],
    ["og:description", description],
    ["og:url", canonical],
    ["og:image", image],
    ["og:image:secure_url", image]
  ]) {
    out = replaceMetaContent(out, "property", prop, content);
  }
  for (const [name, content] of [
    ["twitter:title", title],
    ["twitter:description", description],
    ["twitter:image", image]
  ]) {
    out = replaceMetaContent(out, "name", name, content);
  }
  return out;
}
