import { useState, type FormEvent } from "react";
import { Helmet } from "react-helmet-async";
import { Check } from "lucide-react";
import { Container } from "../components/ui/Container";
import { Section } from "../components/ui/Section";
import { Button } from "../components/ui/Button";
import { Field, Input } from "../components/ui/Input";
import {
  CONTACT_FORM_SUCCESS_MESSAGE,
  CONTACT_MESSAGE_MAX_LENGTH,
  CONTACT_PAGE_SEO,
  contactPageHeading,
  contactPageSubheading,
  contactPageSupportTopics
} from "../data/contactPageContent";
import {
  EMPTY_CONTACT_FORM_VALUES,
  validateContactFormValues,
  type ContactFormValues
} from "../lib/contactFormClientValidation";
import { resolvePublicPageUrl } from "../lib/publicPageSeo";
import { submitContactForm } from "../services/contactFormApi";

export function ContactPage() {
  const canonical = resolvePublicPageUrl("/contact");
  const [values, setValues] = useState<ContactFormValues>(EMPTY_CONTACT_FORM_VALUES);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function updateField<K extends keyof ContactFormValues>(key: K, value: ContactFormValues[K]) {
    setValues((prev) => ({ ...prev, [key]: value }));
    if (error) setError(null);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (loading || success) return;

    const validationError = validateContactFormValues(values);
    if (validationError) {
      setError(validationError);
      return;
    }

    setLoading(true);
    setError(null);

    const result = await submitContactForm(values);
    setLoading(false);

    if (result.ok) {
      setValues(EMPTY_CONTACT_FORM_VALUES);
      setSuccess(true);
      return;
    }

    setError(result.error);
  }

  const messageLength = values.message.length;

  return (
    <Section className="pg-contact-page">
      <Helmet>
        <title>{CONTACT_PAGE_SEO.title}</title>
        <meta name="description" content={CONTACT_PAGE_SEO.description} />
        {canonical ? <link rel="canonical" href={canonical} /> : null}
        <meta property="og:title" content={CONTACT_PAGE_SEO.title} />
        <meta property="og:description" content={CONTACT_PAGE_SEO.description} />
        {canonical ? <meta property="og:url" content={canonical} /> : null}
      </Helmet>

      <Container className="pg-container--marketing-wide pg-contact-page__container">
        <div className="pg-contact-page__layout">
          <div className="pg-contact-page__intro">
            <h1 className="pg-contact-page__title">{contactPageHeading}</h1>
            <p className="pg-contact-page__lead">{contactPageSubheading}</p>
            <ul className="pg-contact-page__topics">
              {contactPageSupportTopics.map((topic) => (
                <li key={topic} className="pg-contact-page__topic">
                  <Check
                    className="pg-contact-page__topic-icon"
                    size={18}
                    strokeWidth={2.5}
                    aria-hidden
                  />
                  <span>{topic}</span>
                </li>
              ))}
            </ul>
          </div>

          <div className="pg-contact-page__card">
            {success ? (
              <div className="pg-contact-page__success-panel" role="status">
                <p className="pg-contact-page__alert pg-contact-page__alert--success">
                  {CONTACT_FORM_SUCCESS_MESSAGE}
                </p>
                <p className="pg-contact-page__success-title">Thank you for reaching out.</p>
                <p className="pg-contact-page__success-note">
                  If your question is urgent, you can send another message below.
                </p>
                <Button type="button" variant="secondary" onClick={() => setSuccess(false)}>
                  Send another message
                </Button>
              </div>
            ) : (
              <form className="pg-contact-page__form" onSubmit={handleSubmit} noValidate>
                {error ? (
                  <p className="pg-contact-page__alert pg-contact-page__alert--error" role="alert">
                    {error}
                  </p>
                ) : null}

                <div className="pg-contact-page__honeypot" aria-hidden="true">
                  <label htmlFor="contact-website">Website</label>
                  <input
                    id="contact-website"
                    name="website"
                    type="text"
                    tabIndex={-1}
                    autoComplete="off"
                    value={values.website}
                    onChange={(e) => updateField("website", e.target.value)}
                  />
                </div>

                <Field label="Name" fieldId="contact-name">
                  <Input
                    id="contact-name"
                    name="name"
                    type="text"
                    autoComplete="name"
                    required
                    maxLength={200}
                    value={values.name}
                    onChange={(e) => updateField("name", e.target.value)}
                  />
                </Field>

                <Field label="Email address" fieldId="contact-email">
                  <Input
                    id="contact-email"
                    name="email"
                    type="email"
                    autoComplete="email"
                    required
                    maxLength={320}
                    value={values.email}
                    onChange={(e) => updateField("email", e.target.value)}
                  />
                </Field>

                <Field label="Phone (optional)" fieldId="contact-phone">
                  <Input
                    id="contact-phone"
                    name="phone"
                    type="tel"
                    autoComplete="tel"
                    maxLength={50}
                    value={values.phone}
                    onChange={(e) => updateField("phone", e.target.value)}
                  />
                </Field>

                <Field label="Subject" fieldId="contact-subject">
                  <Input
                    id="contact-subject"
                    name="subject"
                    type="text"
                    required
                    maxLength={200}
                    value={values.subject}
                    onChange={(e) => updateField("subject", e.target.value)}
                  />
                </Field>

                <Field label="Message" fieldId="contact-message">
                  <textarea
                    id="contact-message"
                    name="message"
                    className="pg-input pg-contact-page__textarea"
                    required
                    maxLength={CONTACT_MESSAGE_MAX_LENGTH}
                    rows={6}
                    value={values.message}
                    onChange={(e) => updateField("message", e.target.value)}
                  />
                </Field>
                <p className="pg-contact-page__char-count" aria-live="polite">
                  {messageLength} / {CONTACT_MESSAGE_MAX_LENGTH}
                </p>

                <Button type="submit" variant="primary" fullWidth loading={loading} disabled={loading}>
                  {loading ? "Sending…" : "Send message"}
                </Button>
              </form>
            )}
          </div>
        </div>
      </Container>
    </Section>
  );
}
