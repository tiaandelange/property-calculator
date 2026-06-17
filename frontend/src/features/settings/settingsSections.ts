import type { IconName } from "../../components/icons";

export const SETTINGS_SECTION_IDS = [
  "general",
  "account",
  "appearance",
  "subscription",
  "invoice-banking",
  "notifications",
  "security",
  "data-export",
  "integrations"
] as const;

export type SettingsSectionId = (typeof SETTINGS_SECTION_IDS)[number];

export type SettingsSectionConfig = {
  id: SettingsSectionId;
  title: string;
  description: string;
  icon: IconName;
  /** Section edits shared UserSettings draft and shows Save/Cancel footer. */
  supportsSave: boolean;
  badge?: string;
};

export const SETTINGS_SECTIONS: SettingsSectionConfig[] = [
  {
    id: "general",
    title: "General",
    description: "Workspace defaults and regional preferences.",
    icon: "sliders",
    supportsSave: true
  },
  {
    id: "account",
    title: "Account & Profile",
    description: "Identity, email and workspace role.",
    icon: "profile",
    supportsSave: false
  },
  {
    id: "appearance",
    title: "Appearance",
    description: "Theme, accent colour and density.",
    icon: "palette",
    supportsSave: true
  },
  {
    id: "subscription",
    title: "Subscription & Billing",
    description: "Plan, usage limits and billing status.",
    icon: "payments",
    supportsSave: false
  },
  {
    id: "invoice-banking",
    title: "Invoice & Banking Details",
    description: "Default invoice and banking information.",
    icon: "invoices",
    supportsSave: true
  },
  {
    id: "notifications",
    title: "Notifications",
    description: "Email and app notification preferences.",
    icon: "bell",
    supportsSave: true
  },
  {
    id: "security",
    title: "Security",
    description: "Password and account security.",
    icon: "shield",
    supportsSave: false
  },
  {
    id: "data-export",
    title: "Data & Export",
    description: "Download or manage workspace data.",
    icon: "reports",
    supportsSave: false
  },
  {
    id: "integrations",
    title: "Integrations",
    description: "Connected services and future integrations.",
    icon: "plug",
    supportsSave: false
  }
];

const SECTION_BY_ID = new Map(SETTINGS_SECTIONS.map((s) => [s.id, s]));

export function getSettingsSection(id: SettingsSectionId): SettingsSectionConfig {
  return SECTION_BY_ID.get(id)!;
}

/** Map legacy hash / query values to a valid section id. */
export function resolveSettingsSection(raw: string | null | undefined): SettingsSectionId {
  const value = (raw ?? "").trim().toLowerCase();
  if (value && (SETTINGS_SECTION_IDS as readonly string[]).includes(value)) {
    return value as SettingsSectionId;
  }

  // Legacy section ids from older settings links.
  if (value === "workspace" || value === "applicant-form-template") return "general";

  return "general";
}

export function settingsSectionPath(section: SettingsSectionId, extra?: Record<string, string>): string {
  const params = new URLSearchParams({ section });
  if (extra) {
    for (const [key, val] of Object.entries(extra)) {
      if (val) params.set(key, val);
    }
  }
  return `/settings?${params.toString()}`;
}
