/** Cookie Notice copy — describes technologies Proplytic currently uses. */

export const COOKIE_NOTICE_LAST_UPDATED = "3 June 2026";

export const COOKIE_NOTICE_SEO = {
  title: "Cookie Notice | Proplytic",
  description:
    "How Proplytic uses cookies and browser storage for sign-in, preferences, and reliable operation — without third-party advertising trackers."
} as const;

export type CookieNoticeSection = {
  id: string;
  title: string;
  paragraphs?: string[];
  list?: string[];
  afterList?: string[];
  subsections?: { title: string; paragraphs?: string[]; list: string[] }[];
};

export const COOKIE_NOTICE_SECTIONS: CookieNoticeSection[] = [
  {
    id: "what-are-cookies",
    title: "What Are Cookies",
    paragraphs: [
      "Cookies are small text files that websites store in your browser. They help sites remember information between visits or during a single visit.",
      "Proplytic also uses similar browser storage (such as local storage and session storage) for some preferences and short-lived application state. In this notice, “cookies” includes those technologies where they serve a similar purpose."
    ]
  },
  {
    id: "how-proplytic-uses-cookies",
    title: "How Proplytic Uses Cookies",
    paragraphs: [
      "We use cookies and browser storage only as needed to run the application. We do not use third-party advertising trackers, Google Analytics, Hotjar, or tracking pixels on this platform today."
    ],
    subsections: [
      {
        title: "Authentication",
        paragraphs: [
          "Our authentication provider may set cookies and/or use browser storage to:"
        ],
        list: [
          "Keep you signed in",
          "Maintain authenticated sessions",
          "Support security controls for your account"
        ]
      },
      {
        title: "Preferences",
        paragraphs: ["We store preferences in your browser to remember settings such as:"],
        list: [
          "Theme and colour scheme preferences",
          "Dashboard layout preferences (for example, sidebar state)",
          "Application settings you choose in the workspace"
        ]
      },
      {
        title: "Performance and reliability",
        paragraphs: ["We may use browser storage and technical logs to:"],
        list: [
          "Improve application performance",
          "Troubleshoot errors",
          "Maintain reliability (for example, recovering from a failed app update load)"
        ]
      }
    ]
  },
  {
    id: "third-party-services",
    title: "Third-Party Services",
    paragraphs: [
      "Some cookies or storage may be set or managed by service providers that help us operate Proplytic:"
    ],
    subsections: [
      {
        title: "Supabase",
        list: ["Authentication and session management"]
      },
      {
        title: "Vercel",
        list: ["Application hosting and delivery"]
      },
      {
        title: "Google",
        list: [
          "Authentication, only if you choose to sign in with Google when that sign-in option is available in the application"
        ]
      }
    ]
  },
  {
    id: "managing-cookies",
    title: "Managing Cookies",
    paragraphs: ["You may:"],
    list: [
      "Block cookies in your browser",
      "Clear cookies and browser storage at any time",
      "Disable cookies through your browser settings"
    ],
    afterList: [
      "If you block or delete cookies and storage used for sign-in or preferences, some features may stop working — including staying signed in, saved theme settings, and parts of the dashboard experience."
    ]
  },
  {
    id: "updates",
    title: "Updates",
    paragraphs: [
      "Our cookie and storage practices may change as the platform evolves. When we update this notice, we will revise the “Last updated” date at the top of this page."
    ]
  },
  {
    id: "contact",
    title: "Contact",
    paragraphs: [
      "For how we handle personal information, including data collected through cookies and browser storage, see our Privacy Policy."
    ]
  }
];
