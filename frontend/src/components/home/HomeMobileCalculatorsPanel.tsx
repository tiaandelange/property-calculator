import { Link } from "react-router-dom";
import { getMobileFeaturedCalculatorGroups } from "../../data/mobileCalculatorMenu";
import { CalculatorIconDisplay } from "../icons/CalculatorIconDisplay";

const FEATURED_GROUPS = getMobileFeaturedCalculatorGroups();

export function HomeMobileCalculatorsPanel({
  open,
  panelId,
  onNavigate
}: {
  open: boolean;
  panelId: string;
  onNavigate?: () => void;
}) {
  return (
    <div
      id={panelId}
      className={`pg-home-site-drawer-calculators-panel${open ? " open" : " closed"}`}
      aria-hidden={!open}
    >
      <div className="pg-home-site-drawer-calculators-panel-inner">
        {FEATURED_GROUPS.map((group) => (
          <section key={group.title} className="pg-home-site-drawer-calc-card">
            <h3 className="pg-home-site-drawer-calc-card-title">{group.title}</h3>
            <ul className="pg-home-site-drawer-calc-list">
              {group.items.map((item) => (
                <li key={item.slug}>
                  <Link
                    to={item.route}
                    className="pg-home-site-drawer-calc-row"
                    onClick={onNavigate}
                  >
                    <CalculatorIconDisplay
                      slug={item.slug}
                      size="sm"
                      contained={false}
                      className="pg-home-site-drawer-calc-row-icon"
                    />
                    <span className="pg-home-site-drawer-calc-row-label">{item.name}</span>
                    <span className="pg-home-site-drawer-calc-row-chevron" aria-hidden>
                      →
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </div>
  );
}
