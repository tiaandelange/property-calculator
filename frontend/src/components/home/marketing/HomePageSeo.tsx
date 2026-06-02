import { Helmet } from "react-helmet-async";
import { HOME_PAGE_SEO, resolvePublicPageUrl } from "../../../lib/publicPageSeo";

export function HomePageSeo() {
  const canonicalUrl = resolvePublicPageUrl(HOME_PAGE_SEO.path);
  const ogImageUrl = resolvePublicPageUrl(HOME_PAGE_SEO.ogImagePath);

  return (
    <Helmet>
      <html lang="en" />
      <title>{HOME_PAGE_SEO.title}</title>
      <meta name="description" content={HOME_PAGE_SEO.description} />
      {canonicalUrl ? <link rel="canonical" href={canonicalUrl} /> : null}
      <meta property="og:site_name" content="Proplytic" />
      <meta property="og:title" content={HOME_PAGE_SEO.title} />
      <meta property="og:description" content={HOME_PAGE_SEO.description} />
      <meta property="og:type" content="website" />
      {canonicalUrl ? <meta property="og:url" content={canonicalUrl} /> : null}
      {ogImageUrl ? <meta property="og:image" content={ogImageUrl} /> : null}
      <meta name="twitter:card" content="summary" />
      <meta name="twitter:title" content={HOME_PAGE_SEO.title} />
      <meta name="twitter:description" content={HOME_PAGE_SEO.description} />
      {ogImageUrl ? <meta name="twitter:image" content={ogImageUrl} /> : null}
    </Helmet>
  );
}
