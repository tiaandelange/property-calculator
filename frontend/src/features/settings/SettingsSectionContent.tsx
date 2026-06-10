import { Link } from "react-router-dom";
import { AppIcon } from "../../components/icons";
import { Button } from "../../components/ui/Button";
import { ApplicantFormTemplateSettingsCard } from "../applicants/ApplicantFormTemplateSettingsCard";
import { CookieConsentSettingsCard } from "./CookieConsentSettingsCard";
import { SubscriptionSettingsSection } from "./SubscriptionSettingsSection";
import { SettingsToggle, profileInitials } from "./settingsShared";
import type { SettingsSectionId } from "./settingsSections";
import {
  EXPENSE_CATEGORY_OPTIONS,
  STATEMENT_FILTER_OPTIONS
} from "./settingsDefaults";
import type { AccentColor, ThemePreference, UserSettings } from "./settingsTypes";

export type SettingsSectionContentProps = {
  sectionId: SettingsSectionId;
  draft: UserSettings;
  patchDraft: (patch: Partial<UserSettings>) => void;
  email: string;
  fullName: string;
  avatarUrl: string | null;
  role: string;
  freeUsesRemaining?: number | null;
  onEditProfile: () => void;
  onOpenInvoiceBanking: () => void;
  onOpenChangePassword: () => void;
  onGoToSecurity: () => void;
};

