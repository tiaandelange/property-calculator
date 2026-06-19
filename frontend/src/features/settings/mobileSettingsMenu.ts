import type { IconName } from "../../components/icons";
import type { SettingsMobileGroup, SettingsSectionId } from "./settingsSections";

export type MobileSettingsMenuItem =
  | {
      key: string;
      kind: "section";
      sectionId: SettingsSectionId;
      menuLabel: string;
      group: SettingsMobileGroup;
      icon: IconName;
    }
  | {
      key: string;
      kind: "link";
      href: string;
      menuLabel: string;
      group: SettingsMobileGroup;
      icon: IconName;
      subtitle?: string;
    };

export const MOBILE_SETTINGS_MENU_GROUPS: SettingsMobileGroup[] = [
  "Account",
  "General",
  "Communication",
  "Data"
];

/** Mobile settings home menu — maps to existing section content or support links. */
export const MOBILE_SETTINGS_MENU: MobileSettingsMenuItem[] = [
  {
    key: "profile",
    kind: "section",
    sectionId: "account",
    menuLabel: "Profile",
    group: "Account",
    icon: "profile"
  },
  {
    key: "company",
    kind: "section",
    sectionId: "general",
    menuLabel: "Company / Landlord",
    group: "Account",
    icon: "sliders"
  },
  {
    key: "subscription",
    kind: "section",
    sectionId: "subscription",
    menuLabel: "Subscription and Billing",
    group: "Account",
    icon: "payments"
  },
  {
    key: "security",
    kind: "section",
    sectionId: "security",
    menuLabel: "Security",
    group: "Account",
    icon: "shield"
  },
  {
    key: "appearance",
    kind: "section",
    sectionId: "appearance",
    menuLabel: "Appearance",
    group: "General",
    icon: "palette"
  },
  {
    key: "invoice-banking",
    kind: "section",
    sectionId: "invoice-banking",
    menuLabel: "Invoice and Statement Settings",
    group: "General",
    icon: "invoices"
  },
  {
    key: "storage",
    kind: "section",
    sectionId: "account",
    menuLabel: "Storage Usage",
    group: "General",
    icon: "documents"
  },
  {
    key: "notifications",
    kind: "section",
    sectionId: "notifications",
    menuLabel: "Email and Notifications",
    group: "Communication",
    icon: "bell"
  },
  {
    key: "reminders",
    kind: "section",
    sectionId: "invoice-banking",
    menuLabel: "Reminders",
    group: "Communication",
    icon: "calendar"
  },
  {
    key: "integrations",
    kind: "section",
    sectionId: "integrations",
    menuLabel: "Integrations",
    group: "Communication",
    icon: "plug"
  },
  {
    key: "data-export",
    kind: "section",
    sectionId: "data-export",
    menuLabel: "Data and Exports",
    group: "Data",
    icon: "reports"
  },
  {
    key: "help",
    kind: "link",
    href: "/help",
    menuLabel: "Help and Support",
    group: "Data",
    icon: "help",
    subtitle: "Guides and contact"
  }
];

export function mobileSettingsMenuByGroup(group: SettingsMobileGroup): MobileSettingsMenuItem[] {
  return MOBILE_SETTINGS_MENU.filter((item) => item.group === group);
}
