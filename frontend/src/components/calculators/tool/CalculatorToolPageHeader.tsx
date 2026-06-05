import { Bookmark, Share2 } from "lucide-react";
import { CalculatorIconDisplay } from "../../icons/CalculatorIconDisplay";
import { Button } from "../../ui/Button";

type CalculatorToolPageHeaderProps = {
  slug: string;
  heading: string;
  description: string;
  onSave: () => void;
  onShare: () => void;
  saveLoading?: boolean;
};

export function CalculatorToolPageHeader({
  slug,
  heading,
  description,
  onSave,
  onShare,
  saveLoading
}: CalculatorToolPageHeaderProps) {
  return (
    <header className="pg-calc-tool-header">
      <CalculatorIconDisplay slug={slug} size="lg" className="pg-calc-tool-header__icon" />
      <div className="pg-calc-tool-header__body">
        <div className="pg-calc-tool-header__title-row">
          <h1 className="pg-calc-tool-header__title">{heading}</h1>
          <div className="pg-calc-tool-header__actions">
            <Button
              type="button"
              variant="secondary"
              size="sm"
              className="pg-calc-tool-header__btn"
              onClick={onSave}
              loading={saveLoading}
            >
              <Bookmark size={15} strokeWidth={2} aria-hidden />
              Save Calculation
            </Button>
            <Button type="button" variant="secondary" size="sm" className="pg-calc-tool-header__btn" onClick={onShare}>
              <Share2 size={15} strokeWidth={2} aria-hidden />
              Share
            </Button>
          </div>
        </div>
        <p className="pg-calc-tool-header__desc">{description}</p>
      </div>
    </header>
  );
}