function SettingsSubheading({ children }: { children: React.ReactNode }) {
  return <h3 className="pg-settings-subheading">{children}</h3>;
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
  onEditProfile,
  onOpenInvoiceBanking,
  onOpenChangePassword,
  onGoToSecurity
}: SettingsSectionContentProps) {
  switch (sectionId) {
    case "account":
      return (
        <>
          <div className="pg-settings-profile">
            <div className="pg-settings-avatar" aria-hidden>
              {avatarUrl ? (
                <img src={avatarUrl} alt="" className="pg-edit-profile-avatar-img" />
              ) : (
                profileInitials(fullName, email)
              )}
            </div>
            <div className="pg-settings-profile-meta">
              <strong>{fullName || "No name set"}</strong>
              <span>{email}</span>
              <span>Proplytic workspace · {role}</span>
            </div>
          </div>
          <div className="pg-settings-actions">
            <Button variant="secondary" onClick={onEditProfile}>
              Edit profile
            </Button>
            <Button variant="outline" onClick={onGoToSecurity}>
              Change password
            </Button>
            <Button variant="ghost" onClick={onOpenInvoiceBanking}>
              Invoice & banking details
            </Button>
          </div>
        </>
      );

    case "appearance":
      return (
        <>
          <div className="pg-settings-field">
            <label className="pg-text-label">Theme</label>
            <div className="pg-settings-theme-options">
              {(["light", "dark", "system"] as ThemePreference[]).map((t) => (
                <button
                  key={t}
                  type="button"
                  className={`pg-settings-theme-btn${draft.themePreference === t ? " pg-settings-theme-btn--active" : ""}`}
                  onClick={() => patchDraft({ themePreference: t })}
                >
                  {t === "light" ? "Light" : t === "dark" ? "Dark" : "System"}
                </button>
              ))}
            </div>
            <p className="pg-text-helper">System follows your browser or OS colour preference.</p>
          </div>
          <div className="pg-settings-field">
            <label className="pg-text-label">Accent colour</label>
            <div className="pg-settings-accent-dots">
              {(["purple", "blue", "green", "orange", "red", "teal"] as AccentColor[]).map((c) => (
                <button
                  key={c}
                  type="button"
                  className={`pg-settings-accent-dot pg-settings-accent-dot--${c}${draft.accentColor === c ? " pg-settings-accent-dot--active" : ""}`}
                  aria-label={c}
                  onClick={() => patchDraft({ accentColor: c })}
                />
              ))}
            </div>
          </div>
          <div className="pg-settings-field">
            <label className="pg-text-label">Density</label>
            <div className="pg-settings-theme-options">
              {(["comfortable", "compact"] as const).map((d) => (
                <button
                  key={d}
                  type="button"
                  className={`pg-settings-theme-btn${draft.density === d ? " pg-settings-theme-btn--active" : ""}`}
                  onClick={() => patchDraft({ density: d })}
                >
                  {d === "comfortable" ? "Comfortable" : "Compact"}
                </button>
              ))}
            </div>
          </div>
        </>
      );

    case "subscription":
      return <SubscriptionSettingsSection freeUsesRemaining={freeUsesRemaining} />;

    case "invoice-banking":
      return (
        <>
          <p className="pg-settings-field-hint" style={{ marginTop: 0 }}>
            Banking lines on invoice PDFs and the CC address used when emailing invoices are configured
            in invoice &amp; banking details.
          </p>
          <div className="pg-settings-actions" style={{ marginBottom: 16 }}>
            <Button variant="outline" onClick={onOpenInvoiceBanking}>
              Edit invoice & banking details
            </Button>
          </div>
          <div className="pg-settings-field">
            <label htmlFor="settings-inv-format">Invoice number format</label>
            <input
              id="settings-inv-format"
              className="pg-settings-input"
              value={draft.invoiceNumberFormat}
              onChange={(e) => patchDraft({ invoiceNumberFormat: e.target.value })}
            />
            <p className="pg-settings-field-hint">
              Stored for future use; current generator uses sequential INV numbers.
            </p>
          </div>
          <div className="pg-settings-row">
            <div>
              <div className="pg-settings-row-label">Auto-generate invoices</div>
              <div className="pg-settings-row-desc">Scheduled rent invoices from active leases</div>
            </div>
            <SettingsToggle
              label="Auto-generate invoices"
              checked={draft.autoGenerateInvoices}
              onChange={(v) => patchDraft({ autoGenerateInvoices: v })}
            />
          </div>
          <div className="pg-settings-field">
            <label htmlFor="settings-inv-days">Generate invoices before due date (days)</label>
            <input
              id="settings-inv-days"
              type="number"
              min={0}
              max={31}
              className="pg-settings-input"
              value={draft.invoiceGenerateDaysBeforeDue}
              onChange={(e) => patchDraft({ invoiceGenerateDaysBeforeDue: Number(e.target.value) })}
            />
          </div>
          <div className="pg-settings-row">
            <div>
              <div className="pg-settings-row-label">PDF branding</div>
              <div className="pg-settings-row-desc">Show company branding on exported PDFs</div>
            </div>
            <SettingsToggle
              label="PDF branding"
              checked={draft.pdfBrandingEnabled}
              onChange={(v) => patchDraft({ pdfBrandingEnabled: v })}
            />
          </div>
          <div className="pg-settings-field">
            <label htmlFor="settings-reminder-days">Payment reminder timing (days before due)</label>
            <input
              id="settings-reminder-days"
              type="number"
              min={0}
              max={31}
              className="pg-settings-input"
              value={draft.paymentReminderDaysBeforeDue}
              onChange={(e) => patchDraft({ paymentReminderDaysBeforeDue: Number(e.target.value) })}
            />
          </div>
          <div className="pg-settings-row">
            <div>
              <div className="pg-settings-row-label">Lock editing after sent</div>
              <div className="pg-settings-row-desc">Sent invoices cannot be edited</div>
            </div>
            <SettingsToggle
              label="Lock editing after sent"
              checked={draft.lockInvoiceAfterSent}
              onChange={(v) => patchDraft({ lockInvoiceAfterSent: v })}
            />
          </div>
        </>
      );

    case "workspace":
      return (
        <>
          <SettingsSubheading>Property defaults</SettingsSubheading>
          <p className="pg-settings-field-hint">Defaults for new properties and leases.</p>
          <div className="pg-settings-field">
            <label htmlFor="settings-currency">Default currency</label>
            <select
              id="settings-currency"
              className="pg-settings-input"
              value={draft.defaultCurrency}
              onChange={(e) => patchDraft({ defaultCurrency: e.target.value })}
            >
              <option value="ZAR">ZAR — South African Rand</option>
            </select>
          </div>
          <div className="pg-settings-field">
            <label htmlFor="settings-statement-filter">Statement default filter</label>
            <select
              id="settings-statement-filter"
              className="pg-settings-input"
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
            </select>
          </div>
          <div className="pg-settings-field">
            <label htmlFor="settings-lease-term">Lease default term (months)</label>
            <input
              id="settings-lease-term"
              type="number"
              min={1}
              className="pg-settings-input"
              value={draft.leaseDefaultTermMonths}
              onChange={(e) => patchDraft({ leaseDefaultTermMonths: Number(e.target.value) })}
            />
          </div>
          <div className="pg-settings-field">
            <label htmlFor="settings-rent-due">Rent due day default (1–28)</label>
            <input
              id="settings-rent-due"
              type="number"
              min={1}
              max={28}
              className="pg-settings-input"
              value={draft.defaultRentDueDay}
              onChange={(e) => patchDraft({ defaultRentDueDay: Number(e.target.value) })}
            />
          </div>
          <div className="pg-settings-field">
            <label htmlFor="settings-expense-cat">Recurring expense default category</label>
            <select
              id="settings-expense-cat"
              className="pg-settings-input"
              value={draft.recurringExpenseDefaultCategory}
              onChange={(e) => patchDraft({ recurringExpenseDefaultCategory: e.target.value })}
            >
              {EXPENSE_CATEGORY_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>

          <SettingsSubheading>Future projections</SettingsSubheading>
          <p className="pg-settings-field-hint">
            Used for forward-looking projections in the dashboard, property analyses, and investor
            reports. These do not change your historical statements.
          </p>
          <div className="pg-settings-field">
            <label htmlFor="settings-income-growth">Annual income growth (% p.a.)</label>
            <input
              id="settings-income-growth"
              type="number"
              inputMode="decimal"
              min={0}
              max={30}
              className="pg-settings-input"
              value={draft.annualIncomeGrowthPercentAnnual}
              onChange={(e) => patchDraft({ annualIncomeGrowthPercentAnnual: Number(e.target.value) })}
            />
            <p className="pg-settings-field-hint">
              Applied to rental income when projecting future years (e.g. Year n income = Year 1 × (1 +
              g)^(n − 1)).
            </p>
          </div>
          <div className="pg-settings-field">
            <label htmlFor="settings-expense-growth">Expense growth / inflation (% p.a.)</label>
            <input
              id="settings-expense-growth"
              type="number"
              inputMode="decimal"
              min={0}
              max={30}
              className="pg-settings-input"
              value={draft.expenseGrowthPercentAnnual}
              onChange={(e) => patchDraft({ expenseGrowthPercentAnnual: Number(e.target.value) })}
            />
            <p className="pg-settings-field-hint">
              Applied to operating expenses and costs when projecting future years.
            </p>
          </div>
          <div className="pg-settings-field">
            <label htmlFor="settings-appreciation">Property appreciation (% p.a.)</label>
            <input
              id="settings-appreciation"
              type="number"
              inputMode="decimal"
              min={0}
              max={30}
              className="pg-settings-input"
              value={draft.propertyAppreciationPercentAnnual}
              onChange={(e) => patchDraft({ propertyAppreciationPercentAnnual: Number(e.target.value) })}
            />
            <p className="pg-settings-field-hint">
              Used for projected property value growth and equity over time.
            </p>
          </div>

          <SettingsSubheading>Applicant form template</SettingsSubheading>
          <p className="pg-settings-field-hint">Default fields sent on every applicant share link.</p>
          <ApplicantFormTemplateSettingsCard
            template={draft.applicantFormTemplate}
            onTemplateChange={(next) => patchDraft({ applicantFormTemplate: next })}
          />
        </>
      );

    case "notifications":
      return (
        <>
          <p className="pg-settings-field-hint" style={{ marginTop: 0 }}>
            In-app alerts in the header bell. Email delivery is planned separately.
          </p>
          <div className="pg-settings-row">
            <div>
              <div className="pg-settings-row-label">Overdue rent</div>
              <div className="pg-settings-row-desc">When unpaid rent is past due</div>
            </div>
            <SettingsToggle
              label="Overdue rent"
              checked={draft.overdueAlertsEnabled}
              onChange={(v) => patchDraft({ overdueAlertsEnabled: v })}
            />
          </div>
          <div className="pg-settings-row">
            <div>
              <div className="pg-settings-row-label">Rent due soon</div>
              <div className="pg-settings-row-desc">
                {draft.paymentReminderDaysBeforeDue > 0
                  ? `Within ${draft.paymentReminderDaysBeforeDue} day(s) of due date`
                  : "Off — enable payment reminders in Invoice & Banking"}
              </div>
            </div>
            <SettingsToggle
              label="Rent due soon"
              checked={draft.paymentReminderDaysBeforeDue > 0}
              onChange={(v) =>
                patchDraft({ paymentReminderDaysBeforeDue: v ? (draft.paymentReminderDaysBeforeDue || 3) : 0 })
              }
            />
          </div>
          <div className="pg-settings-row">
            <div>
              <div className="pg-settings-row-label">Lease expiring</div>
              <div className="pg-settings-row-desc">Fixed-term leases ending within 60 days</div>
            </div>
            <SettingsToggle
              label="Lease expiring"
              checked={draft.leaseExpiringAlertsEnabled}
              onChange={(v) => patchDraft({ leaseExpiringAlertsEnabled: v })}
            />
          </div>
          <div className="pg-settings-row">
            <div>
              <div className="pg-settings-row-label">Monthly summaries</div>
              <div className="pg-settings-row-desc">Email portfolio summary (not shown in the bell)</div>
            </div>
            <SettingsToggle
              label="Monthly summaries"
              checked={draft.monthlySummariesEnabled}
              onChange={(v) => patchDraft({ monthlySummariesEnabled: v })}
            />
          </div>
        </>
      );

    case "security":
      return (
        <>
          <div className="pg-settings-row">
            <div>
              <div className="pg-settings-row-label">Change password</div>
              <div className="pg-settings-row-desc">Update your sign-in password</div>
            </div>
            <Button variant="secondary" onClick={onOpenChangePassword}>
              Change password
            </Button>
          </div>
          <div className="pg-settings-row">
            <div>
              <div className="pg-settings-row-label">Two-factor authentication</div>
              <div className="pg-settings-row-desc">Extra protection for your account</div>
            </div>
            <span className="pg-settings-coming-soon">Coming soon</span>
          </div>
          <div className="pg-settings-row">
            <div>
              <div className="pg-settings-row-label">Active sessions</div>
              <div className="pg-settings-row-desc">Devices signed in to your account</div>
            </div>
            <span className="pg-settings-coming-soon">Coming soon</span>
          </div>
          <div className="pg-settings-row">
            <div>
              <div className="pg-settings-row-label">Sign out all devices</div>
              <div className="pg-settings-row-desc">End sessions on every device</div>
            </div>
            <span className="pg-settings-coming-soon">Coming soon</span>
          </div>
        </>
      );

    case "data-export":
      return (
        <>
          <div className="pg-settings-row">
            <div>
              <div className="pg-settings-row-label">Export workspace data</div>
              <div className="pg-settings-row-desc">Download properties, leases, and financial records</div>
            </div>
            <span className="pg-settings-coming-soon">Coming soon</span>
          </div>
          <div className="pg-settings-row">
            <div>
              <div className="pg-settings-row-label">Backup & restore</div>
              <div className="pg-settings-row-desc">Create a full workspace backup</div>
            </div>
            <span className="pg-settings-coming-soon">Coming soon</span>
          </div>
          <div className="pg-settings-danger-zone">
            <SettingsSubheading>Delete account</SettingsSubheading>
            <p className="pg-settings-field-hint">
              Permanently delete your account and workspace data. This action is not available yet.
            </p>
            <Button variant="outline" disabled>
              Delete account
            </Button>
          </div>
        </>
      );

    case "integrations":
      return (
        <>
          <CookieConsentSettingsCard />
          <div className="pg-settings-row">
            <div>
              <div className="pg-settings-row-label">Supabase</div>
              <div className="pg-settings-row-desc">Database and authentication backend</div>
            </div>
            <span className="pg-settings-badge">Connected</span>
          </div>
          <div className="pg-settings-row">
            <div>
              <div className="pg-settings-row-label">Email delivery</div>
              <div className="pg-settings-row-desc">Invoice and contact emails via Resend (server-managed)</div>
            </div>
            <span className="pg-settings-badge pg-settings-badge--muted">Configured on server</span>
          </div>
          <div className="pg-settings-row">
            <div>
              <div className="pg-settings-row-label">Paystack billing</div>
              <div className="pg-settings-row-desc">Subscription checkout and renewals</div>
            </div>
            <span className="pg-settings-badge pg-settings-badge--muted">Configured on server</span>
          </div>
          <Link className="pg-settings-link-row" to="/owned-properties/reports">
            <div>
              <div className="pg-settings-row-label">Report generation</div>
              <div className="pg-settings-row-desc">Portfolio reports and PDF exports</div>
            </div>
            <AppIcon name="open" size="sm" />
          </Link>
        </>
      );

    default:
      return null;
  }
}
