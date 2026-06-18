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
    description: "",
    icon: "sliders",
    supportsSave: true
  },
  {
    id: "account",
    title: "Account",
    description: "",
    icon: "profile",
    supportsSave: false
  },
  {
    id: "appearance",
    title: "Branding and Appearance",
    description: "",
    icon: "palette",
    supportsSave: true
  },
  {
    id: "subscription",
    title: "Subscription and Billing",
    description: "",
    icon: "payments",
    supportsSave: false
  },
  {
    id: "invoice-banking",
    title: "Invoice and Statement Settings",
    description: "",
    icon: "invoices",
    supportsSave: true
  },
  {
    id: "notifications",
    title: "Email and Notifications",
    description: "",
    icon: "bell",
    supportsSave: true
  },
  {
    id: "security",
    title: "Security",
    description: "",
    icon: "shield",
    supportsSave: false
  },
  {
    id: "data-export",
    title: "Data and Exports",
    description: "",
    icon: "reports",
    supportsSave: false
  },
  {
    id: "integrations",
    title: "Integrations",
    description: "",
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
