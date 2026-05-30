import { lazy, Suspense, type ReactElement, type ReactNode } from "react";
import { Navigate, Route, Routes, useParams } from "react-router-dom";
import { AppChrome } from "../layouts/AppChrome";
import { HomePage } from "../pages/HomePage";
import { LoginPage } from "../pages/LoginPage";
import { ConfirmEmailPage } from "../pages/ConfirmEmailPage";
import { SimplePage } from "../pages/SimplePage";
import { SubscriptionPage } from "../pages/SubscriptionPage";
import { SubscriptionResultPage } from "../pages/SubscriptionResultPage";
import { RequireAuth } from "../components/auth/RequireAuth";
import { RouteFallback } from "../components/ui/RouteFallback";

const CalculatorHubPage = lazy(() =>
  import("../pages/CalculatorHubPage").then((m) => ({ default: m.CalculatorHubPage }))
);
const CalculatorPage = lazy(() => import("../pages/CalculatorPage").then((m) => ({ default: m.CalculatorPage })));
const DashboardPage = lazy(() => import("../pages/DashboardPage").then((m) => ({ default: m.DashboardPage })));
const AccountPage = lazy(() => import("../pages/AccountPage").then((m) => ({ default: m.AccountPage })));
const ApplicantApplyPage = lazy(() =>
  import("../pages/ApplicantApplyPage").then((m) => ({ default: m.ApplicantApplyPage }))
);
const OwnedPropertyFormPage = lazy(() =>
  import("../pages/OwnedPropertyFormPage").then((m) => ({ default: m.OwnedPropertyFormPage }))
);
const OwnedPropertyDetailPage = lazy(() =>
  import("../pages/OwnedPropertyDetailPage").then((m) => ({ default: m.OwnedPropertyDetailPage }))
);
const OwnedLeasesPage = lazy(() => import("../pages/OwnedLeasesPage").then((m) => ({ default: m.OwnedLeasesPage })));
const LeaseFormPage = lazy(() => import("../pages/LeaseFormPage").then((m) => ({ default: m.LeaseFormPage })));
const LeaseDetailRedirect = lazy(() =>
  import("../pages/LeaseDetailRedirect").then((m) => ({ default: m.LeaseDetailRedirect }))
);
const FinancialsListPage = lazy(() =>
  import("../pages/FinancialsListPage").then((m) => ({ default: m.FinancialsListPage }))
);
const OwnedInvoicesPage = lazy(() => import("../pages/OwnedInvoicesPage").then((m) => ({ default: m.OwnedInvoicesPage })));
const InvoicesListPage = lazy(() => import("../pages/InvoicesListPage").then((m) => ({ default: m.InvoicesListPage })));
const OwnedRecurringInvoicesPage = lazy(() =>
  import("../pages/OwnedRecurringInvoicesPage").then((m) => ({ default: m.OwnedRecurringInvoicesPage }))
);
const OwnedDocumentsPage = lazy(() =>
  import("../pages/OwnedDocumentsPage").then((m) => ({ default: m.OwnedDocumentsPage }))
);
const PropertyReportPage = lazy(() =>
  import("../pages/PropertyReportPage").then((m) => ({ default: m.PropertyReportPage }))
);
const OwnedEquityMetricsPage = lazy(() =>
  import("../pages/OwnedEquityMetricsPage").then((m) => ({ default: m.OwnedEquityMetricsPage }))
);
const OwnedLeaseMetricsPage = lazy(() =>
  import("../pages/OwnedLeaseMetricsPage").then((m) => ({ default: m.OwnedLeaseMetricsPage }))
);
const OwnedRentDueMetricsPage = lazy(() =>
  import("../pages/OwnedRentDueMetricsPage").then((m) => ({ default: m.OwnedRentDueMetricsPage }))
);
const OwnedDepositsMetricsPage = lazy(() =>
  import("../pages/OwnedDepositsMetricsPage").then((m) => ({ default: m.OwnedDepositsMetricsPage }))
);
const OwnedCashFlowMetricsPage = lazy(() =>
  import("../pages/OwnedCashFlowMetricsPage").then((m) => ({ default: m.OwnedCashFlowMetricsPage }))
);
const OwnedPropertiesMyPropertiesPage = lazy(() =>
  import("../pages/OwnedPropertiesMyPropertiesPage").then((m) => ({ default: m.OwnedPropertiesMyPropertiesPage }))
);
const OwnedPropertiesPortfolioDashboardPage = lazy(() =>
  import("../pages/OwnedPropertiesPortfolioDashboardPage").then((m) => ({
    default: m.OwnedPropertiesPortfolioDashboardPage
  }))
);
const OwnedPropertiesReportsPage = lazy(() =>
  import("../pages/OwnedPropertiesReportsPage").then((m) => ({ default: m.OwnedPropertiesReportsPage }))
);
const TenantsListPage = lazy(() => import("../pages/TenantsListPage").then((m) => ({ default: m.TenantsListPage })));
const TenantFormPage = lazy(() => import("../pages/TenantFormPage").then((m) => ({ default: m.TenantFormPage })));
const TenantWorkspacePage = lazy(() =>
  import("../pages/TenantWorkspacePage").then((m) => ({ default: m.TenantWorkspacePage }))
);
const InvoiceDetailPage = lazy(() =>
  import("../pages/InvoiceDetailPage").then((m) => ({ default: m.InvoiceDetailPage }))
);
const LegacyTenantInvoiceRedirect = lazy(() =>
  import("../pages/InvoiceDetailPage").then((m) => ({ default: m.LegacyTenantInvoiceRedirect }))
);
const OwnedValuationsMetricsPage = lazy(() =>
  import("../pages/OwnedValuationsMetricsPage").then((m) => ({ default: m.OwnedValuationsMetricsPage }))
);
const OwnedBondsMetricsPage = lazy(() =>
  import("../pages/OwnedBondsMetricsPage").then((m) => ({ default: m.OwnedBondsMetricsPage }))
);
const OwnedReturnsMetricsPage = lazy(() =>
  import("../pages/OwnedReturnsMetricsPage").then((m) => ({ default: m.OwnedReturnsMetricsPage }))
);
const OwnedExpensesMetricsPage = lazy(() =>
  import("../pages/OwnedExpensesMetricsPage").then((m) => ({ default: m.OwnedExpensesMetricsPage }))
);
const SettingsPage = lazy(() => import("../pages/SettingsPage").then((m) => ({ default: m.SettingsPage })));
const AdminPanelPage = lazy(() => import("../pages/AdminPanelPage").then((m) => ({ default: m.AdminPanelPage })));

