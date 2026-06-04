import { Helmet } from "react-helmet-async";
import {
  DEFAULT_OG_IMAGE,
  type PublicPageSeoConfig,
  resolveDefaultOgImageUrl,
  resolvePublicPageUrl
} from "../../lib/publicPageSeo";

type PublicPageSeoProps = {
  seo: PublicPageSeoConfig;
};

/** Full Open Graph + Twitter + canonical tags for a public marketing page. */
export function PublicPageSeo({ seo }: PublicPageSeoProps) {
  const canonicalUrl = resolvePublicPageUrl(seo.path);
  const ogImageUrl = resolveDefaultOgImageUrl();

  return (
    <Helmet>
      <html lang="en" />
      <title>{seo.title}</title>
      <meta name="description" content={seo.description} />
      <link rel="canonical" href={canonicalUrl} />
      <meta property="og:type" content="website" />
      <meta property="og:site_name" content="Proplytic" />
      <meta property="og:title" content={seo.title} />
      <meta property="og:description" content={seo.description} />
      <meta property="og:url" content={canonicalUrl} />
      <meta property="og:locale" content="en_ZA" />
      <meta property="og:image" content={ogImageUrl} />
      <meta property="og:image:secure_url" content={ogImageUrl} />
      <meta property="og:image:type" content="image/png" />
      <meta property="og:image:width" content={String(DEFAULT_OG_IMAGE.width)} />
      <meta property="og:image:height" content={String(DEFAULT_OG_IMAGE.height)} />
      <meta property="og:image:alt" content={DEFAULT_OG_IMAGE.alt} />
      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:title" content={seo.title} />
      <meta name="twitter:description" content={seo.description} />
      <meta name="twitter:image" content={ogImageUrl} />
      <meta name="twitter:image:alt" content={DEFAULT_OG_IMAGE.alt} />
    </Helmet>
  );
}
