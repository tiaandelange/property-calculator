import { Navigate, Route, Routes, useParams } from "react-router-dom";
import { AppChrome } from "../layouts/AppChrome";
import { HomePage } from "../pages/HomePage";
import { CalculatorPage } from "../pages/CalculatorPage";
import { CalculatorHubPage } from "../pages/CalculatorHubPage";
import { LoginPage } from "../pages/LoginPage";
import { ConfirmEmailPage } from "../pages/ConfirmEmailPage";
import { DashboardPage } from "../pages/DashboardPage";
import { SimplePage } from "../pages/SimplePage";
import { AccountPage } from "../pages/AccountPage";
import { SubscriptionPage } from "../pages/SubscriptionPage";
import { SubscriptionResultPage } from "../pages/SubscriptionResultPage";
import { RequireAuth } from "../components/auth/RequireAuth";
import { OwnedPropertyFormPage } from "../pages/OwnedPropertyFormPage";
import { OwnedPropertyDetailPage } from "../pages/OwnedPropertyDetailPage";
import { OwnedLeasesPage } from "../pages/OwnedLeasesPage";
import { LeaseFormPage } from "../pages/LeaseFormPage";
import { LeaseDetailRedirect } from "../pages/LeaseDetailRedirect";
import { FinancialsListPage } from "../pages/FinancialsListPage";
import { OwnedInvoicesPage } from "../pages/OwnedInvoicesPage";
import { InvoicesListPage } from "../pages/InvoicesListPage";
import { OwnedRecurringInvoicesPage } from "../pages/OwnedRecurringInvoicesPage";
import { OwnedDocumentsPage } from "../pages/OwnedDocumentsPage";
import { PropertyReportPage } from "../pages/PropertyReportPage";
import { OwnedEquityMetricsPage } from "../pages/OwnedEquityMetricsPage";
import { OwnedLeaseMetricsPage } from "../pages/OwnedLeaseMetricsPage";
import { OwnedRentDueMetricsPage } from "../pages/OwnedRentDueMetricsPage";
import { OwnedDepositsMetricsPage } from "../pages/OwnedDepositsMetricsPage";
import { OwnedCashFlowMetricsPage } from "../pages/OwnedCashFlowMetricsPage";
import { OwnedPropertiesMyPropertiesPage } from "../pages/OwnedPropertiesMyPropertiesPage";
import { OwnedPropertiesPortfolioDashboardPage } from "../pages/OwnedPropertiesPortfolioDashboardPage";
import { OwnedPropertiesReportsPage } from "../pages/OwnedPropertiesReportsPage";
import { TenantsListPage } from "../pages/TenantsListPage";
import { ApplicantApplyPage } from "../pages/ApplicantApplyPage";
import { TenantFormPage } from "../pages/TenantFormPage";
import { TenantWorkspacePage } from "../pages/TenantWorkspacePage";
import { InvoiceDetailPage, LegacyTenantInvoiceRedirect } from "../pages/InvoiceDetailPage";
import { OwnedValuationsMetricsPage } from "../pages/OwnedValuationsMetricsPage";
import { OwnedBondsMetricsPage } from "../pages/OwnedBondsMetricsPage";
import { OwnedReturnsMetricsPage } from "../pages/OwnedReturnsMetricsPage";
import { OwnedExpensesMetricsPage } from "../pages/OwnedExpensesMetricsPage";
import { SettingsPage } from "../pages/SettingsPage";
import { AdminPanelPage } from "../pages/AdminPanelPage";

function OwnedPropertyFinancialsRedirect() {
  const { id } = useParams();
  return <Navigate to={`/owned-properties/${id}?tab=financials`} replace />;
}

