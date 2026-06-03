import { Helmet } from "react-helmet-async";
import { Link } from "react-router-dom";
import { Container } from "../components/ui/Container";
import { Section } from "../components/ui/Section";
import {
  PRIVACY_POLICY_CONTACT_EMAIL,
  PRIVACY_POLICY_LAST_UPDATED,
  PRIVACY_POLICY_SECTIONS,
  PRIVACY_POLICY_SEO
} from "../data/privacyPolicyContent";
import { resolvePublicPageUrl } from "../lib/publicPageSeo";

export function PrivacyPolicyPage() {
  const canonical = resolvePublicPageUrl("/privacy");

  return (
    <Section className="pg-legal-page">
      <Helmet>
        <title>{PRIVACY_POLICY_SEO.title}</title>
        <meta name="description" content={PRIVACY_POLICY_SEO.description} />
        {canonical ? <link rel="canonical" href={canonical} /> : null}
        <meta property="og:title" content={PRIVACY_POLICY_SEO.title} />
        <meta property="og:description" content={PRIVACY_POLICY_SEO.description} />
        {canonical ? <meta property="og:url" content={canonical} /> : null}
      </Helmet>

      <Container className="pg-container--marketing-wide pg-legal-page__container">
        <div className="pg-legal-page__layout">
          <nav className="pg-legal-page__toc" aria-label="On this page">
            <p className="pg-legal-page__toc-title">On this page</p>
            <ol className="pg-legal-page__toc-list">
              {PRIVACY_POLICY_SECTIONS.map((section) => (
                <li key={section.id}>
                  <a href={`#${section.id}`} className="pg-legal-page__toc-link">
                    {section.title}
                  </a>
                </li>
              ))}
            </ol>
          </nav>

          <article className="pg-legal-page__card">
            <header className="pg-legal-page__header">
              <h1 className="pg-legal-page__title">Privacy Policy</h1>
              <p className="pg-legal-page__subtitle">Last updated: {PRIVACY_POLICY_LAST_UPDATED}</p>
            </header>

            {PRIVACY_POLICY_SECTIONS.map((section) => (
              <section key={section.id} id={section.id} className="pg-legal-page__section">
                <h2 className="pg-legal-page__section-title">{section.title}</h2>

                {section.paragraphs?.map((text) => (
                  <p key={text} className="pg-legal-page__paragraph">
                    {text}
                  </p>
                ))}

                {section.id === "cookies-and-analytics" ? (
                  <p className="pg-legal-page__paragraph">
                    For more detail, see our{" "}
                    <Link to="/cookie-notice" className="pg-legal-page__inline-link">
                      Cookie Notice
                    </Link>
                    .
                  </p>
                ) : null}

                {section.list ? (
                  <ul className="pg-legal-page__list">
                    {section.list.map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                ) : null}

                {section.subsections?.map((sub) => (
                  <div key={sub.title} className="pg-legal-page__subsection">
                    <h3 className="pg-legal-page__subsection-title">{sub.title}</h3>
                    <ul className="pg-legal-page__list">
                      {sub.list.map((item) => (
                        <li key={item}>{item}</li>
                      ))}
                    </ul>
                  </div>
                ))}

                {section.id === "contact" ? (
                  <div className="pg-legal-page__contact">
                    <p className="pg-legal-page__paragraph">
                      Email:{" "}
                      <a href={`mailto:${PRIVACY_POLICY_CONTACT_EMAIL}`} className="pg-legal-page__inline-link">
                        {PRIVACY_POLICY_CONTACT_EMAIL}
                      </a>
                    </p>
                    <p className="pg-legal-page__paragraph">
                      Or use our <Link to="/contact" className="pg-legal-page__inline-link">Contact</Link> page.
                    </p>
                  </div>
                ) : null}
              </section>
            ))}
          </article>
        </div>
      </Container>
    </Section>
  );
}
