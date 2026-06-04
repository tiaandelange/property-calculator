import { useId, useState } from "react";
import { ChevronRight } from "lucide-react";
import { Link } from "react-router-dom";
import type { ReportsHubDirectoryItem } from "../../data/reportsHubDirectory";
import { MARKETING_SIGNUP_FREE_HREF } from "../../data/homepageMarketingContent";
import { IconContainerByName } from "../icons";

type ReportsDirectoryCardProps = {
  item: ReportsHubDirectoryItem;
};

export function ReportsDirectoryCard({ item }: ReportsDirectoryCardProps) {
  const [expanded, setExpanded] = useState(false);
  const detailId = useId();

  return (
    <article className={`pg-reports-hub-dir-card${expanded ? " is-expanded" : ""}`}>
      <button
        type="button"
        className="pg-reports-hub-dir-card__trigger"
        aria-expanded={expanded}
        aria-controls={detailId}
        onClick={() => setExpanded((open) => !open)}
      >
        <IconContainerByName
          icon={item.icon}
          accent="purple"
          size="md"
          className="pg-reports-hub-dir-card__icon"
        />
        <div className="pg-reports-hub-dir-card__body">
          <h3 className="pg-reports-hub-dir-card__title">{item.title}</h3>
          <p className="pg-reports-hub-dir-card__desc pg-reports-hub-dir-card__desc--desktop">{item.description}</p>
          <p className="pg-reports-hub-dir-card__desc pg-reports-hub-dir-card__desc--mobile">
            {item.descriptionMobile}
          </p>
          <p className="pg-reports-hub-dir-card__useful pg-reports-hub-dir-card__useful--inline">
            <span className="pg-reports-hub-dir-card__useful-label">Useful for:</span> {item.usefulFor}
          </p>
        </div>
        <ChevronRight className="pg-reports-hub-dir-card__arrow" size={22} strokeWidth={2.25} aria-hidden />
      </button>
      <div id={detailId} className="pg-reports-hub-dir-card__detail">
        <p className="pg-reports-hub-dir-card__useful">
          <span className="pg-reports-hub-dir-card__useful-label">Useful for:</span> {item.usefulFor}
        </p>
        <Link to={MARKETING_SIGNUP_FREE_HREF} className="pg-reports-hub-dir-card__included">
          Included in Proplytic
        </Link>
      </div>
    </article>
  );
}
