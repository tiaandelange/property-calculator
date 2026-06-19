import type { ReactNode } from "react";
import { MobileSettingsHeader } from "./MobileSettingsHeader";

type MobileSettingsScreenProps = {
  title: string;
  onBack: () => void;
  children: ReactNode;
  footer?: ReactNode;
};

export function MobileSettingsScreen({ title, onBack, children, footer }: MobileSettingsScreenProps) {
  return (
    <div className="pg-settings-mobile-screen">
      <MobileSettingsHeader title={title} onBack={onBack} backLabel="Back to settings" />
      <div className="pg-settings-mobile-screen__body">{children}</div>
      {footer ? <div className="pg-settings-mobile-screen__footer">{footer}</div> : null}
    </div>
  );
}
