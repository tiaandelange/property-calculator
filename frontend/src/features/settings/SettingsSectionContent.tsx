import { Link } from "react-router-dom";
import { AppIcon } from "../../components/icons";
import { Button } from "../../components/ui/Button";
import { Select } from "../../components/ui/Input";
import { ApplicantFormTemplateSettingsCard } from "../applicants/ApplicantFormTemplateSettingsCard";
import { CookieConsentSettingsCard } from "./CookieConsentSettingsCard";
import { SettingsRow } from "./SettingsRow";
import { SettingsSectionError } from "./SettingsSectionError";
import { SubscriptionSettingsSection } from "./SubscriptionSettingsSection";
import { SettingsToggle, profileInitials } from "./settingsShared";
import type { SettingsSectionId } from "./settingsSections";
import {
  EXPENSE_CATEGORY_OPTIONS,
  STATEMENT_FILTER_OPTIONS
} from "./settingsDefaults";
import type { AccentColor, ThemePreference, UserSettings } from "./settingsTypes";

const ACCENT_LABELS: Record<AccentColor, string> = {
  purple: "Purple",
  blue: "Blue",
  green: "Green",
  orange: "Orange",
  red: "Red",
  teal: "Teal"
};

const THEME_LABELS: Record<ThemePreference, string> = {
  light: "Light",
  dark: "Dark",
  system: "System"
};

export type SettingsSectionContentProps = {
  sectionId: SettingsSectionId;
  draft: UserSettings | null;
  patchDraft: (patch: Partial<UserSettings>) => void;
  email: string;
  fullName: string;
  avatarUrl: string | null;
  role: string;
  freeUsesRemaining?: number | null;
  settingsLoadError?: string;
  profileLoadError?: string;
  onRetrySettings?: () => void;
  onRetryProfile?: () => void;
  settingsRetrying?: boolean;
  profileRetrying?: boolean;
  onEditProfile: () => void;
  onOpenInvoiceBanking: () => void;
  onOpenChangePassword: () => void;
  onGoToSecurity: () => void;
};

function SettingsSubheading({ children }: { children: React.ReactNode }) {
  return <h3 className="pg-settings-panel-subheading">{children}</h3>;
}

function DraftRequired({
  error,
  onRetry,
  retrying
}: {
  error?: string;
  onRetry?: () => void;
  retrying?: boolean;
}) {
  if (!error) return <p className="pg-settings-panel-muted">Loading settings…</p>;
  return <SettingsSectionError message={error} onRetry={onRetry} retrying={retrying} />;
}

