/** Privacy Policy copy — public marketing page (static, not legal advice). */

export const PRIVACY_POLICY_LAST_UPDATED = "3 June 2026";

export const PRIVACY_POLICY_SEO = {
  title: "Privacy Policy | Proplytic",
  description:
    "Learn how Proplytic collects, uses, stores, and protects personal and property information for portfolio analytics and rental administration in South Africa."
} as const;

/** Placeholder until a dedicated privacy inbox is configured — also linked from /contact */
export const PRIVACY_POLICY_CONTACT_EMAIL = "privacy@proplytic.co.za";

export type PrivacyPolicySection = {
  id: string;
  title: string;
  paragraphs?: string[];
  list?: string[];
  subsections?: { title: string; list: string[] }[];
};

export const PRIVACY_POLICY_SECTIONS: PrivacyPolicySection[] = [
  {
    id: "introduction",
    title: "Introduction",
    paragraphs: [
      "Proplytic is a South African property portfolio analytics and property management platform.",
      "This Privacy Policy explains:"
    ],
    list: [
      "What information we collect",
      "How we use it",
      "Who we share it with",
      "How we protect it",
      "Your rights regarding your information"
    ]
  },
  {
    id: "information-we-collect",
    title: "Information We Collect",
    subsections: [
      {
        title: "Account information",
        list: ["Name", "Email address", "Authentication information"]
      },
      {
        title: "Property information",
        list: [
          "Property details",
          "Unit information",
          "Tenant information",
          "Lease information",
          "Invoices",
          "Statements",
          "Financial information entered by users"
        ]
      },
      {
        title: "Usage information",
        list: [
          "Browser information",
          "Device information",
          "IP address",
          "Application usage data",
          "Performance and error logs"
        ]
      }
    ]
  },
  {
    id: "how-we-use-information",
    title: "How We Use Information",
    paragraphs: ["We use information to:"],
    list: [
      "Provide the Proplytic platform",
      "Authenticate users",
      "Generate reports",
      "Generate invoices",
      "Generate statements",
      "Improve system performance",
      "Provide customer support",
      "Communicate important account updates"
    ]
  },
  {
    id: "third-party-service-providers",
    title: "Third-Party Service Providers",
    paragraphs: [
      "We use trusted service providers to operate Proplytic. Information may be processed by these providers solely for delivering Proplytic services.",
      "Our current providers include:"
    ],
    subsections: [
      {
        title: "Supabase",
        list: ["Authentication", "Database storage", "Security services"]
      },
      {
        title: "Vercel",
        list: ["Application hosting", "Application delivery"]
      },
      {
        title: "Resend",
        list: ["Transactional email delivery", "Invoice and notification emails"]
      },
      {
        title: "Google",
        list: [
          "Authentication, if you choose to sign in with Google when that sign-in option is available in the application"
        ]
      }
    ]
  },
  {
    id: "data-security",
    title: "Data Security",
    paragraphs: ["We apply reasonable technical and organisational measures, including:"],
    list: [
      "Encrypted connections (HTTPS) between your browser and our application",
      "Authentication controls for user accounts",
      "Access restrictions on production systems and data stores",
      "Security practices provided by our cloud infrastructure partners"
    ]
  },
  {
    id: "data-retention",
    title: "Data Retention",
    paragraphs: [
      "Your data remains available while your account is active and as needed to provide the services you use.",
      "You may request deletion of your account and associated data where reasonably possible, subject to legal, security, or operational requirements (for example, retaining certain records where the law requires it or where needed to resolve disputes)."
    ]
  },
  {
    id: "your-rights",
    title: "Your Rights",
    paragraphs: [
      "If you are in South Africa, the Protection of Personal Information Act (POPIA) may apply to our processing of your personal information. We are not claiming any certification under POPIA; this section describes rights you may have under applicable law.",
      "Depending on your circumstances, you may:"
    ],
    list: [
      "Request access to your personal information",
      "Request correction of inaccurate information",
      "Request deletion where appropriate",
      "Object to certain processing activities"
    ]
  },
  {
    id: "cookies-and-analytics",
    title: "Cookies and Analytics",
    paragraphs: [
      "We use cookies and browser storage that are necessary for sign-in, preferences, and reliable operation of the application."
    ]
  },
  {
    id: "children",
    title: "Children",
    paragraphs: ["Proplytic is not intended for individuals under 18 years of age."]
  },
  {
    id: "changes",
    title: "Changes",
    paragraphs: [
      "We may update this Privacy Policy from time to time. When we do, we will revise the “Last updated” date at the top of this page."
    ]
  },
  {
    id: "contact",
    title: "Contact",
    paragraphs: [
      "For privacy-related questions or requests, contact us using the details below or the Contact page on this website."
    ]
  }
];
