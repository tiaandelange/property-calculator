import { Link } from "react-router-dom";
import {
  AlertTriangle,
  Building2,
  DollarSign,
  FileText,
  UserRound,
  Wrench
} from "lucide-react";
import { buildActivityItems, type ActivityItem } from "./portfolioDashboardUtils";

const ICONS = {
  rent: DollarSign,
  lease: FileText,
  maintenance: Wrench,
  tenant: UserRound,
  warning: AlertTriangle,
  property: Building2
} as const;

function ActivityRow({ item }: { item: ActivityItem }) {
  const Icon = ICONS[item.kind];
  const body = (
    <div className="pg-pdash-activity-row">
      <span className={`pg-pdash-activity-icon pg-pdash-activity-icon--${item.kind}`}>
        <Icon size={16} aria-hidden />
      </span>
      <div className="pg-pdash-activity-main">
        <div className="pg-pdash-activity-title">{item.title}</div>
        {item.subtitle ? <div className="pg-pdash-activity-sub">{item.subtitle}</div> : null}
      </div>
      <time className="pg-pdash-activity-date" dateTime={item.dateLabel}>
        {item.dateLabel}
      </time>
    </div>
  );

  if (item.to) {
    return (
      <Link to={item.to} className="pg-pdash-activity-link">
        {body}
      </Link>
    );
  }
  return body;
}

export function RecentActivityPanel({
  data,
  limit
}: {
  data: Record<string, unknown> | null | undefined;
  /** When set, caps rows shown (desktop wide layouts). */
  limit?: number;
}) {
  const allItems = buildActivityItems(data);
  const items = limit != null ? allItems.slice(0, limit) : allItems;

  return (
    <div className="pg-workspace-card pg-pdash-panel pg-pdash-activity-panel">
      <div className="pg-pdash-panel-head">
        <h2 className="pg-pdash-panel-title">Recent Activity</h2>
      </div>
      <div className="pg-pdash-activity-list">
        {items.length ? (
          items.map((item) => <ActivityRow key={item.id} item={item} />)
        ) : (
          <p className="pg-pdash-empty-inline">No recent activity yet.</p>
        )}
      </div>
      {items.length ? (
        <div className="pg-pdash-panel-foot">
          <Link to="/financials" className="pg-pdash-view-all">
            View all
          </Link>
        </div>
      ) : null}
    </div>
  );
}