export function SettingsSectionContent({
  sectionId,
  draft,
  patchDraft,
  email,
  fullName,
  avatarUrl,
  role,
  freeUsesRemaining,
  settingsLoadError,
  profileLoadError,
  onRetrySettings,
  onRetryProfile,
  settingsRetrying,
  profileRetrying,
  onEditProfile,
  onOpenInvoiceBanking,
  onOpenChangePassword,
  onGoToSecurity
}: SettingsSectionContentProps) {
  switch (sectionId) {
    case "account":
      if (profileLoadError) {
        return (
          <SettingsSectionError
            message={profileLoadError}
            onRetry={onRetryProfile}
            retrying={profileRetrying}
          />
        );
      }
      return (
        <div className="pg-settings-panel-rows">
          <SettingsRow label="Avatar">
            <div className="pg-settings-avatar pg-settings-avatar--compact" aria-hidden>
              {avatarUrl ? (
                <img src={avatarUrl} alt="" className="pg-edit-profile-avatar-img" />
              ) : (
                profileInitials(fullName, email)
              )}
            </div>
          </SettingsRow>
          <SettingsRow label="Display name" description="Shown across your workspace">
            <span className="pg-settings-panel-value">{fullName || "No name set"}</span>
          </SettingsRow>
          <SettingsRow label="Email" description="Sign-in address (read-only)">
            <span className="pg-settings-panel-value">{email}</span>
          </SettingsRow>
          <SettingsRow label="Workspace role">
            <span className="pg-settings-panel-value">{role}</span>
          </SettingsRow>
          <SettingsRow label="Edit profile" description="Name, avatar, contact and business details">
            <Button variant="outline" size="sm" onClick={onEditProfile}>
              Edit profile
            </Button>
          </SettingsRow>
          <SettingsRow label="Password" description="Update your sign-in password">
            <Button variant="outline" size="sm" onClick={onGoToSecurity}>
              Change password
            </Button>
          </SettingsRow>
          <SettingsRow label="Invoice & banking" description="Banking lines and invoice CC email">
            <Button variant="ghost" size="sm" onClick={onOpenInvoiceBanking}>
              Open details
            </Button>
          </SettingsRow>
        </div>
      );

    case "appearance":
      if (!draft) {
        return (
          <DraftRequired error={settingsLoadError} onRetry={onRetrySettings} retrying={settingsRetrying} />
        );
      }
      return (
        <div className="pg-settings-panel-rows">
          <SettingsRow label="Theme" description="Light, dark, or match your system" htmlFor="settings-theme">
            <Select
              id="settings-theme"
              className="pg-settings-panel-select"
              value={draft.themePreference}
              onChange={(e) => patchDraft({ themePreference: e.target.value as ThemePreference })}
            >
              {(["light", "dark", "system"] as ThemePreference[]).map((t) => (
                <option key={t} value={t}>
                  {THEME_LABELS[t]}
                </option>
              ))}
            </Select>
          </SettingsRow>
          <SettingsRow label="Accent colour" description="Highlights buttons and links">
            <div className="pg-settings-accent-picker">
              <span className="pg-settings-accent-picker__label">
                <span
                  className={`pg-settings-accent-dot pg-settings-accent-dot--${draft.accentColor} pg-settings-accent-dot--inline`}
                  aria-hidden
                />
                {ACCENT_LABELS[draft.accentColor]}
              </span>
              <div className="pg-settings-accent-dots pg-settings-accent-dots--compact">
                {(["purple", "blue", "green", "orange", "red", "teal"] as AccentColor[]).map((c) => (
                  <button
                    key={c}
                    type="button"
                    className={`pg-settings-accent-dot pg-settings-accent-dot--${c}${draft.accentColor === c ? " pg-settings-accent-dot--active" : ""}`}
                    aria-label={ACCENT_LABELS[c]}
                    aria-pressed={draft.accentColor === c}
                    onClick={() => patchDraft({ accentColor: c })}
                  />
                ))}
              </div>
            </div>
          </SettingsRow>
          <SettingsRow label="Density" description="Spacing across tables and lists" htmlFor="settings-density">
            <Select
              id="settings-density"
              className="pg-settings-panel-select"
              value={draft.density}
              onChange={(e) => patchDraft({ density: e.target.value as UserSettings["density"] })}
            >
              <option value="comfortable">Comfortable</option>
              <option value="compact">Compact</option>
            </Select>
          </SettingsRow>
        </div>
      );

    case "subscription":
      return <SubscriptionSettingsSection freeUsesRemaining={freeUsesRemaining} />;

    case "invoice-banking":
      if (!draft) {
        return (
          <DraftRequired error={settingsLoadError} onRetry={onRetrySettings} retrying={settingsRetrying} />
        );
      }
      return (
        <div className="pg-settings-panel-rows">
          <SettingsRow
            label="Invoice & banking details"
            description="Banking lines on PDFs and CC address for emailed invoices"
          >
            <Button variant="outline" size="sm" onClick={onOpenInvoiceBanking}>
              Edit details
            </Button>
          </SettingsRow>
          <SettingsRow
            label="Invoice number format"
            description="Stored for future use; generator uses sequential INV numbers today"
            htmlFor="settings-inv-format"
          >
            <input
              id="settings-inv-format"
              className="pg-settings-panel-input"
              value={draft.invoiceNumberFormat}
              onChange={(e) => patchDraft({ invoiceNumberFormat: e.target.value })}
            />
          </SettingsRow>
          <SettingsRow
            label="Auto-generate invoices"
            description="Scheduled rent invoices from active leases"
          >
            <SettingsToggle
              label="Auto-generate invoices"
              checked={draft.autoGenerateInvoices}
              onChange={(v) => patchDraft({ autoGenerateInvoices: v })}
            />
          </SettingsRow>
          <SettingsRow
            label="Generate before due date"
            description="Days before due date to create invoices"
            htmlFor="settings-inv-days"
          >
            <input
              id="settings-inv-days"
              type="number"
              min={0}
              max={31}
              className="pg-settings-panel-input pg-settings-panel-input--narrow"
              value={draft.invoiceGenerateDaysBeforeDue}
              onChange={(e) => patchDraft({ invoiceGenerateDaysBeforeDue: Number(e.target.value) })}
            />
          </SettingsRow>
          <SettingsRow label="PDF branding" description="Show company branding on exported PDFs">
            <SettingsToggle
              label="PDF branding"
              checked={draft.pdfBrandingEnabled}
              onChange={(v) => patchDraft({ pdfBrandingEnabled: v })}
            />
          </SettingsRow>
          <SettingsRow
            label="Payment reminder timing"
            description="Days before due date for payment reminders"
            htmlFor="settings-reminder-days"
          >
            <input
              id="settings-reminder-days"
              type="number"
              min={0}
              max={31}
              className="pg-settings-panel-input pg-settings-panel-input--narrow"
              value={draft.paymentReminderDaysBeforeDue}
              onChange={(e) => patchDraft({ paymentReminderDaysBeforeDue: Number(e.target.value) })}
            />
          </SettingsRow>
          <SettingsRow label="Lock editing after sent" description="Sent invoices cannot be edited">
            <SettingsToggle
              label="Lock editing after sent"
              checked={draft.lockInvoiceAfterSent}
              onChange={(v) => patchDraft({ lockInvoiceAfterSent: v })}
            />
          </SettingsRow>
        </div>
      );

    case "general":
      if (!draft) {
        return (
          <DraftRequired error={settingsLoadError} onRetry={onRetrySettings} retrying={settingsRetrying} />
        );
      }
      return (
        <>
          <div className="pg-settings-panel-rows">
            <SettingsRow label="Workspace name" description="Your display name in this workspace">
              <span className="pg-settings-panel-value">{fullName || email || "—"}</span>
            </SettingsRow>
            <SettingsRow label="Default currency" htmlFor="settings-currency">
              <Select
                id="settings-currency"
                className="pg-settings-panel-select"
                value={draft.defaultCurrency}
                onChange={(e) => patchDraft({ defaultCurrency: e.target.value })}
              >
                <option value="ZAR">ZAR — South African Rand</option>
              </Select>
            </SettingsRow>
            <SettingsRow
              label="Default dashboard view"
              description="Statement period shown by default"
              htmlFor="settings-statement-filter"
            >
              <Select
                id="settings-statement-filter"
                className="pg-settings-panel-select"
                value={draft.statementDefaultFilter}
                onChange={(e) =>
                  patchDraft({ statementDefaultFilter: e.target.value as UserSettings["statementDefaultFilter"] })
                }
              >
                {STATEMENT_FILTER_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </Select>
            </SettingsRow>
            <SettingsRow label="Region / date format">
              <span className="pg-settings-coming-soon">Coming soon</span>
            </SettingsRow>
          </div>

          <SettingsSubheading>Property defaults</SettingsSubheading>
          <div className="pg-settings-panel-rows">
            <SettingsRow label="Lease default term" description="Months" htmlFor="settings-lease-term">
              <input
                id="settings-lease-term"
                type="number"
                min={1}
                className="pg-settings-panel-input pg-settings-panel-input--narrow"
                value={draft.leaseDefaultTermMonths}
                onChange={(e) => patchDraft({ leaseDefaultTermMonths: Number(e.target.value) })}
              />
            </SettingsRow>
            <SettingsRow
              label="Rent due day default"
              description="Day of month (1–28)"
              htmlFor="settings-rent-due"
            >
              <input
                id="settings-rent-due"
                type="number"
                min={1}
                max={28}
                className="pg-settings-panel-input pg-settings-panel-input--narrow"
                value={draft.defaultRentDueDay}
                onChange={(e) => patchDraft({ defaultRentDueDay: Number(e.target.value) })}
              />
            </SettingsRow>
            <SettingsRow
              label="Recurring expense category"
              description="Default for new recurring expenses"
              htmlFor="settings-expense-cat"
            >
              <Select
                id="settings-expense-cat"
                className="pg-settings-panel-select"
                value={draft.recurringExpenseDefaultCategory}
                onChange={(e) => patchDraft({ recurringExpenseDefaultCategory: e.target.value })}
              >
                {EXPENSE_CATEGORY_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </Select>
            </SettingsRow>
          </div>

          <SettingsSubheading>Future projections</SettingsSubheading>
          <p className="pg-settings-panel-section-hint">
            Forward-looking assumptions for dashboards, analyses, and investor reports. Historical
            statements are unchanged.
          </p>
          <div className="pg-settings-panel-rows">
            <SettingsRow
              label="Annual income growth"
              description="% per year applied to rental income"
              htmlFor="settings-income-growth"
            >
              <input
                id="settings-income-growth"
                type="number"
                inputMode="decimal"
                min={0}
                max={30}
                className="pg-settings-panel-input pg-settings-panel-input--narrow"
                value={draft.annualIncomeGrowthPercentAnnual}
                onChange={(e) => patchDraft({ annualIncomeGrowthPercentAnnual: Number(e.target.value) })}
              />
            </SettingsRow>
            <SettingsRow
              label="Expense growth"
              description="% per year for operating costs"
              htmlFor="settings-expense-growth"
            >
              <input
                id="settings-expense-growth"
                type="number"
                inputMode="decimal"
                min={0}
                max={30}
                className="pg-settings-panel-input pg-settings-panel-input--narrow"
                value={draft.expenseGrowthPercentAnnual}
                onChange={(e) => patchDraft({ expenseGrowthPercentAnnual: Number(e.target.value) })}
              />
            </SettingsRow>
            <SettingsRow
              label="Property appreciation"
              description="% per year for projected equity"
              htmlFor="settings-appreciation"
            >
              <input
                id="settings-appreciation"
                type="number"
                inputMode="decimal"
                min={0}
                max={30}
                className="pg-settings-panel-input pg-settings-panel-input--narrow"
                value={draft.propertyAppreciationPercentAnnual}
                onChange={(e) => patchDraft({ propertyAppreciationPercentAnnual: Number(e.target.value) })}
              />
            </SettingsRow>
          </div>

          <SettingsSubheading>Applicant form template</SettingsSubheading>
          <p className="pg-settings-panel-section-hint">Default fields on every applicant share link.</p>
          <ApplicantFormTemplateSettingsCard
            template={draft.applicantFormTemplate}
            onTemplateChange={(next) => patchDraft({ applicantFormTemplate: next })}
          />
        </>
      );

    case "notifications":
      if (!draft) {
        return (
          <DraftRequired error={settingsLoadError} onRetry={onRetrySettings} retrying={settingsRetrying} />
        );
      }
      return (
        <div className="pg-settings-panel-rows">
          <p className="pg-settings-panel-section-hint pg-settings-panel-section-hint--top">
            In-app alerts in the header bell. Email delivery is planned separately.
          </p>
          <SettingsRow label="Overdue rent" description="When unpaid rent is past due">
            <SettingsToggle
              label="Overdue rent"
              checked={draft.overdueAlertsEnabled}
              onChange={(v) => patchDraft({ overdueAlertsEnabled: v })}
            />
          </SettingsRow>
          <SettingsRow
            label="Rent due soon"
            description={
              draft.paymentReminderDaysBeforeDue > 0
                ? `Within ${draft.paymentReminderDaysBeforeDue} day(s) of due date`
                : "Off — enable payment reminders in Invoice & Banking"
            }
          >
            <SettingsToggle
              label="Rent due soon"
              checked={draft.paymentReminderDaysBeforeDue > 0}
              onChange={(v) =>
                patchDraft({ paymentReminderDaysBeforeDue: v ? draft.paymentReminderDaysBeforeDue || 3 : 0 })
              }
            />
          </SettingsRow>
          <SettingsRow label="Lease expiring" description="Fixed-term leases ending within 60 days">
            <SettingsToggle
              label="Lease expiring"
              checked={draft.leaseExpiringAlertsEnabled}
              onChange={(v) => patchDraft({ leaseExpiringAlertsEnabled: v })}
            />
          </SettingsRow>
          <SettingsRow
            label="Monthly summaries"
            description="Email portfolio summary (not shown in the bell)"
          >
            <SettingsToggle
              label="Monthly summaries"
              checked={draft.monthlySummariesEnabled}
              onChange={(v) => patchDraft({ monthlySummariesEnabled: v })}
            />
          </SettingsRow>
          <SettingsRow label="Email notifications" description="Delivery preferences for email alerts">
            <span className="pg-settings-coming-soon">Coming soon</span>
          </SettingsRow>
        </div>
      );

    case "security":
      return (
        <div className="pg-settings-panel-rows">
          <SettingsRow label="Change password" description="Update your sign-in password">
            <Button variant="outline" size="sm" onClick={onOpenChangePassword}>
              Change password
            </Button>
          </SettingsRow>
          <SettingsRow label="Two-factor authentication" description="Extra protection for your account">
            <span className="pg-settings-coming-soon">Coming soon</span>
          </SettingsRow>
          <SettingsRow label="Active sessions" description="Devices signed in to your account">
            <span className="pg-settings-coming-soon">Coming soon</span>
          </SettingsRow>
          <SettingsRow label="Sign out all devices" description="End sessions on every device">
            <span className="pg-settings-coming-soon">Coming soon</span>
          </SettingsRow>
        </div>
      );

    case "data-export":
      return (
        <>
          <div className="pg-settings-panel-rows">
            <SettingsRow
              label="Export workspace data"
              description="Download properties, leases, and financial records"
            >
              <span className="pg-settings-coming-soon">Coming soon</span>
            </SettingsRow>
            <SettingsRow label="Download reports archive" description="Export generated portfolio reports">
              <span className="pg-settings-coming-soon">Coming soon</span>
            </SettingsRow>
          </div>
          <div className="pg-settings-panel-rows pg-settings-panel-rows--danger">
            <SettingsRow label="Delete account" description="Permanently delete your account and data" danger>
              <Button variant="outline" size="sm" disabled>
                Delete account
              </Button>
            </SettingsRow>
          </div>
        </>
      );

    case "integrations":
      return (
        <div className="pg-settings-panel-rows">
          <CookieConsentSettingsCard />
          <SettingsRow label="Supabase" description="Database and authentication backend">
            <span className="pg-settings-badge">Connected</span>
          </SettingsRow>
          <SettingsRow label="Email delivery" description="Invoice and contact emails via Resend">
            <span className="pg-settings-badge pg-settings-badge--muted">Configured on server</span>
          </SettingsRow>
          <SettingsRow label="Paystack billing" description="Subscription checkout and renewals">
            <span className="pg-settings-badge pg-settings-badge--muted">Configured on server</span>
          </SettingsRow>
          <SettingsRow label="Google Analytics / GTM" description="Usage analytics via tag manager">
            <span className="pg-settings-badge pg-settings-badge--muted">See cookie preferences</span>
          </SettingsRow>
          <Link className="pg-settings-panel-link-row" to="/owned-properties/reports">
            <div className="pg-settings-panel-row__label">
              <span className="pg-settings-panel-row__title">Report generation</span>
              <span className="pg-settings-panel-row__desc">Portfolio reports and PDF exports</span>
            </div>
            <AppIcon name="open" size="sm" />
          </Link>
        </div>
      );

    default:
      return null;
  }
}
