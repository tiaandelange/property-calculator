import { AppIcon, type IconName } from "../icons";

export function PropertyTypeTile({
  title,
  description,
  icon,
  selected,
  onClick
}: {
  title: string;
  description: string;
  icon: IconName;
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      className="pg-prop-type-tile"
      data-selected={selected ? "true" : "false"}
      onClick={onClick}
      aria-pressed={selected}
    >
      <div className="pg-prop-type-tile__icon" aria-hidden="true">
        <AppIcon name={icon} size="lg" />
      </div>
      <div className="pg-prop-type-tile__copy">
        <div className="pg-prop-type-tile__title">{title}</div>
        <div className="pg-prop-type-tile__desc">{description}</div>
      </div>
      {selected ? (
        <span className="pg-prop-type-tile__selected" aria-hidden="true">
          <AppIcon name="save" size="sm" />
        </span>
      ) : null}
    </button>
  );
}

