import { homepageTestimonialAvatars } from "./homepageAssets";

/**
 * PLACEHOLDER HOMEPAGE TESTIMONIALS — NOT REAL CUSTOMER FEEDBACK.
 *
 * Replace `PLACEHOLDER_HOMEPAGE_TESTIMONIALS` (and related UI copy in
 * `HomeTestimonialsSection`) with verified quotes, names, roles and avatars
 * before launch. Do not ship these as authentic social proof.
 */
export type HomepagePlaceholderTestimonial = {
  readonly id: string;
  readonly quote: string;
  readonly name: string;
  readonly role: string;
  readonly avatarSrc: string;
};

export const PLACEHOLDER_HOMEPAGE_TESTIMONIALS: readonly HomepagePlaceholderTestimonial[] = [
  {
    id: "placeholder-1",
    quote: "This made the property numbers much easier to understand.",
    name: "Placeholder Customer One",
    role: "First-time buyer",
    avatarSrc: homepageTestimonialAvatars[0]
  },
  {
    id: "placeholder-2",
    quote: "We compared different scenarios quickly without getting lost in spreadsheets.",
    name: "Placeholder Customer Two",
    role: "Property investor",
    avatarSrc: homepageTestimonialAvatars[1]
  },
  {
    id: "placeholder-3",
    quote: "The calculator gave us a clear starting point before speaking to the bank.",
    name: "Placeholder Customer Three",
    role: "Home buyer",
    avatarSrc: homepageTestimonialAvatars[2]
  }
] as const;
