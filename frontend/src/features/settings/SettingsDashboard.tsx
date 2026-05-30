import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { AppIcon, type IconName } from "../../components/icons";
import { fetchMe } from "../../api/user";
import { Button, ButtonLink } from "../../components/ui/Button";
import { Field, Input } from "../../components/ui/Input";
import { AppCard, AppCardDescription, AppCardHeader, AppCardTitle } from "../../components/ui/AppCard";
import { AppFormModal } from "../../components/ui/AppModal";
import { useAuth } from "../../contexts/AuthContext";
import { useMediaQuery } from "../../hooks/useMediaQuery";
import { supabase } from "../../lib/supabaseClient";
import { updateProfile } from "../../services/profileSupabase";
import {
  getOrCreateUserSettings,
  upsertUserSettings,
  validateUserSettings
} from "../../services/settingsSupabase";
import {
  EXPENSE_CATEGORY_OPTIONS,
  STATEMENT_FILTER_OPTIONS
} from "./settingsDefaults";
import type { AccentColor, ThemePreference, UserSettings } from "./settingsTypes";
import { applyThemePreference } from "../../theme/uiColorScheme";

function initials(name: string | null | undefined, email: string): string {
  const n = (name ?? "").trim();
  if (n) {
    const parts = n.split(/\s+/).filter(Boolean);
    if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    return parts[0].slice(0, 2).toUpperCase();
  }
  return email.slice(0, 2).toUpperCase();
}

function SettingsToggle({
  checked,
  onChange,
  label,
  disabled
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
  disabled?: boolean;
}) {
  return (
    <label className="pg-settings-toggle" aria-label={label}>
      <input
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={(e) => onChange(e.target.checked)}
      />
      <span className="pg-settings-toggle-track" />
      <span className="pg-settings-toggle-thumb" />
    </label>
  );
}

function SettingsCard({
  icon,
  title,
  description,
  children,
  fullWidth
}: {
  icon: IconName;
  title: string;
  description?: string;
  children: React.ReactNode;
  fullWidth?: boolean;
}) {
  return (
    <AppCard
      as="section"
      variant="elevated"
      padding="md"
      className={`pg-settings-card${fullWidth ? " pg-settings-card--full" : ""}`}
    >
      <AppCardHeader className="pg-settings-card-head">
        <div className="pg-settings-card-icon">
          <AppIcon name={icon} size="md" />
        </div>
        <div>
          <AppCardTitle className="pg-settings-card-title">{title}</AppCardTitle>
          {description ? <AppCardDescription className="pg-settings-card-desc">{description}</AppCardDescription> : null}
        </div>
      </AppCardHeader>
      {children}
    </AppCard>
  );
}

function ChangePasswordModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (!open) {
      setPassword("");
      setConfirm("");
      setError("");
      setDone(false);
    }
  }, [open]);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    if (password !== confirm) {
      setError("Passwords do not match.");
      return;
    }
    setSaving(true);
    setError("");
    try {
      if (!supabase) throw new Error("Auth not configured.");
      const { error: err } = await supabase.auth.updateUser({ password });
      if (err) throw err;
      setDone(true);
    } catch (ex: unknown) {
      setError(ex instanceof Error ? ex.message : "Could not update password.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <AppFormModal
      open={open}
      onOpenChange={(next) => {
        if (!next) onClose();
      }}
      title="Change password"
      size="sm"
      loading={saving}
      closeOnOverlayClick={!saving}
      onSubmit={done ? undefined : (e) => void submit(e)}
      footer={
        done ? (
          <div className="pg-app-modal-actions">
            <Button type="button" onClick={onClose}>
              Done
            </Button>
          </div>
        ) : (
          <div className="pg-app-modal-actions">
            <Button type="button" variant="soft" onClick={onClose} disabled={saving}>
              Cancel
            </Button>
            <Button type="submit" loading={saving}>
              Update password
            </Button>
          </div>
        )
      }
    >
      {done ? (
        <p className="pg-muted">Your password has been updated.</p>
      ) : (
        <>
          <Field label="New password">
            <Input
              type="password"
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </Field>
          <Field label="Confirm password">
            <Input
              type="password"
              autoComplete="new-password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
            />
          </Field>
          {error ? <div className="pg-alert pg-alert-error">{error}</div> : null}
        </>
      )}
    </AppFormModal>
  );
}

