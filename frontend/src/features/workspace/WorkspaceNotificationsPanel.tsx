import { useEffect, useRef, useState } from "react";
import { Bell } from "lucide-react";
import { Link } from "react-router-dom";
import { useWorkspaceNotificationsQuery } from "../queries/useWorkspaceQueries";

export function WorkspaceNotificationsPanel({ className }: { className?: string }) {
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const [open, setOpen] = useState(false);
  const notificationsQuery = useWorkspaceNotificationsQuery();
  const notifications = notificationsQuery.data ?? [];
  const count = notifications.length;

  useEffect(() => {
    if (!open) return;
    function onDocMouseDown(e: MouseEvent) {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onDocMouseDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDocMouseDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={wrapRef} className={["pg-workspace-notifications", className].filter(Boolean).join(" ")}>
      <button
        type="button"
        className="pg-dashboard-shell-icon-btn pg-workspace-notifications-trigger"
        aria-label={count ? `${count} notifications` : "Notifications"}
        aria-expanded={open}
        aria-haspopup="dialog"
        onClick={() => setOpen((v) => !v)}
      >
        <Bell size={20} aria-hidden />
        {count > 0 ? (
          <span className="pg-workspace-notifications-badge" aria-hidden>
            {count > 9 ? "9+" : count}
          </span>
        ) : null}
      </button>
      {open ? (
        <div className="pg-workspace-notifications-panel pg-workspace-card" role="dialog" aria-label="Notifications">
          <div className="pg-workspace-notifications-panel__head">
            <h2 className="pg-workspace-notifications-panel__title">Notifications</h2>
            <Link to="/settings" className="pg-link" onClick={() => setOpen(false)}>
              Settings
            </Link>
          </div>
          {notificationsQuery.isFetching && !notifications.length ? (
            <div className="pg-workspace-notifications-empty pg-muted">Loading…</div>
          ) : null}
          {!notificationsQuery.isFetching && notifications.length === 0 ? (
            <div className="pg-workspace-notifications-empty pg-muted">No alerts right now.</div>
          ) : null}
          {notifications.length > 0 ? (
            <div className="pg-workspace-notifications-list">
              {notifications.map((n) => (
                <Link
                  key={n.id}
                  to={n.route}
                  className={`pg-workspace-notifications-item pg-workspace-notifications-item--${n.severity}`}
                  onClick={() => setOpen(false)}
                >
                  <div className="pg-workspace-notifications-item__title">{n.title}</div>
                  {n.subtitle ? <div className="pg-workspace-notifications-item__subtitle">{n.subtitle}</div> : null}
                </Link>
              ))}
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
