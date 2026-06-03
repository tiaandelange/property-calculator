import { CONTACT_MESSAGE_MAX_LENGTH } from "../data/contactPageContent";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/i;

export type ContactFormValues = {
  name: string;
  email: string;
  phone: string;
  subject: string;
  message: string;
  website: string;
};

export const EMPTY_CONTACT_FORM_VALUES: ContactFormValues = {
  name: "",
  email: "",
  phone: "",
  subject: "",
  message: "",
  website: ""
};

export function validateContactFormValues(values: ContactFormValues): string | null {
  const name = values.name.trim();
  if (!name) return "Name is required.";
  if (name.length > 200) return "Name is too long.";

  const email = values.email.trim();
  if (!email) return "Email address is required.";
  if (email.length > 320 || !EMAIL_RE.test(email)) return "Enter a valid email address.";

  if (values.phone.trim().length > 50) return "Phone number is too long.";

  const subject = values.subject.trim();
  if (!subject) return "Subject is required.";
  if (subject.length > 200) return "Subject is too long.";

  const message = values.message.trim();
  if (!message) return "Message is required.";
  if (message.length > CONTACT_MESSAGE_MAX_LENGTH) {
    return `Message must be ${CONTACT_MESSAGE_MAX_LENGTH} characters or fewer.`;
  }

  return null;
}