function EditProfileModal({
  open,
  onClose,
  initialName,
  onSaved
}: {
  open: boolean;
  onClose: () => void;
  initialName: string;
  onSaved: (name: string) => void;
}) {
  const { refreshProfile } = useAuth();
  const [name, setName] = useState(initialName);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (open) setName(initialName);
  }, [open, initialName]);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError("");
    try {
      await updateProfile({ fullName: name.trim() || null });
      await refreshProfile();
      onSaved(name.trim());
      onClose();
    } catch (ex: unknown) {
      setError(ex instanceof Error ? ex.message : "Could not save profile.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <AppFormModal
      open={open}
      onOpenChange={(next) => {
        if (!next && !saving) onClose();
      }}
      title="Edit profile"
      size="sm"
      loading={saving}
      closeOnOverlayClick={!saving}
      onSubmit={(e) => void submit(e)}
      footer={
        <div className="pg-app-modal-actions">
          <Button type="button" variant="soft" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button type="submit" loading={saving}>
            Save
          </Button>
        </div>
      }
    >
      <Field label="Full name">
        <Input value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" />
      </Field>
      {error ? <div className="pg-alert pg-alert-error">{error}</div> : null}
    </AppFormModal>
  );
}

export function SettingsDashboard() {
  const isMobile = useMediaQuery("(max-width: 768px)");
  const { refreshProfile } = useAuth();
  const [saved, setSaved] = useState<UserSettings | null>(null);
  const [draft, setDraft] = useState<UserSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [email, setEmail] = useState("");
  const [fullName, setFullName] = useState("");
  const [role, setRole] = useState("");
  const [editProfileOpen, setEditProfileOpen] = useState(false);
  const [changePasswordOpen, setChangePasswordOpen] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [me, settings] = await Promise.all([fetchMe(), getOrCreateUserSettings()]);
      setEmail(me.email);
      setFullName(me.name ?? "");
      setRole(me.role ?? "USER");
      setSaved(settings);
      setDraft(settings);
      applyThemePreference(settings.themePreference);
      document.documentElement.setAttribute("data-density", settings.density);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Could not load settings.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const dirty = useMemo(() => {
    if (!saved || !draft) return false;
    return JSON.stringify(saved) !== JSON.stringify(draft);
  }, [saved, draft]);

  const patchDraft = (patch: Partial<UserSettings>) => {
    setDraft((prev) => (prev ? { ...prev, ...patch } : prev));
    if (patch.themePreference) applyThemePreference(patch.themePreference);
    if (patch.density) document.documentElement.setAttribute("data-density", patch.density);
  };

  const cancel = () => {
    if (saved) {
      setDraft(saved);
      applyThemePreference(saved.themePreference);
      document.documentElement.setAttribute("data-density", saved.density);
    }
    setSuccess(false);
    setError("");
  };

  const save = async () => {
    if (!draft || !saved) return;
    const validationError = validateUserSettings(draft);
    if (validationError) {
      setError(validationError);
      return;
    }
    setSaving(true);
    setError("");
    setSuccess(false);
    try {
      const patch: Partial<UserSettings> = {};
      (Object.keys(draft) as Array<keyof UserSettings>).forEach((key) => {
        if (draft[key] !== saved[key]) {
          (patch as Record<string, unknown>)[key] = draft[key];
        }
      });
      const updated = await upsertUserSettings(patch);
      setSaved(updated);
      setDraft(updated);
      applyThemePreference(updated.themePreference);
      document.documentElement.setAttribute("data-density", updated.density);
      await refreshProfile();
      setSuccess(true);
      window.setTimeout(() => setSuccess(false), 4000);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Could not save settings.");
    } finally {
      setSaving(false);
    }
  };

  const emailRemindersOn = (draft?.paymentReminderDaysBeforeDue ?? 0) > 0;

  if (loading) {
    return (
      <div className="pg-settings-page">
        <div className="pg-settings-page-header">
          <h1>Settings</h1>
        </div>
        <div className="pg-settings-grid">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="pg-settings-skeleton" />
          ))}
        </div>
      </div>
    );
  }

  if (error && !draft) {
    return (
      <div className="pg-settings-page">
        <div className="pg-alert pg-alert-error">{error}</div>
        <Button onClick={() => void load()}>Retry</Button>
      </div>
    );
  }

  if (!draft) return null;

  const footer = (
    <>
      <Button variant="soft" onClick={cancel} disabled={!dirty || saving}>
        Cancel
      </Button>
      <Button onClick={() => void save()} loading={saving} disabled={!dirty}>
        Save changes
      </Button>
    </>
  );

  return (
    <div className="pg-settings-page">
      {!isMobile ? (
        <div className="pg-settings-page-header">
          <h1 className="pg-text-page-title">Settings</h1>
          <p className="pg-text-page-subtitle">Account preferences and workspace configuration.</p>
        </div>
      ) : null}

      {error ? <div className="pg-alert pg-alert-error" style={{ marginBottom: 16 }}>{error}</div> : null}
      {success ? <div className="pg-alert" style={{ marginBottom: 16 }}>Settings saved.</div> : null}

      <div className="pg-settings-grid">
        <SettingsCard icon="profile" title="Account & Profile" description="Your identity and workspace role.">
          <div className="pg-settings-profile">
            <div className="pg-settings-avatar" aria-hidden>
              {initials(fullName, email)}
            </div>
            <div className="pg-settings-profile-meta">
              <strong>{fullName || "No name set"}</strong>
              <span>{email}</span>
              <span>Proplytic workspace · {role}</span>
            </div>
          </div>
          <div className="pg-settings-actions">
            <Button variant="secondary" onClick={() => setEditProfileOpen(true)}>
              Edit profile
            </Button>
            <Button variant="outline" onClick={() => setChangePasswordOpen(true)}>
              Change password
            </Button>
            <ButtonLink href="/account" variant="ghost">
              Banking details
            </ButtonLink>
          </div>
        </SettingsCard>

        <SettingsCard icon="palette" title="Appearance" description="Theme, accent colour, and density.">
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
        </SettingsCard>

        <SettingsCard icon="payments" title="Subscription & Billing" description="Plan and payment details.">
          <div className="pg-settings-row">
            <div>
              <div className="pg-settings-row-label">Current plan</div>
              <div className="pg-settings-row-desc">Calculator subscription</div>
            </div>
            <span className="pg-settings-badge pg-settings-badge--muted">Free tier</span>
          </div>
          <div className="pg-settings-row">
            <div>
              <div className="pg-settings-row-label">Price</div>
              <div className="pg-settings-row-desc">R99/month when subscribed</div>
            </div>
          </div>
          <div className="pg-settings-actions" style={{ marginTop: 12 }}>
            <ButtonLink href="/subscription" variant="outline">
              Manage subscription
            </ButtonLink>
            <span className="pg-settings-coming-soon">Billing history — coming soon</span>
          </div>
        </SettingsCard>

        <SettingsCard icon="sliders" title="Property Defaults" description="Defaults for new properties and leases.">
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
        </SettingsCard>

        <SettingsCard icon="invoices" title="Invoices & Statements" description="Automation and PDF preferences.">
          <div className="pg-settings-field">
            <label htmlFor="settings-inv-format">Invoice number format</label>
            <input
              id="settings-inv-format"
              className="pg-settings-input"
              value={draft.invoiceNumberFormat}
              onChange={(e) => patchDraft({ invoiceNumberFormat: e.target.value })}
            />
            <p className="pg-settings-field-hint">Stored for future use; current generator uses sequential INV numbers.</p>
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
        </SettingsCard>

        <SettingsCard icon="bell" title="Notifications" description="Email and alert preferences.">
          <div className="pg-settings-row">
            <div>
              <div className="pg-settings-row-label">Email reminders</div>
              <div className="pg-settings-row-desc">Payment reminders before due date</div>
            </div>
            <SettingsToggle
              label="Email reminders"
              checked={emailRemindersOn}
              onChange={(v) =>
                patchDraft({ paymentReminderDaysBeforeDue: v ? (draft.paymentReminderDaysBeforeDue || 3) : 0 })
              }
            />
          </div>
          <div className="pg-settings-row">
            <div>
              <div className="pg-settings-row-label">Overdue alerts</div>
            </div>
            <SettingsToggle
              label="Overdue alerts"
              checked={draft.overdueAlertsEnabled}
              onChange={(v) => patchDraft({ overdueAlertsEnabled: v })}
            />
          </div>
          <div className="pg-settings-row">
            <div>
              <div className="pg-settings-row-label">Monthly summaries</div>
            </div>
            <SettingsToggle
              label="Monthly summaries"
              checked={draft.monthlySummariesEnabled}
              onChange={(v) => patchDraft({ monthlySummariesEnabled: v })}
            />
          </div>
          <div className="pg-settings-row">
            <div>
              <div className="pg-settings-row-label">New lease alerts</div>
            </div>
            <SettingsToggle
              label="New lease alerts"
              checked={draft.newLeaseAlertsEnabled}
              onChange={(v) => patchDraft({ newLeaseAlertsEnabled: v })}
            />
          </div>
          <p className="pg-settings-field-hint">Email delivery is not yet configured; preferences are saved for when it is.</p>
        </SettingsCard>

        <SettingsCard icon="shield" title="Security" description="Protect your account.">
          <div className="pg-settings-row">
            <div>
              <div className="pg-settings-row-label">Two-factor authentication</div>
            </div>
            <span className="pg-settings-coming-soon">Coming soon</span>
          </div>
          <div className="pg-settings-row">
            <div>
              <div className="pg-settings-row-label">Active sessions</div>
            </div>
            <span className="pg-settings-coming-soon">Coming soon</span>
          </div>
          <div className="pg-settings-row">
            <div>
              <div className="pg-settings-row-label">Change password</div>
            </div>
            <Button variant="secondary" onClick={() => setChangePasswordOpen(true)}>
              Change
            </Button>
          </div>
          <div className="pg-settings-row">
            <div>
              <div className="pg-settings-row-label">Sign out all devices</div>
            </div>
            <span className="pg-settings-coming-soon">Coming soon</span>
          </div>
        </SettingsCard>

        <SettingsCard icon="plug" title="Integrations & Data" description="Connections and exports.">
          <div className="pg-settings-row">
            <div>
              <div className="pg-settings-row-label">Supabase connection</div>
              <div className="pg-settings-row-desc">Database and auth backend</div>
            </div>
            <span className="pg-settings-badge">Connected</span>
          </div>
          <Link className="pg-settings-link-row" to="/owned-properties/reports">
            <div>
              <div className="pg-settings-row-label">Report generation</div>
              <div className="pg-settings-row-desc">Portfolio reports and PDF exports</div>
            </div>
            <AppIcon name="open" size="sm" />
          </Link>
          <div className="pg-settings-row">
            <div>
              <div className="pg-settings-row-label">Export data</div>
            </div>
            <span className="pg-settings-coming-soon">Coming soon</span>
          </div>
          <div className="pg-settings-row">
            <div>
              <div className="pg-settings-row-label">Backup & restore</div>
            </div>
            <span className="pg-settings-coming-soon">Coming soon</span>
          </div>
        </SettingsCard>

        <SettingsCard icon="help" title="Support & Legal" description="Help, policies, and privacy." fullWidth>
          <Link className="pg-settings-link-row" to="/faq">
            <div className="pg-settings-row-label">Browse guides and FAQs</div>
            <AppIcon name="open" size="sm" />
          </Link>
          <Link className="pg-settings-link-row" to="/help">
            <div className="pg-settings-row-label">Help & support</div>
            <AppIcon name="open" size="sm" />
          </Link>
          <a className="pg-settings-link-row" href="/terms" rel="noopener noreferrer">
            <div className="pg-settings-row-label">Terms of service</div>
            <AppIcon name="open" size="sm" />
          </a>
          <a className="pg-settings-link-row" href="/privacy" rel="noopener noreferrer">
            <div className="pg-settings-row-label">Privacy policy</div>
            <AppIcon name="open" size="sm" />
          </a>
          <Link className="pg-settings-link-row" to="/privacy">
            <div className="pg-settings-row-label">Learn how we protect your data</div>
            <AppIcon name="open" size="sm" />
          </Link>
        </SettingsCard>
      </div>

      <div className="pg-settings-footer pg-settings-footer-desktop">{footer}</div>
      <div className="pg-settings-footer-mobile">{footer}</div>

      <EditProfileModal
        open={editProfileOpen}
        onClose={() => setEditProfileOpen(false)}
        initialName={fullName}
        onSaved={setFullName}
      />
      <ChangePasswordModal open={changePasswordOpen} onClose={() => setChangePasswordOpen(false)} />
    </div>
  );
}
