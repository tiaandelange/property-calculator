import { useState } from "react";
import { Button, ButtonLink } from "../../components/ui/Button";
import { openPropertyInvestmentReport } from "../../services/propertyReportOpen";

type WarmHandlers = {
  onMouseEnter?: () => void;
  onFocus?: () => void;
};

export function PropertyDirectoryRowActions({
  propertyId,
  warmHandlers
}: {
  propertyId: string;
  warmHandlers?: WarmHandlers;
}) {
  const [reportBusy, setReportBusy] = useState(false);

  return (
    <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
      <ButtonLink href={`/owned-properties/${propertyId}`} variant="ghost" {...warmHandlers}>
        View Property
      </ButtonLink>
      <ButtonLink href={`/owned-properties/${propertyId}/edit`} variant="ghost">
        Edit Property
      </ButtonLink>
      <Button
        type="button"
        variant="ghost"
        loading={reportBusy}
        onClick={() => {
          setReportBusy(true);
          void openPropertyInvestmentReport(propertyId).finally(() => setReportBusy(false));
        }}
      >
        Generate Report
      </Button>
    </div>
  );
}
