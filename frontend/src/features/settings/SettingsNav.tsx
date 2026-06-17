import { Link } from "react-router-dom";
import { AppIcon } from "../../components/icons";
import { Select } from "../../components/ui/Input";
import type { SettingsSectionConfig, SettingsSectionId } from "./settingsSections";

type SettingsNavProps = {
  sections: SettingsSectionConfig[];
  activeId: SettingsSectionId;
  onSelect: (id: SettingsSectionId) => void;
  mobile?: boolean;
};

export function SettingsNav({ sections, activeId, onSelect, mobile }: SettingsNavProps) {
  if (mobile) {
    return (
      <div className="pg-settings-nav-mobile">
        <label className="pg-settings-nav-mobile__label" htmlFor="pg-settings-section-select">
          Section
        </label>
        <Select
          id="pg-settings-section-select"
          className="pg-settings-nav-mobile__select"
          value={activeId}
          onChange={(e) => onSelect(e.target.value as SettingsSectionId)}
        >
          {sections.map((section) => (
            <option key={section.id} value={section.id}>
              {section.title}
            </option>
          ))}
        </Select>
      </div>
    );
  }

  return (
    <nav className="pg-settings-panel-nav" aria-label="Settings sections">
      <ul className="pg-settings-panel-nav__list">
        {sections.map((section) => {
          const active = section.id === activeId;
          return (
            <li key={section.id}>
              <button
                type="button"
                className={`pg-settings-panel-nav__item${active ? " pg-settings-panel-nav__item--active" : ""}`}
                aria-current={active ? "page" : undefined}
                onClick={() => onSelect(section.id)}
              >
                <AppIcon name={section.icon} size="sm" className="pg-settings-panel-nav__icon" />
                <span className="pg-settings-panel-nav__title">{section.title}</span>
                {section.badge ? (
                  <span className="pg-settings-badge pg-settings-panel-nav__badge">{section.badge}</span>
                ) : null}
              </button>
            </li>
          );
        })}
      </ul>

      <div className="pg-settings-panel-nav__support">
        <p className="pg-settings-panel-nav__support-label">Support & legal</p>
        <Link className="pg-settings-panel-nav__support-link" to="/faq">
          FAQs
        </Link>
        <Link className="pg-settings-panel-nav__support-link" to="/help">
          Help & support
        </Link>
        <a className="pg-settings-panel-nav__support-link" href="/terms">
          Terms of service
        </a>
        <a className="pg-settings-panel-nav__support-link" href="/privacy">
          Privacy policy
        </a>
      </div>
    </nav>
  );
}
