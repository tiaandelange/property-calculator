import type { ReactElement } from "react";
import { Navigate, Route, Routes, useParams } from "react-router-dom";
import { AppChrome } from "../layouts/AppChrome";
import { LoginPage } from "../pages/LoginPage";
import { PricingPage } from "../pages/PricingPage";
import { ConfirmEmailPage } from "../pages/ConfirmEmailPage";
import { SimplePage } from "../pages/SimplePage";
import { SubscriptionPage } from "../pages/SubscriptionPage";
import { SubscriptionResultPage } from "../pages/SubscriptionResultPage";
import { RequireAuth } from "../components/auth/RequireAuth";
import { RouteBoundary } from "../components/ui/RouteBoundary";
import { lazyWithRetry } from "../lib/lazyWithRetry";

const HomePage = lazyWithRetry(
  () => import("../pages/HomePage").then((m) => ({ default: m.HomePage })),
  { label: "Home" }
);
const CalculatorHubPage = lazyWithRetry(
  () => import("../pages/CalculatorHubPage").then((m) => ({ default: m.CalculatorHubPage })),
  { label: "Calculators" }
);
const CalculatorsPage = lazyWithRetry(
  () => import("../pages/CalculatorsPage").then((m) => ({ default: m.CalculatorsPage })),
  { label: "Calculators" }
);
const CalculatorReportPreviewPage = lazyWithRetry(
  () => import("../pages/CalculatorReportPreviewPage").then((m) => ({ default: m.CalculatorReportPreviewPage })),
  { label: "Calculator Report" }
);
const CalculatorPage = lazyWithRetry(
  () => import("../pages/CalculatorPage").then((m) => ({ default: m.CalculatorPage })),
  { label: "Calculator" }
);
const DashboardPage = lazyWithRetry(
  () => import("../pages/DashboardPage").then((m) => ({ default: m.DashboardPage })),
  { label: "Dashboard" }
);
const ApplicantApplyPage = lazyWithRetry(
  () => import("../pages/ApplicantApplyPage").then((m) => ({ default: m.ApplicantApplyPage })),
  { label: "Applicant Apply" }
);
const OwnedPropertyFormPage = lazyWithRetry(
  () => import("../pages/OwnedPropertyFormPage").then((m) => ({ default: m.OwnedPropertyFormPage })),
  { label: "Property Form" }
);
const OwnedPropertyDetailPage = lazyWithRetry(
  () => import("../pages/OwnedPropertyDetailPage").then((m) => ({ default: m.OwnedPropertyDetailPage })),
  { label: "Property Detail" }
);
const OwnedLeasesPage = lazyWithRetry(
  () => import("../pages/OwnedLeasesPage").then((m) => ({ default: m.OwnedLeasesPage })),
  { label: "Leases" }
);
const LeaseFormPage = lazyWithRetry(
  () => import("../pages/LeaseFormPage").then((m) => ({ default: m.LeaseFormPage })),
  { label: "Lease Form" }
);
const LeaseDetailRedirect = lazyWithRetry(
  () => import("../pages/LeaseDetailRedirect").then((m) => ({ default: m.LeaseDetailRedirect })),
  { label: "Lease Detail" }
);
const FinancialsListPage = lazyWithRetry(
  () => import("../pages/FinancialsListPage").then((m) => ({ default: m.FinancialsListPage })),
  { label: "Financials" }
);
const OwnedInvoicesPage = lazyWithRetry(
  () => import("../pages/OwnedInvoicesPage").then((m) => ({ default: m.OwnedInvoicesPage })),
  { label: "Invoices Legacy" }
);
const InvoicesListPage = lazyWithRetry(
  () => import("../pages/InvoicesListPage").then((m) => ({ default: m.InvoicesListPage })),
  { label: "Invoices" }
);
const OwnedRecurringInvoicesPage = lazyWithRetry(
  () => import("../pages/OwnedRecurringInvoicesPage").then((m) => ({ default: m.OwnedRecurringInvoicesPage })),
  { label: "Recurring Invoices" }
);
const OwnedDocumentsPage = lazyWithRetry(
  () => import("../pages/OwnedDocumentsPage").then((m) => ({ default: m.OwnedDocumentsPage })),
  { label: "Documents" }
);
const PropertyReportPage = lazyWithRetry(
  () => import("../pages/PropertyReportPage").then((m) => ({ default: m.PropertyReportPage })),
  { label: "Property Report" }
);
const OwnedEquityMetricsPage = lazyWithRetry(
  () => import("../pages/OwnedEquityMetricsPage").then((m) => ({ default: m.OwnedEquityMetricsPage })),
  { label: "Equity Metrics" }
);
const OwnedLeaseMetricsPage = lazyWithRetry(
  () => import("../pages/OwnedLeaseMetricsPage").then((m) => ({ default: m.OwnedLeaseMetricsPage })),
  { label: "Lease Metrics" }
);
const OwnedRentDueMetricsPage = lazyWithRetry(
  () => import("../pages/OwnedRentDueMetricsPage").then((m) => ({ default: m.OwnedRentDueMetricsPage })),
  { label: "Rent Due Metrics" }
);
const OwnedDepositsMetricsPage = lazyWithRetry(
  () => import("../pages/OwnedDepositsMetricsPage").then((m) => ({ default: m.OwnedDepositsMetricsPage })),
  { label: "Deposits Metrics" }
);
const OwnedCashFlowMetricsPage = lazyWithRetry(
  () => import("../pages/OwnedCashFlowMetricsPage").then((m) => ({ default: m.OwnedCashFlowMetricsPage })),
  { label: "Cash Flow Metrics" }
);
const OwnedPropertiesMyPropertiesPage = lazyWithRetry(
  () =>
    import("../pages/OwnedPropertiesMyPropertiesPage").then((m) => ({
      default: m.OwnedPropertiesMyPropertiesPage
    })),
  { label: "Properties" }
);
const OwnedPropertiesPortfolioDashboardPage = lazyWithRetry(
  () =>
    import("../pages/OwnedPropertiesPortfolioDashboardPage").then((m) => ({
      default: m.OwnedPropertiesPortfolioDashboardPage
    })),
  { label: "Portfolio Dashboard" }
);
const OwnedPropertiesReportsPage = lazyWithRetry(
  () => import("../pages/OwnedPropertiesReportsPage").then((m) => ({ default: m.OwnedPropertiesReportsPage })),
  { label: "Reports" }
);
const TenantsListPage = lazyWithRetry(
  () => import("../pages/TenantsListPage").then((m) => ({ default: m.TenantsListPage })),
  { label: "Tenants" }
);
const TenantFormPage = lazyWithRetry(
  () => import("../pages/TenantFormPage").then((m) => ({ default: m.TenantFormPage })),
  { label: "Tenant Form" }
);
const TenantWorkspacePage = lazyWithRetry(
  () => import("../pages/TenantWorkspacePage").then((m) => ({ default: m.TenantWorkspacePage })),
  { label: "Tenant Workspace" }
);
const InvoiceDetailPage = lazyWithRetry(
  () => import("../pages/InvoiceDetailPage").then((m) => ({ default: m.InvoiceDetailPage })),
  { label: "Invoice Detail" }
);
const LegacyTenantInvoiceRedirect = lazyWithRetry(
  () => import("../pages/InvoiceDetailPage").then((m) => ({ default: m.LegacyTenantInvoiceRedirect })),
  { label: "Tenant Invoice Redirect" }
);
const OwnedValuationsMetricsPage = lazyWithRetry(
  () => import("../pages/OwnedValuationsMetricsPage").then((m) => ({ default: m.OwnedValuationsMetricsPage })),
  { label: "Valuations Metrics" }
);
const OwnedBondsMetricsPage = lazyWithRetry(
  () => import("../pages/OwnedBondsMetricsPage").then((m) => ({ default: m.OwnedBondsMetricsPage })),
  { label: "Bonds Metrics" }
);
const OwnedReturnsMetricsPage = lazyWithRetry(
  () => import("../pages/OwnedReturnsMetricsPage").then((m) => ({ default: m.OwnedReturnsMetricsPage })),
  { label: "Returns Metrics" }
);
const OwnedExpensesMetricsPage = lazyWithRetry(
  () => import("../pages/OwnedExpensesMetricsPage").then((m) => ({ default: m.OwnedExpensesMetricsPage })),
  { label: "Expenses Metrics" }
);
const SettingsPage = lazyWithRetry(
  () => import("../pages/SettingsPage").then((m) => ({ default: m.SettingsPage })),
  { label: "Settings" }
);
const AdminPanelPage = lazyWithRetry(
  () => import("../pages/AdminPanelPage").then((m) => ({ default: m.AdminPanelPage })),
  { label: "Admin" }
);

