import { IconContainerByName } from "../icons";
import { Container } from "../ui/Container";

const BENEFITS = [
  { icon: "pdf" as const, title: "Branded PDF output" },
  { icon: "reports" as const, title: "Investor-ready metrics" },
  { icon: "invoices" as const, title: "Tenant and invoice documents" },
  { icon: "download" as const, title: "Export when signed in" }
] as const;

export function ReportsBenefitsStrip() {
  return (
    <div className="pg-reports-hub-benefits">
      <Container className="pg-container pg-container--marketing-wide">
        <ul className="pg-reports-hub-benefits__list">
          {BENEFITS.map((item) => (
            <li key={item.title}>
              <IconContainerByName icon={item.icon} accent="purple" size="sm" />
              <span>{item.title}</span>
            </li>
          ))}
        </ul>
      </Container>
    </div>
  );
}
