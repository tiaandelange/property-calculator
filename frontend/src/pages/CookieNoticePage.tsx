import { Helmet } from "react-helmet-async";
import { Link } from "react-router-dom";
import { Container } from "../components/ui/Container";
import { Section } from "../components/ui/Section";
import {
  COOKIE_NOTICE_LAST_UPDATED,
  COOKIE_NOTICE_SECTIONS,
  COOKIE_NOTICE_SEO
} from "../data/cookieNoticeContent";
import { resolvePublicPageUrl } from "../lib/publicPageSeo";

export function CookieNoticePage() {
  const canonical = resolvePublicPageUrl("/cookie-notice");

  return (
    <Section className="pg-legal-page">
      <Helmet>
        <title>{COOKIE_NOTICE_SEO.title}</title>
        <meta name="description" content={COOKIE_NOTICE_SEO.description} />
        {canonical ? <link rel="canonical" href={canonical} /> : null}
        <meta property="og:title" content={COOKIE_NOTICE_SEO.title} />
        <meta property="og:description" content={COOKIE_NOTICE_SEO.description} />
        {canonical ? <meta property="og:url" content={canonical} /> : null}
      </Helmet>

      <Container className="pg-container--marketing-wide pg-legal-page__container">
        <div className="pg-legal-page__layout">
          <nav className="pg-legal-page__toc" aria-label="On this page">
            <p className="pg-legal-page__toc-title">On this page</p>
            <ol className="pg-legal-page__toc-list">
              {COOKIE_NOTICE_SECTIONS.map((section) => (
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
              <h1 className="pg-legal-page__title">Cookie Notice</h1>
              <p className="pg-legal-page__subtitle">Last updated: {COOKIE_NOTICE_LAST_UPDATED}</p>
            </header>

            {COOKIE_NOTICE_SECTIONS.map((section) => (
              <section key={section.id} id={section.id} className="pg-legal-page__section">
                <h2 className="pg-legal-page__section-title">{section.title}</h2>

                {section.paragraphs?.map((text) => (
                  <p key={text} className="pg-legal-page__paragraph">
                    {text}
                  </p>
                ))}

                {section.list ? (
                  <ul className="pg-legal-page__list">
                    {section.list.map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                ) : null}

                {section.afterList?.map((text) => (
                  <p key={text} className="pg-legal-page__paragraph">
                    {text}
                  </p>
                ))}

                {section.subsections?.map((sub) => (
                  <div key={sub.title} className="pg-legal-page__subsection">
                    <h3 className="pg-legal-page__subsection-title">{sub.title}</h3>
                    {sub.paragraphs?.map((text) => (
                      <p key={text} className="pg-legal-page__paragraph">
                        {text}
                      </p>
                    ))}
                    <ul className="pg-legal-page__list">
                      {sub.list.map((item) => (
                        <li key={item}>{item}</li>
                      ))}
                    </ul>
                  </div>
                ))}

                {section.id === "contact" ? (
                  <p className="pg-legal-page__paragraph">
                    <Link to="/privacy" className="pg-legal-page__inline-link">
                      Privacy Policy
                    </Link>
                  </p>
                ) : null}
              </section>
            ))}
          </article>
        </div>
      </Container>
    </Section>
  );
}
