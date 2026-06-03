/** Terms of Use copy — public marketing page (static, not legal advice). */

export const TERMS_OF_USE_LAST_UPDATED = "3 June 2026";

export const TERMS_OF_USE_SEO = {
  title: "Terms of Use | Proplytic",
  description:
    "Terms governing access to Proplytic — property portfolio analytics, rental administration, reports, and calculators for users in South Africa."
} as const;

/** General enquiries — also linked from /contact */
export const TERMS_OF_USE_CONTACT_EMAIL = "support@proplytic.co.za";

export type TermsOfUseSection = {
  id: string;
  title: string;
  paragraphs?: string[];
  list?: string[];
  afterList?: string[];
  subsections?: { title: string; paragraphs?: string[]; list: string[] }[];
};

export const TERMS_OF_USE_SECTIONS: TermsOfUseSection[] = [
  {
    id: "acceptance",
    title: "Acceptance",
    paragraphs: ["By accessing or using Proplytic you agree to these Terms of Use."]
  },
  {
    id: "service-description",
    title: "Service Description",
    paragraphs: ["Proplytic provides:"],
    list: [
      "Property portfolio analytics",
      "Property management tools",
      "Tenant management",
      "Lease management",
      "Invoice generation",
      "Statement generation",
      "Investment reporting",
      "Property calculators"
    ]
  },
  {
    id: "accounts",
    title: "Accounts",
    paragraphs: ["Users are responsible for:"],
    list: [
      "Maintaining account security",
      "Safeguarding passwords",
      "Activities conducted under their account"
    ]
  },
  {
    id: "user-data",
    title: "User Data",
    paragraphs: ["Users remain responsible for:"],
    list: [
      "Tenant information entered",
      "Lease information entered",
      "Financial information entered",
      "Reports generated from user-supplied information"
    ]
  },
  {
    id: "accuracy",
    title: "Accuracy",
    paragraphs: [
      "Proplytic provides analytical tools and reports based on information entered by users.",
      "Users remain responsible for verifying:"
    ],
    list: [
      "Investment assumptions",
      "Financial projections",
      "Report outputs",
      "Investment decisions"
    ],
    subsections: [
      {
        title: "Important disclaimer",
        paragraphs: ["Proplytic does not provide:"],
        list: ["Financial advice", "Investment advice", "Legal advice", "Tax advice"]
      }
    ]
  },
  {
    id: "subscription-plans",
    title: "Subscription Plans",
    paragraphs: [
      "Certain features may be restricted according to your subscription plan.",
      "Plans may include limits on:"
    ],
    list: ["Properties", "Reports", "Analytics", "Calculators", "Application links"]
  },
  {
    id: "intellectual-property",
    title: "Intellectual Property",
    paragraphs: [
      "All software, branding, content, design, and functionality of Proplytic remain the property of Proplytic or its licensors.",
      "You retain ownership of data you upload or enter into the platform, subject to the rights we need to host and operate the service for you."
    ]
  },
  {
    id: "acceptable-use",
    title: "Acceptable Use",
    paragraphs: ["Users may not:"],
    list: [
      "Attempt unauthorised access to systems or accounts",
      "Interfere with platform operation",
      "Upload malicious code",
      "Use the service unlawfully"
    ]
  },
  {
    id: "availability",
    title: "Availability",
    paragraphs: [
      "We aim to keep Proplytic available, but we do not guarantee uninterrupted or error-free access. Maintenance, outages, or third-party failures may affect availability from time to time."
    ]
  },
  {
    id: "limitation-of-liability",
    title: "Limitation of Liability",
    paragraphs: ["To the extent permitted by South African law, Proplytic is not liable for:"],
    list: [
      "Investment losses",
      "Business losses",
      "Indirect or consequential damages",
      "Decisions made using reports or outputs generated in the application"
    ],
    afterList: [
      "Nothing in these Terms excludes liability that cannot be excluded under applicable law."
    ]
  },
  {
    id: "termination",
    title: "Termination",
    paragraphs: [
      "We may suspend or terminate access to accounts that violate these Terms or that pose a security or abuse risk.",
      "You may stop using the service at any time. Some obligations (for example, regarding data you entered) may survive termination where reasonably required."
    ]
  },
  {
    id: "changes",
    title: "Changes",
    paragraphs: [
      "We may update these Terms from time to time. When we do, we will revise the “Last updated” date at the top of this page. Continued use of Proplytic after changes take effect means you accept the updated Terms."
    ]
  },
  {
    id: "governing-law",
    title: "Governing Law",
    paragraphs: ["These Terms are governed by the laws of the Republic of South Africa."]
  },
  {
    id: "contact",
    title: "Contact",
    paragraphs: [
      "For questions about these Terms, contact us using the details below or the Contact page on this website."
    ]
  }
];
