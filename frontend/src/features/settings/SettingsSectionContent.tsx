import { Link } from "react-router-dom";
import { AppIcon } from "../../components/icons";
import { Button } from "../../components/ui/Button";
import { Select } from "../../components/ui/Input";
import {
  dbStringToFormatKey,
  formatKeyToDbString,
  INVOICE_NUMBER_FORMAT_OPTIONS,
  previewInvoiceNumber,
  type InvoiceNumberFormatKey
} from "../../lib/billing/invoiceNumberFormat";
import { ApplicantFormTemplateSettingsCard } from "../applicants/ApplicantFormTemplateSettingsCard";
import { CookieConsentSettingsCard } from "./CookieConsentSettingsCard";
import { SettingsCollapsible } from "./SettingsCollapsible";
import { SettingsRow } from "./SettingsRow";
import { SettingsSectionError } from "./SettingsSectionError";
import { StorageUsageCard } from "./StorageUsageCard";
import { SubscriptionSettingsSection } from "./SubscriptionSettingsSection";
import { ProfileAvatarDisplay, SettingsToggle } from "./settingsShared";
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
  avatarIcon?: string | null;
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
};

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
  avatarIcon,
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
  onOpenChangePassword
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
        <div className="pg-settings-panel-stack">
          <div className="pg-settings-panel-rows">
            <SettingsRow label="Avatar">
              <div className="pg-settings-avatar pg-settings-avatar--compact" aria-hidden>
                <ProfileAvatarDisplay
                  avatarUrl={avatarUrl}
                  avatarIcon={avatarIcon}
                  fullName={fullName}
                  email={email}
                />
              </div>
            </SettingsRow>
            <SettingsRow label="Display name">
              <span className="pg-settings-panel-value">{fullName || "No name set"}</span>
            </SettingsRow>
            <SettingsRow label="Email">
              <span className="pg-settings-panel-value">{email}</span>
            </SettingsRow>
            <SettingsRow label="Workspace role">
              <span className="pg-settings-panel-value">{role}</span>
            </SettingsRow>
            <SettingsRow label="Profile">
              <Button variant="outline" size="sm" onClick={onEditProfile}>
                Edit profile
              </Button>
            </SettingsRow>
            <SettingsRow label="Password">
              <Button variant="outline" size="sm" onClick={onOpenChangePassword}>
                Change password
              </Button>
            </SettingsRow>
            <SettingsRow label="Invoice and banking">
              <Button variant="ghost" size="sm" onClick={onOpenInvoiceBanking}>
                Open details
              </Button>
            </SettingsRow>
          </div>
          <StorageUsageCard />
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
          <SettingsRow label="Theme" htmlFor="settings-theme">
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
          <SettingsRow label="Accent colour">
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
          <SettingsCollapsible title="PDF document colour" defaultOpen={false}>
            <SettingsRow label="Use accent on PDFs">
              <SettingsToggle
                label="PDF branding"
                checked={draft.pdfBrandingEnabled}
                onChange={(v) => patchDraft({ pdfBrandingEnabled: v })}
              />
            </SettingsRow>
          </SettingsCollapsible>
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
      {
        const formatKey = dbStringToFormatKey(draft.invoiceNumberFormat);
        const formatPreview = previewInvoiceNumber(formatKey);
        return (
          <div className="pg-settings-panel-stack">
            <div className="pg-settings-panel-rows">
              <SettingsRow label="Banking and invoice details">
                <Button variant="outline" size="sm" onClick={onOpenInvoiceBanking}>
                  Edit details
                </Button>
              </SettingsRow>
              <SettingsRow label="Auto-generate invoices">
                <SettingsToggle
                  label="Auto-generate invoices"
                  checked={draft.autoGenerateInvoices}
                  onChange={(v) => patchDraft({ autoGenerateInvoices: v })}
                />
              </SettingsRow>
              <SettingsRow label="Generate before due date" htmlFor="settings-inv-days">
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
            </div>

            <SettingsCollapsible title="Invoice numbering" summary={formatPreview} defaultOpen={false}>
              <div className="pg-settings-panel-rows pg-settings-panel-rows--nested">
                <SettingsRow label="Format" htmlFor="settings-inv-format">
                  <Select
                    id="settings-inv-format"
                    className="pg-settings-panel-select"
                    value={formatKey}
                    onChange={(e) =>
                      patchDraft({
                        invoiceNumberFormat: formatKeyToDbString(e.target.value as InvoiceNumberFormatKey)
                      })
                    }
                  >
                    {INVOICE_NUMBER_FORMAT_OPTIONS.map((o) => (
                      <option key={o.key} value={o.key}>
                        {o.label}
                      </option>
                    ))}
                  </Select>
                </SettingsRow>
                <SettingsRow label="Preview">
                  <span className="pg-settings-panel-value pg-settings-panel-value--mono">{formatPreview}</span>
                </SettingsRow>
                <p className="pg-settings-panel-muted">
                  The next number is assigned automatically from your invoice history when a new invoice is created.
                </p>
              </div>
            </SettingsCollapsible>

            <SettingsCollapsible title="Reminders and editing rules" defaultOpen={false}>
              <div className="pg-settings-panel-rows pg-settings-panel-rows--nested">
                <SettingsRow label="Payment reminder timing" htmlFor="settings-reminder-days">
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
                <SettingsRow label="Lock editing after sent">
                  <SettingsToggle
                    label="Lock editing after sent"
                    checked={draft.lockInvoiceAfterSent}
                    onChange={(v) => patchDraft({ lockInvoiceAfterSent: v })}
                  />
                </SettingsRow>
              </div>
            </SettingsCollapsible>
          </div>
        );
      }

    case "general":
      if (!draft) {
        return (
          <DraftRequired error={settingsLoadError} onRetry={onRetrySettings} retrying={settingsRetrying} />
        );
      }
      return (
        <div className="pg-settings-panel-stack">
          <div className="pg-settings-panel-rows">
            <SettingsRow label="Workspace name">
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
            <SettingsRow label="Default dashboard view" htmlFor="settings-statement-filter">
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
          </div>

          <SettingsCollapsible title="Property defaults" defaultOpen={false}>
            <div className="pg-settings-panel-rows pg-settings-panel-rows--nested">
              <SettingsRow label="Lease default term" htmlFor="settings-lease-term">
                <input
                  id="settings-lease-term"
                  type="number"
                  min={1}
                  className="pg-settings-panel-input pg-settings-panel-input--narrow"
                  value={draft.leaseDefaultTermMonths}
                  onChange={(e) => patchDraft({ leaseDefaultTermMonths: Number(e.target.value) })}
                />
              </SettingsRow>
              <SettingsRow label="Rent due day default" htmlFor="settings-rent-due">
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
              <SettingsRow label="Recurring expense category" htmlFor="settings-expense-cat">
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
          </SettingsCollapsible>

          <SettingsCollapsible title="Future projections" defaultOpen={false}>
            <div className="pg-settings-panel-rows pg-settings-panel-rows--nested">
              <SettingsRow label="Annual income growth" htmlFor="settings-income-growth">
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
              <SettingsRow label="Expense growth" htmlFor="settings-expense-growth">
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
              <SettingsRow label="Property appreciation" htmlFor="settings-appreciation">
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
          </SettingsCollapsible>

          <SettingsCollapsible title="Applicant form template" defaultOpen={false}>
            <ApplicantFormTemplateSettingsCard
              template={draft.applicantFormTemplate}
              onTemplateChange={(next) => patchDraft({ applicantFormTemplate: next })}
            />
          </SettingsCollapsible>
        </div>
      );

    case "notifications":
      if (!draft) {
        return (
          <DraftRequired error={settingsLoadError} onRetry={onRetrySettings} retrying={settingsRetrying} />
        );
      }
      return (
        <div className="pg-settings-panel-stack">
          <div className="pg-settings-panel-rows">
            <SettingsRow label="Overdue rent">
              <SettingsToggle
                label="Overdue rent"
                checked={draft.overdueAlertsEnabled}
                onChange={(v) => patchDraft({ overdueAlertsEnabled: v })}
              />
            </SettingsRow>
            <SettingsRow label="Rent due soon">
              <SettingsToggle
                label="Rent due soon"
                checked={draft.paymentReminderDaysBeforeDue > 0}
                onChange={(v) =>
                  patchDraft({ paymentReminderDaysBeforeDue: v ? draft.paymentReminderDaysBeforeDue || 3 : 0 })
                }
              />
            </SettingsRow>
            <SettingsRow label="Lease expiring">
              <SettingsToggle
                label="Lease expiring"
                checked={draft.leaseExpiringAlertsEnabled}
                onChange={(v) => patchDraft({ leaseExpiringAlertsEnabled: v })}
              />
            </SettingsRow>
            <SettingsRow label="Monthly summaries">
              <SettingsToggle
                label="Monthly summaries"
                checked={draft.monthlySummariesEnabled}
                onChange={(v) => patchDraft({ monthlySummariesEnabled: v })}
              />
            </SettingsRow>
          </div>
          <SettingsCollapsible title="Email templates and delivery" defaultOpen={false}>
            <p className="pg-settings-panel-muted">Email delivery preferences are coming soon.</p>
          </SettingsCollapsible>
        </div>
      );

    case "security":
      return (
        <div className="pg-settings-panel-stack">
          <div className="pg-settings-panel-rows">
            <SettingsRow label="Change password">
              <Button variant="outline" size="sm" onClick={onOpenChangePassword}>
                Change password
              </Button>
            </SettingsRow>
          </div>
          <SettingsCollapsible title="Advanced security" defaultOpen={false}>
            <div className="pg-settings-panel-rows pg-settings-panel-rows--nested">
              <SettingsRow label="Two-factor authentication">
                <span className="pg-settings-coming-soon">Coming soon</span>
              </SettingsRow>
              <SettingsRow label="Active sessions">
                <span className="pg-settings-coming-soon">Coming soon</span>
              </SettingsRow>
              <SettingsRow label="Sign out all devices">
                <span className="pg-settings-coming-soon">Coming soon</span>
              </SettingsRow>
            </div>
          </SettingsCollapsible>
        </div>
      );

    case "data-export":
      return (
        <div className="pg-settings-panel-stack">
          <SettingsCollapsible title="Export workspace data" defaultOpen={false}>
            <div className="pg-settings-panel-rows pg-settings-panel-rows--nested">
              <SettingsRow label="Properties, leases and financials">
                <span className="pg-settings-coming-soon">Coming soon</span>
              </SettingsRow>
              <SettingsRow label="Reports archive">
                <span className="pg-settings-coming-soon">Coming soon</span>
              </SettingsRow>
            </div>
          </SettingsCollapsible>
          <SettingsCollapsible title="Danger zone" defaultOpen={false}>
            <div className="pg-settings-panel-rows pg-settings-panel-rows--nested pg-settings-panel-rows--danger">
              <SettingsRow label="Delete account" danger>
                <Button variant="outline" size="sm" disabled>
                  Delete account
                </Button>
              </SettingsRow>
              <p className="pg-settings-panel-muted">Account deletion is not available yet.</p>
            </div>
          </SettingsCollapsible>
        </div>
      );

    case "integrations":
      return (
        <div className="pg-settings-panel-stack">
          <CookieConsentSettingsCard />
          <SettingsCollapsible title="Connected services" defaultOpen={false}>
            <div className="pg-settings-panel-rows pg-settings-panel-rows--nested">
              <SettingsRow label="Supabase">
                <span className="pg-settings-badge">Connected</span>
              </SettingsRow>
              <SettingsRow label="Email delivery">
                <span className="pg-settings-badge pg-settings-badge--muted">Configured on server</span>
              </SettingsRow>
              <SettingsRow label="Paystack billing">
                <span className="pg-settings-badge pg-settings-badge--muted">Configured on server</span>
              </SettingsRow>
              <SettingsRow label="Google Analytics / GTM">
                <span className="pg-settings-badge pg-settings-badge--muted">See cookie preferences</span>
              </SettingsRow>
            </div>
          </SettingsCollapsible>
          <Link className="pg-settings-panel-link-row" to="/owned-properties/reports">
            <div className="pg-settings-panel-row__label">
              <span className="pg-settings-panel-row__title">Report generation</span>
            </div>
            <AppIcon name="open" size="sm" />
          </Link>
        </div>
      );

    default:
      return null;
  }
}
