import { ProfileAvatarDisplay } from "./settingsShared";
import { MobileSettingsGroup } from "./MobileSettingsGroup";
import { MobileSettingsHeader } from "./MobileSettingsHeader";
import { MobileSettingsNavRow } from "./MobileSettingsNavRow";
import {
  MOBILE_SETTINGS_MENU_GROUPS,
  mobileSettingsMenuByGroup,
  type MobileSettingsMenuItem
} from "./mobileSettingsMenu";
import type { SettingsSectionId } from "./settingsSections";

type MobileSettingsHomeProps = {
  fullName: string;
  email: string;
  avatarUrl: string | null;
  avatarIcon: string | null;
  planName: string;
  onBack: () => void;
  onSelectSection: (sectionId: SettingsSectionId) => void;
  subtitleForItem: (item: MobileSettingsMenuItem) => string | undefined;
};

export function MobileSettingsHome({
  fullName,
  email,
  avatarUrl,
  avatarIcon,
  planName,
  onBack,
  onSelectSection,
  subtitleForItem
}: MobileSettingsHomeProps) {
  return (
    <div className="pg-settings-mobile-home">
      <MobileSettingsHeader title="Settings" onBack={onBack} backLabel="Back to dashboard" />

      <div className="pg-settings-mobile-home__profile">
        <div className="pg-settings-mobile-home__avatar" aria-hidden>
          <ProfileAvatarDisplay
            avatarUrl={avatarUrl}
            avatarIcon={avatarIcon}
            fullName={fullName}
            email={email}
          />
        </div>
        <div className="pg-settings-mobile-home__profile-text">
          <strong>{fullName || "Your profile"}</strong>
          <span>{email}</span>
          <span className="pg-settings-mobile-home__plan">{planName}</span>
        </div>
      </div>

      <div className="pg-settings-mobile-home__groups">
        {MOBILE_SETTINGS_MENU_GROUPS.map((group) => {
          const items = mobileSettingsMenuByGroup(group);
          if (!items.length) return null;

          return (
            <MobileSettingsGroup key={group} label={group}>
              {items.map((item) => (
                <MobileSettingsNavRow
                  key={item.key}
                  icon={item.icon}
                  label={item.menuLabel}
                  subtitle={subtitleForItem(item)}
                  href={item.kind === "link" ? item.href : undefined}
                  onClick={
                    item.kind === "section"
                      ? () => onSelectSection(item.sectionId)
                      : undefined
                  }
                />
              ))}
            </MobileSettingsGroup>
          );
        })}
      </div>
    </div>
  );
}
