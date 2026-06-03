import { Link } from "react-router-dom";
import { AppIcon } from "../../components/icons/AppIcon";
import { ProplyticLogo } from "../../components/brand/ProplyticLogo";
import { LOGIN_BRAND_FEATURES } from "./loginPageContent";
import { LoginDashboardPreview } from "./LoginDashboardPreview";

export function LoginBrandPanel() {
  return (
    <aside className="pg-login-brand" aria-label="Proplytic overview">
      <div className="pg-login-brand__pattern" aria-hidden="true" />
      <div className="pg-login-brand__inner">
        <Link to="/" className="pg-login-brand__logo" aria-label="Proplytic — Home">
          <ProplyticLogo mode="full" title="Proplytic" />
        </Link>

        <h2 className="pg-login-brand__headline">
          <span className="pg-login-brand__headline-accent">Smarter property decisions</span>,{" "}
          <span className="pg-login-brand__headline-rest">less month-end chaos.</span>
        </h2>
        <p className="pg-login-brand__subhead">
          One workspace for portfolio analytics, rental admin and investor reports — connected data,
          cleaner decisions.
        </p>

        <ul className="pg-login-brand__features">
          {LOGIN_BRAND_FEATURES.map((row) => (
            <li key={row.title} className="pg-login-brand__feature">
              <span className="pg-login-brand__feature-icon" aria-hidden="true">
                <AppIcon name={row.icon} size="sm" />
              </span>
              <span className="pg-login-brand__feature-copy">
                <strong>{row.title}</strong>
                <span>{row.description}</span>
              </span>
            </li>
          ))}
        </ul>

        <LoginDashboardPreview />
      </div>
    </aside>
  );
}
