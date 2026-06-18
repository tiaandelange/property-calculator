import type { IconName } from "../../components/icons";

export type ProfileAvatarIconId =
  | "property"
  | "units"
  | "profile"
  | "reports"
  | "shield"
  | "lock"
  | "document"
  | "wallet";

export const PROFILE_AVATAR_ICONS: Array<{ id: ProfileAvatarIconId; icon: IconName; label: string }> = [
  { id: "property", icon: "property", label: "House" },
  { id: "units", icon: "units", label: "Building" },
  { id: "profile", icon: "profile", label: "Landlord" },
  { id: "reports", icon: "reports", label: "Analytics" },
  { id: "document", icon: "document", label: "Documents" },
  { id: "wallet", icon: "wallet", label: "Wallet" },
  { id: "shield", icon: "shield", label: "Security" },
  { id: "lock", icon: "lock", label: "Key" }
];

export const DEFAULT_PROFILE_AVATAR_ICON: ProfileAvatarIconId = "property";

export function normalizeProfileAvatarIcon(value: unknown): ProfileAvatarIconId {
  const id = String(value ?? "").trim() as ProfileAvatarIconId;
  return PROFILE_AVATAR_ICONS.some((item) => item.id === id) ? id : DEFAULT_PROFILE_AVATAR_ICON;
}

export function profileAvatarIconName(iconId: ProfileAvatarIconId): IconName {
  return PROFILE_AVATAR_ICONS.find((item) => item.id === iconId)?.icon ?? "property";
}
