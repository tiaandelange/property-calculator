import { ArrowLeft } from "lucide-react";
import { Button } from "../../components/ui/Button";

type MobileSettingsHeaderProps = {
  title: string;
  onBack: () => void;
  backLabel?: string;
};

export function MobileSettingsHeader({ title, onBack, backLabel = "Go back" }: MobileSettingsHeaderProps) {
  return (
    <header className="pg-settings-mobile-header">
      <Button
        type="button"
        variant="ghost"
        className="pg-settings-mobile-header__back"
        aria-label={backLabel}
        onClick={onBack}
      >
        <ArrowLeft size={20} aria-hidden />
      </Button>
      <h1 className="pg-settings-mobile-header__title">{title}</h1>
      <span className="pg-settings-mobile-header__spacer" aria-hidden />
    </header>
  );
}
