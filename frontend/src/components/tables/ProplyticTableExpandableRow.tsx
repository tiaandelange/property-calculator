import { ChevronDown } from "lucide-react";
import type { ReactNode } from "react";
import { Button } from "../ui/Button";

export function ProplyticTableExpandToggle({
  expanded,
  onToggle,
  label = "Toggle row details"
}: {
  expanded: boolean;
  onToggle: () => void;
  label?: string;
}) {
  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      className={`pg-ptable-expand-toggle${expanded ? " pg-ptable-expand-toggle--open" : ""}`}
      aria-expanded={expanded}
      aria-label={label}
      onClick={(e) => {
        e.stopPropagation();
        onToggle();
      }}
    >
      <ChevronDown size={16} aria-hidden />
    </Button>
  );
}

export function ProplyticTableExpandedRow({
  colSpan,
  visible,
  children
}: {
  colSpan: number;
  visible: boolean;
  children: ReactNode;
}) {
  if (!visible) return null;

  return (
    <tr className="pg-ptable__row--expanded">
      <td colSpan={colSpan} className="pg-ptable-expanded-cell">
        {children}
      </td>
    </tr>
  );
}

export function ProplyticTableExpandedFields({
  fields
}: {
  fields: Array<{ label: string; value: ReactNode }>;
}) {
  return (
    <dl className="pg-ptable-expanded-fields">
      {fields.map((field) => (
        <div key={field.label} className="pg-ptable-expanded-fields__item">
          <dt>{field.label}</dt>
          <dd>{field.value}</dd>
        </div>
      ))}
    </dl>
  );
}
