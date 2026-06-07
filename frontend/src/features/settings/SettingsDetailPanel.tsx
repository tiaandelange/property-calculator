import type { ReactNode } from "react";
import { AppIcon, type IconName } from "../../components/icons";

type SettingsDetailPanelProps = {
  icon: IconName;
  title: string;
  description: string;
  badge?: string;
  headerActions?: ReactNode;
  children: ReactNode;
};

export function SettingsDetailPanel({
  icon,
  title,
  description,
  badge,
  headerActions,
  children
}: SettingsDetailPanelProps) {
  return (
    <section className="pg-settings-detail" aria-labelledby="pg-settings-detail-title">
      <header className="pg-settings-detail__head">
        <div className="pg-settings-detail__head-main">
          <div className="pg-settings-detail__icon" aria-hidden>
            <AppIcon name={icon} size="md" />
          </div>
          <div className="pg-settings-detail__titles">
            <h2 id="pg-settings-detail-title" className="pg-settings-detail__title">
              {title}
            </h2>
            <p className="pg-settings-detail__desc">{description}</p>
          </div>
          {badge ? <span className="pg-settings-badge">{badge}</span> : null}
        </div>
        {headerActions ? <div className="pg-settings-detail__actions">{headerActions}</div> : null}
      </header>
      <div className="pg-settings-detail__body">{children}</div>
    </section>
  );
}
