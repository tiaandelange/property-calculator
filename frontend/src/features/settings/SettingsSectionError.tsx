import { Button } from "../../components/ui/Button";

type SettingsSectionErrorProps = {
  message: string;
  onRetry?: () => void;
  retrying?: boolean;
};

export function SettingsSectionError({ message, onRetry, retrying }: SettingsSectionErrorProps) {
  return (
    <div className="pg-settings-section-error" role="alert">
      <p>{message}</p>
      {onRetry ? (
        <Button type="button" variant="outline" size="sm" onClick={onRetry} loading={retrying}>
          Retry
        </Button>
      ) : null}
    </div>
  );
}
