import type { ReactNode } from "react";

type SettingsDetailPanelProps = {
  title: string;
  badge?: string;
  headerActions?: ReactNode;
  children: ReactNode;
};

export function SettingsDetailPanel({ title, badge, headerActions, children }: SettingsDetailPanelProps) {
  return (
    <section className="pg-settings-panel-detail" aria-labelledby="pg-settings-detail-title">
      <header className="pg-settings-panel-detail__head">
        <div className="pg-settings-panel-detail__head-main">
          <h2 id="pg-settings-detail-title" className="pg-settings-panel-detail__title">
            {title}
          </h2>
          {badge ? <span className="pg-settings-badge">{badge}</span> : null}
        </div>
        {headerActions ? <div className="pg-settings-panel-detail__actions">{headerActions}</div> : null}
      </header>
      <div className="pg-settings-panel-detail__body pg-settings-panel-detail__scroll">{children}</div>
    </section>
  );
}
