import { Container } from "../ui/Container";

const TOPICS = [
  {
    title: "Portfolio health at a glance",
    body: "Summarise value, income, occupancy and equity across every property in one export."
  },
  {
    title: "Deal-ready investor packs",
    body: "Present yield, cash-on-cash, financing and projections without rebuilding spreadsheets."
  },
  {
    title: "Rental admin on record",
    body: "Pair operational reports with branded invoices and tenant statements from the same data."
  },
  {
    title: "Month-to-month profitability",
    body: "Show how vacancies, expenses and bond repayments affect net cash flow over time."
  }
] as const;

export function ReportsExplainSection() {
  return (
    <section className="pg-home-light-section pg-reports-hub-explain" aria-labelledby="reports-explain-heading">
      <Container className="pg-container pg-container--marketing-wide">
        <header className="pg-reports-hub-explain-header">
          <h2 id="reports-explain-heading" className="pg-h2">
            What Proplytic Reports Help You Explain
          </h2>
          <p className="pg-lead">
            Give owners, partners and tenants a clear PDF narrative — grounded in the property data you already manage.
          </p>
        </header>
        <ul className="pg-reports-hub-explain-grid">
          {TOPICS.map((topic) => (
            <li key={topic.title} className="pg-reports-hub-explain-card">
              <h3 className="pg-reports-hub-explain-card__title">{topic.title}</h3>
              <p className="pg-reports-hub-explain-card__body">{topic.body}</p>
            </li>
          ))}
        </ul>
      </Container>
    </section>
  );
}
