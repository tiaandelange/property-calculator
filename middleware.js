import {
  buildSocialPreviewHtml,
  getPublicPageSeoForPath,
  isSocialPreviewCrawler
} from "./frontend/seo/socialPreview.mjs";

export const config = {
  matcher: [
    "/",
    "/calculators",
    "/calculators/:path*",
    "/reports",
    "/pricing",
    "/contact",
    "/login",
    "/signup",
    "/apply",
    "/apply/:path*",
    "/privacy",
    "/terms"
  ]
};

export default function middleware(request) {
  const userAgent = request.headers.get("user-agent");
  if (!isSocialPreviewCrawler(userAgent)) {
    return;
  }

  const pathname = new URL(request.url).pathname;
  const seo = getPublicPageSeoForPath(pathname);
  if (!seo) {
    return;
  }

  return new Response(buildSocialPreviewHtml(seo), {
    status: 200,
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "public, max-age=3600, s-maxage=86400"
    }
  });
}