function OwnedPropertyFinancialsRedirect() {
  const { id } = useParams();
  return <Navigate to={`/owned-properties/${id}?tab=financials`} replace />;
}

function Auth({ children, label }: { children: ReactElement; label?: string }) {
  return (
    <RequireAuth>
      <RouteBoundary label={label}>{children}</RouteBoundary>
    </RequireAuth>
  );
}

export function App() {
  return (
    <Routes>
      <Route element={<AppChrome />}>
        <Route
          path="/"
          element={
            <RouteBoundary label="Home">
              <HomePage />
            </RouteBoundary>
          }
        />
        <Route
          path="/calculators"
          element={
            <RouteBoundary label="Calculators">
              <CalculatorHubPage />
            </RouteBoundary>
          }
        />
        <Route
          path="/investment-calculator"
          element={
            <Auth label="Investment Calculator">
              <CalculatorsPage />
            </Auth>
          }
        />
        <Route
          path="/calculators/report/:id"
          element={
            <Auth label="Calculator Report">
              <CalculatorReportPreviewPage />
            </Auth>
          }
        />
        <Route
          path="/calculators/:slug"
          element={
            <RouteBoundary label="Calculator">
              <CalculatorPage />
            </RouteBoundary>
          }
        />
        <Route path="/pricing" element={<PricingPage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/signup" element={<LoginPage />} />
        <Route
          path="/apply/:token"
          element={
            <RouteBoundary label="Applicant Apply">
              <ApplicantApplyPage />
            </RouteBoundary>
          }
        />
        <Route path="/confirm-email" element={<ConfirmEmailPage />} />
        <Route path="/confirm-email/:token" element={<ConfirmEmailPage />} />
        <Route path="/dashboard" element={<Auth label="Dashboard"><DashboardPage /></Auth>} />
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
        <Route path="/admin" element={<Auth label="Admin"><AdminPanelPage /></Auth>} />
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
        <Route path="/settings" element={<Auth label="Settings"><SettingsPage /></Auth>} />
        <Route path="/settings/security" element={<Auth label="Settings"><Navigate to="/settings" replace /></Auth>} />
        <Route path="/settings/notifications" element={<Auth label="Settings"><Navigate to="/settings" replace /></Auth>} />
        <Route path="/owned-properties" element={<Auth label="Portfolio Dashboard"><Navigate to="/owned-properties/dashboard" replace /></Auth>} />
        <Route path="/owned-properties/my-properties" element={<Auth label="Properties"><OwnedPropertiesMyPropertiesPage /></Auth>} />
        <Route path="/owned-properties/dashboard" element={<Auth label="Portfolio Dashboard"><OwnedPropertiesPortfolioDashboardPage /></Auth>} />
        <Route path="/owned-properties/metrics/equity" element={<Auth label="Equity Metrics"><OwnedEquityMetricsPage /></Auth>} />
        <Route path="/owned-properties/metrics/valuations" element={<Auth label="Valuations Metrics"><OwnedValuationsMetricsPage /></Auth>} />
        <Route path="/owned-properties/metrics/bonds" element={<Auth label="Bonds Metrics"><OwnedBondsMetricsPage /></Auth>} />
        <Route path="/owned-properties/metrics/returns" element={<Auth label="Returns Metrics"><OwnedReturnsMetricsPage /></Auth>} />
        <Route path="/owned-properties/metrics/expenses" element={<Auth label="Expenses Metrics"><OwnedExpensesMetricsPage /></Auth>} />
        <Route path="/owned-properties/metrics/leases" element={<Auth label="Lease Metrics"><OwnedLeaseMetricsPage /></Auth>} />
        <Route path="/owned-properties/metrics/rent-due" element={<Auth label="Rent Due Metrics"><OwnedRentDueMetricsPage /></Auth>} />
        <Route path="/owned-properties/metrics/deposits" element={<Auth label="Deposits Metrics"><OwnedDepositsMetricsPage /></Auth>} />
        <Route path="/owned-properties/metrics/cash-flow" element={<Auth label="Cash Flow Metrics"><OwnedCashFlowMetricsPage /></Auth>} />
        <Route path="/owned-properties/new" element={<Auth label="Property Form"><OwnedPropertyFormPage /></Auth>} />
        <Route path="/owned-properties/:id/edit" element={<Auth label="Property Form"><OwnedPropertyFormPage /></Auth>} />
        <Route path="/owned-properties/:id/financials" element={<Auth label="Property Financials"><OwnedPropertyFinancialsRedirect /></Auth>} />
        <Route path="/owned-properties/:id/report" element={<Auth label="Property Report"><PropertyReportPage /></Auth>} />
        <Route path="/owned-properties/:id" element={<Auth label="Property Detail"><OwnedPropertyDetailPage /></Auth>} />
        <Route path="/owned-properties/tenants" element={<Auth label="Tenants"><Navigate to="/tenants" replace /></Auth>} />
        <Route path="/owned-properties/leases" element={<Auth label="Leases"><Navigate to="/leases" replace /></Auth>} />
        <Route path="/owned-properties/financials" element={<Auth label="Financials"><Navigate to="/financials" replace /></Auth>} />
        <Route path="/owned-properties/invoices" element={<Auth label="Invoices"><Navigate to="/invoices" replace /></Auth>} />
        <Route path="/owned-properties/documents" element={<Auth label="Documents"><Navigate to="/documents" replace /></Auth>} />
        <Route path="/owned-properties/recurring-invoices" element={<Auth label="Recurring Invoices"><OwnedRecurringInvoicesPage /></Auth>} />
        <Route path="/owned-properties/reports" element={<Auth label="Reports"><OwnedPropertiesReportsPage /></Auth>} />

        <Route path="/leases" element={<Auth label="Leases"><OwnedLeasesPage /></Auth>} />
        <Route path="/leases/new" element={<Auth label="Lease Form"><LeaseFormPage /></Auth>} />
        <Route path="/leases/:id/edit" element={<Auth label="Lease Form"><LeaseFormPage /></Auth>} />
        <Route path="/leases/:id" element={<Auth label="Lease Detail"><LeaseDetailRedirect /></Auth>} />
        <Route path="/financials" element={<Auth label="Financials"><FinancialsListPage /></Auth>} />
        <Route path="/invoices" element={<Auth label="Invoices"><InvoicesListPage /></Auth>} />
        <Route path="/invoices/new" element={<Auth label="Edit Invoice"><InvoiceDetailPage /></Auth>} />
        <Route path="/invoices/:invoiceId" element={<Auth label="Invoice Detail"><InvoiceDetailPage /></Auth>} />
        <Route path="/invoices/legacy" element={<Auth label="Invoices Legacy"><OwnedInvoicesPage /></Auth>} />
        <Route path="/documents" element={<Auth label="Documents"><OwnedDocumentsPage /></Auth>} />
        <Route path="/tenants" element={<Auth label="Tenants"><TenantsListPage /></Auth>} />
        <Route path="/tenants/new" element={<Auth label="Tenant Form"><TenantFormPage /></Auth>} />
        <Route path="/tenants/:id/invoices/new" element={<Auth label="Tenant Invoice Redirect"><LegacyTenantInvoiceRedirect /></Auth>} />
        <Route path="/tenants/:id/invoices/:invoiceId" element={<Auth label="Tenant Invoice Redirect"><LegacyTenantInvoiceRedirect /></Auth>} />
        <Route path="/tenants/:id" element={<Auth label="Tenant Workspace"><TenantWorkspacePage /></Auth>} />
        <Route path="/tenants/:id/edit" element={<Auth label="Tenant Form"><TenantFormPage /></Auth>} />
        <Route path="/account" element={<Navigate to="/settings?invoiceBanking=1" replace />} />
        <Route path="/subscription" element={<SubscriptionPage />} />
        <Route path="/subscription/success" element={<SubscriptionResultPage mode="success" />} />
        <Route path="/subscription/cancel" element={<SubscriptionResultPage mode="cancel" />} />
      </Route>
    </Routes>
  );
}
