import { SettingsRow } from "../SettingsRow";
import { SettingsToggle } from "../settingsShared";

type SettingsSwitchRowProps = {
  label: string;
  checked: boolean;
  onChange: (value: boolean) => void;
  disabled?: boolean;
};

export function SettingsSwitchRow({ label, checked, onChange, disabled }: SettingsSwitchRowProps) {
  return (
    <SettingsRow label={label}>
      <SettingsToggle label={label} checked={checked} onChange={onChange} disabled={disabled} />
    </SettingsRow>
  );
}