function OwnedPropertyFinancialsRedirect() {
  const { id } = useParams();
  return <Navigate to={`/owned-properties/${id}?tab=financials`} replace />;
}

function Lazy({ children }: { children: ReactNode }) {
  return <Suspense fallback={<RouteFallback />}>{children}</Suspense>;
}

function Auth({ children }: { children: ReactElement }) {
  return (
    <RequireAuth>
      <Lazy>{children}</Lazy>
    </RequireAuth>
  );
}

export function App() {
  return (
    <Routes>
      <Route element={<AppChrome />}>
        <Route path="/" element={<HomePage />} />
        <Route
          path="/calculators"
          element={
            <Lazy>
              <CalculatorHubPage />
            </Lazy>
          }
        />
        <Route
          path="/calculators/:slug"
          element={
            <Lazy>
              <CalculatorPage />
            </Lazy>
          }
        />
        <Route path="/login" element={<LoginPage />} />
        <Route
          path="/apply/:token"
          element={
            <Lazy>
              <ApplicantApplyPage />
            </Lazy>
          }
        />
        <Route path="/confirm-email" element={<ConfirmEmailPage />} />
        <Route path="/confirm-email/:token" element={<ConfirmEmailPage />} />
        <Route path="/dashboard" element={<Auth><DashboardPage /></Auth>} />
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
        <Route path="/admin" element={<Auth><AdminPanelPage /></Auth>} />
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
        <Route path="/settings" element={<Auth><SettingsPage /></Auth>} />
        <Route path="/settings/security" element={<Auth><Navigate to="/settings" replace /></Auth>} />
        <Route path="/settings/notifications" element={<Auth><Navigate to="/settings" replace /></Auth>} />
        <Route path="/owned-properties" element={<Auth><Navigate to="/owned-properties/dashboard" replace /></Auth>} />
        <Route path="/owned-properties/my-properties" element={<Auth><OwnedPropertiesMyPropertiesPage /></Auth>} />
        <Route path="/owned-properties/dashboard" element={<Auth><OwnedPropertiesPortfolioDashboardPage /></Auth>} />
        <Route path="/owned-properties/metrics/equity" element={<Auth><OwnedEquityMetricsPage /></Auth>} />
        <Route path="/owned-properties/metrics/valuations" element={<Auth><OwnedValuationsMetricsPage /></Auth>} />
        <Route path="/owned-properties/metrics/bonds" element={<Auth><OwnedBondsMetricsPage /></Auth>} />
        <Route path="/owned-properties/metrics/returns" element={<Auth><OwnedReturnsMetricsPage /></Auth>} />
        <Route path="/owned-properties/metrics/expenses" element={<Auth><OwnedExpensesMetricsPage /></Auth>} />
        <Route path="/owned-properties/metrics/leases" element={<Auth><OwnedLeaseMetricsPage /></Auth>} />
        <Route path="/owned-properties/metrics/rent-due" element={<Auth><OwnedRentDueMetricsPage /></Auth>} />
        <Route path="/owned-properties/metrics/deposits" element={<Auth><OwnedDepositsMetricsPage /></Auth>} />
        <Route path="/owned-properties/metrics/cash-flow" element={<Auth><OwnedCashFlowMetricsPage /></Auth>} />
        <Route path="/owned-properties/new" element={<Auth><OwnedPropertyFormPage /></Auth>} />
        <Route path="/owned-properties/:id/edit" element={<Auth><OwnedPropertyFormPage /></Auth>} />
        <Route path="/owned-properties/:id/financials" element={<Auth><OwnedPropertyFinancialsRedirect /></Auth>} />
        <Route path="/owned-properties/:id/report" element={<Auth><PropertyReportPage /></Auth>} />
        <Route path="/owned-properties/:id" element={<Auth><OwnedPropertyDetailPage /></Auth>} />
        <Route path="/owned-properties/tenants" element={<Auth><Navigate to="/tenants" replace /></Auth>} />
        <Route path="/owned-properties/leases" element={<Auth><Navigate to="/leases" replace /></Auth>} />
        <Route path="/owned-properties/financials" element={<Auth><Navigate to="/financials" replace /></Auth>} />
        <Route path="/owned-properties/invoices" element={<Auth><Navigate to="/invoices" replace /></Auth>} />
        <Route path="/owned-properties/documents" element={<Auth><Navigate to="/documents" replace /></Auth>} />
        <Route path="/owned-properties/recurring-invoices" element={<Auth><OwnedRecurringInvoicesPage /></Auth>} />
        <Route path="/owned-properties/reports" element={<Auth><OwnedPropertiesReportsPage /></Auth>} />

        <Route path="/leases" element={<Auth><OwnedLeasesPage /></Auth>} />
        <Route path="/leases/new" element={<Auth><LeaseFormPage /></Auth>} />
        <Route path="/leases/:id/edit" element={<Auth><LeaseFormPage /></Auth>} />
        <Route path="/leases/:id" element={<Auth><LeaseDetailRedirect /></Auth>} />
        <Route path="/financials" element={<Auth><FinancialsListPage /></Auth>} />
        <Route path="/invoices" element={<Auth><InvoicesListPage /></Auth>} />
        <Route path="/invoices/new" element={<Auth><InvoiceDetailPage /></Auth>} />
        <Route path="/invoices/:invoiceId" element={<Auth><InvoiceDetailPage /></Auth>} />
        <Route path="/invoices/legacy" element={<Auth><OwnedInvoicesPage /></Auth>} />
        <Route path="/documents" element={<Auth><OwnedDocumentsPage /></Auth>} />
        <Route path="/tenants" element={<Auth><TenantsListPage /></Auth>} />
        <Route path="/tenants/new" element={<Auth><TenantFormPage /></Auth>} />
        <Route path="/tenants/:id/invoices/new" element={<Auth><LegacyTenantInvoiceRedirect /></Auth>} />
        <Route path="/tenants/:id/invoices/:invoiceId" element={<Auth><LegacyTenantInvoiceRedirect /></Auth>} />
        <Route path="/tenants/:id" element={<Auth><TenantWorkspacePage /></Auth>} />
        <Route path="/tenants/:id/edit" element={<Auth><TenantFormPage /></Auth>} />
        <Route path="/account" element={<Auth><AccountPage /></Auth>} />
        <Route path="/subscription" element={<SubscriptionPage />} />
        <Route path="/subscription/success" element={<SubscriptionResultPage mode="success" />} />
        <Route path="/subscription/cancel" element={<SubscriptionResultPage mode="cancel" />} />
      </Route>
    </Routes>
  );
}
