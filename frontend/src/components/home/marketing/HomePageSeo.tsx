import { Helmet } from "react-helmet-async";
import { PublicPageSeo } from "../../seo/PublicPageSeo";
import { HOME_PAGE_SEO, PUBLIC_SITE_ORIGIN } from "../../../lib/publicPageSeo";

const HOME_JSON_LD = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "Organization",
      name: "Proplytic",
      url: PUBLIC_SITE_ORIGIN
    },
    {
      "@type": "SoftwareApplication",
      name: "Proplytic",
      url: PUBLIC_SITE_ORIGIN,
      applicationCategory: "BusinessApplication",
      operatingSystem: "Web",
      audience: {
        "@type": "Audience",
        audienceType: "South African landlords and property investors"
      }
    }
  ]
};

export function HomePageSeo() {
  return (
    <>
      <PublicPageSeo seo={HOME_PAGE_SEO} />
      <Helmet>
        <script type="application/ld+json">{JSON.stringify(HOME_JSON_LD)}</script>
      </Helmet>
    </>
  );
}