export function App() {
  return (
    <Routes>
      <Route element={<AppChrome />}>
        <Route path="/" element={<HomePage />} />
        <Route path="/calculators" element={<CalculatorHubPage />} />
        <Route path="/calculators/:slug" element={<CalculatorPage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/apply/:token" element={<ApplicantApplyPage />} />
        <Route path="/confirm-email" element={<ConfirmEmailPage />} />
        <Route path="/confirm-email/:token" element={<ConfirmEmailPage />} />
        <Route path="/dashboard" element={<RequireAuth><DashboardPage /></RequireAuth>} />
        <Route
          path="/learn"
          element={
            <SimplePage
              title="Learn / Blog"
              description="Educational content hub for property investing strategies, tax notes, and finance guides."
            />
          }
        />
        <Route
          path="/contact"
          element={
            <SimplePage
              title="Contact"
              description="Contact form page for investor enquiries and partnerships."
            />
          }
        />
        <Route path="/about" element={<SimplePage title="About" description="About The Property Guy and our mission." />} />
        {/* TODO(legal): Replace placeholder bodies with published policies before launch. */}
        <Route
          path="/privacy"
          element={
            <SimplePage
              title="Privacy Policy"
              description="Placeholder page — the full privacy policy will be published here. Linked from the marketing footer until content is ready."
            />
          }
        />
        <Route
          path="/terms"
          element={
            <SimplePage
              title="Terms of Use"
              description="Placeholder page — the full terms of use will be published here. Linked from the marketing footer until content is ready."
            />
          }
        />
        <Route
          path="/cookie-notice"
          element={
            <SimplePage
              title="Cookie Notice"
              description="Placeholder page — the cookie notice will be published here. Linked from the marketing footer until content is ready."
            />
          }
        />
        <Route path="/admin" element={<RequireAuth><AdminPanelPage /></RequireAuth>} />
        <Route
          path="/help"
          element={
            <SimplePage
              title="Help centre"
              description="Guides, tips, and answers for using portfolio tools and calculators."
            />
          }
        />
        <Route
          path="/faq"
          element={
            <SimplePage
              title="Frequently asked questions"
              description="Common questions about accounts, billing, and property tools."
            />
          }
        />
        <Route
          path="/feedback"
          element={
            <SimplePage
              title="Feedback"
              description="Share product feedback or report a problem. We read every message."
            />
          }
        />
        <Route path="/settings" element={<RequireAuth><SettingsPage /></RequireAuth>} />
        <Route path="/settings/security" element={<RequireAuth><Navigate to="/settings" replace /></RequireAuth>} />
        <Route path="/settings/notifications" element={<RequireAuth><Navigate to="/settings" replace /></RequireAuth>} />
        <Route path="/owned-properties" element={<RequireAuth><Navigate to="/owned-properties/dashboard" replace /></RequireAuth>} />
        <Route
          path="/owned-properties/my-properties"
          element={<RequireAuth><OwnedPropertiesMyPropertiesPage /></RequireAuth>}
        />
        <Route
          path="/owned-properties/dashboard"
          element={<RequireAuth><OwnedPropertiesPortfolioDashboardPage /></RequireAuth>}
        />
        <Route path="/owned-properties/metrics/equity" element={<RequireAuth><OwnedEquityMetricsPage /></RequireAuth>} />
        <Route path="/owned-properties/metrics/valuations" element={<RequireAuth><OwnedValuationsMetricsPage /></RequireAuth>} />
        <Route path="/owned-properties/metrics/bonds" element={<RequireAuth><OwnedBondsMetricsPage /></RequireAuth>} />
        <Route path="/owned-properties/metrics/returns" element={<RequireAuth><OwnedReturnsMetricsPage /></RequireAuth>} />
        <Route path="/owned-properties/metrics/expenses" element={<RequireAuth><OwnedExpensesMetricsPage /></RequireAuth>} />
        <Route path="/owned-properties/metrics/leases" element={<RequireAuth><OwnedLeaseMetricsPage /></RequireAuth>} />
        <Route path="/owned-properties/metrics/rent-due" element={<RequireAuth><OwnedRentDueMetricsPage /></RequireAuth>} />
        <Route path="/owned-properties/metrics/deposits" element={<RequireAuth><OwnedDepositsMetricsPage /></RequireAuth>} />
        <Route path="/owned-properties/metrics/cash-flow" element={<RequireAuth><OwnedCashFlowMetricsPage /></RequireAuth>} />
        <Route path="/owned-properties/new" element={<RequireAuth><OwnedPropertyFormPage /></RequireAuth>} />
        <Route path="/owned-properties/:id/edit" element={<RequireAuth><OwnedPropertyFormPage /></RequireAuth>} />
        <Route path="/owned-properties/:id/financials" element={<RequireAuth><OwnedPropertyFinancialsRedirect /></RequireAuth>} />
        <Route path="/owned-properties/:id/report" element={<RequireAuth><PropertyReportPage /></RequireAuth>} />
        <Route path="/owned-properties/:id" element={<RequireAuth><OwnedPropertyDetailPage /></RequireAuth>} />
        <Route path="/owned-properties/tenants" element={<RequireAuth><Navigate to="/tenants" replace /></RequireAuth>} />
        <Route path="/owned-properties/leases" element={<RequireAuth><Navigate to="/leases" replace /></RequireAuth>} />
        <Route path="/owned-properties/financials" element={<RequireAuth><Navigate to="/financials" replace /></RequireAuth>} />
        <Route path="/owned-properties/invoices" element={<RequireAuth><Navigate to="/invoices" replace /></RequireAuth>} />
        <Route path="/owned-properties/documents" element={<RequireAuth><Navigate to="/documents" replace /></RequireAuth>} />
        <Route
          path="/owned-properties/recurring-invoices"
          element={<RequireAuth><OwnedRecurringInvoicesPage /></RequireAuth>}
        />
        <Route
          path="/owned-properties/reports"
          element={<RequireAuth><OwnedPropertiesReportsPage /></RequireAuth>}
        />

        <Route path="/leases" element={<RequireAuth><OwnedLeasesPage /></RequireAuth>} />
        <Route path="/leases/new" element={<RequireAuth><LeaseFormPage /></RequireAuth>} />
        <Route path="/leases/:id/edit" element={<RequireAuth><LeaseFormPage /></RequireAuth>} />
        <Route path="/leases/:id" element={<RequireAuth><LeaseDetailRedirect /></RequireAuth>} />
        <Route path="/financials" element={<RequireAuth><FinancialsListPage /></RequireAuth>} />
        <Route path="/invoices" element={<RequireAuth><InvoicesListPage /></RequireAuth>} />
        <Route path="/invoices/new" element={<RequireAuth><InvoiceDetailPage /></RequireAuth>} />
        <Route path="/invoices/:invoiceId" element={<RequireAuth><InvoiceDetailPage /></RequireAuth>} />
        <Route path="/invoices/legacy" element={<RequireAuth><OwnedInvoicesPage /></RequireAuth>} />
        <Route path="/documents" element={<RequireAuth><OwnedDocumentsPage /></RequireAuth>} />
        <Route path="/tenants" element={<RequireAuth><TenantsListPage /></RequireAuth>} />
        <Route path="/tenants/new" element={<RequireAuth><TenantFormPage /></RequireAuth>} />
        <Route path="/tenants/:id/invoices/new" element={<RequireAuth><LegacyTenantInvoiceRedirect /></RequireAuth>} />
        <Route path="/tenants/:id/invoices/:invoiceId" element={<RequireAuth><LegacyTenantInvoiceRedirect /></RequireAuth>} />
        <Route path="/tenants/:id" element={<RequireAuth><TenantWorkspacePage /></RequireAuth>} />
        <Route path="/tenants/:id/edit" element={<RequireAuth><TenantFormPage /></RequireAuth>} />
        <Route path="/account" element={<RequireAuth><AccountPage /></RequireAuth>} />
        <Route path="/subscription" element={<SubscriptionPage />} />
        <Route path="/subscription/success" element={<SubscriptionResultPage mode="success" />} />
        <Route path="/subscription/cancel" element={<SubscriptionResultPage mode="cancel" />} />
      </Route>
    </Routes>
  );
}
