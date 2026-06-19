import { ChevronRight } from "lucide-react";
import { Link } from "react-router-dom";
import { AppIcon } from "../../components/icons";
import type { IconName } from "../../components/icons";

type MobileSettingsNavRowProps = {
  icon: IconName;
  label: string;
  subtitle?: string;
  onClick?: () => void;
  href?: string;
};

export function MobileSettingsNavRow({ icon, label, subtitle, onClick, href }: MobileSettingsNavRowProps) {
  const content = (
    <>
      <span className="pg-settings-mobile-nav-row__icon" aria-hidden>
        <AppIcon name={icon} size="sm" />
      </span>
      <span className="pg-settings-mobile-nav-row__text">
        <span className="pg-settings-mobile-nav-row__label">{label}</span>
        {subtitle ? <span className="pg-settings-mobile-nav-row__subtitle">{subtitle}</span> : null}
      </span>
      <ChevronRight size={18} className="pg-settings-mobile-nav-row__chevron" aria-hidden />
    </>
  );

  if (href) {
    return (
      <Link className="pg-settings-mobile-nav-row" to={href}>
        {content}
      </Link>
    );
  }

  return (
    <button type="button" className="pg-settings-mobile-nav-row" onClick={onClick}>
      {content}
    </button>
  );
}
