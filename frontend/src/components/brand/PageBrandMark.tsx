import { Link } from "react-router-dom";
import { ProplyticLogo } from "./ProplyticLogo";

type PageBrandMarkProps = {
  linkToHome?: boolean;
};

/** Centered Proplytic logo for auth and standalone marketing pages. */
export function PageBrandMark({ linkToHome = false }: PageBrandMarkProps) {
  const logo = <ProplyticLogo mode="full" title="Proplytic" />;

  if (linkToHome) {
    return (
      <div className="pg-auth-logo-wrap">
        <Link to="/" aria-label="Proplytic — Home">
          {logo}
        </Link>
      </div>
    );
  }

  return <div className="pg-auth-logo-wrap">{logo}</div>;
}
