import { useCallback, useEffect, useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useNavigate, useSearchParams } from "react-router-dom";
import { AppPage, AppPageContent, AppPageHeader, AppPageSubtitle, AppPageTitle } from "../../components/ui/AppPage";
import { Button } from "../../components/ui/Button";
import { QueryErrorCard } from "../../components/ui/QueryState";
import { formatQueryErrorMessage } from "../../lib/queryErrors";
import { useRegisterSettingsUnsavedChanges } from "./settingsUnsavedChanges";
import { useAuth } from "../../contexts/AuthContext";
import { useMediaQuery } from "../../hooks/useMediaQuery";
import { upsertUserSettings, validateUserSettings } from "../../services/settingsSupabase";
import { EditProfileModal } from "./EditProfileModal";
import { InvoiceBankingDetailsModal } from "./InvoiceBankingDetailsModal";
import { SettingsDetailPanel } from "./SettingsDetailPanel";
import { SettingsNav } from "./SettingsNav";
import { SettingsSectionContent } from "./SettingsSectionContent";
import { ChangePasswordModal } from "./settingsShared";
import type { UserSettings } from "./settingsTypes";
import { previewWorkspaceAppearance } from "../../theme/workspaceAppearance";
import {
  invalidateSettingsQueries,
  invalidateWorkspaceNotifications,
  queryKeys,
  useProfileQuery,
  useSettingsQuery,
  useWorkspaceId
} from "../queries";
import {
  SETTINGS_SECTIONS,
  getSettingsSection,
  resolveSettingsSection,
  settingsSectionPath,
  type SettingsSectionId
} from "./settingsSections";

export function SettingsDashboard() {
  const isMobile = useMediaQuery("(max-width: 768px)");
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const { refreshProfile, profile } = useAuth();
  const queryClient = useQueryClient();
  const workspaceId = useWorkspaceId();
  const settingsQuery = useSettingsQuery();
  const profileQuery = useProfileQuery();
  const [saved, setSaved] = useState<UserSettings | null>(null);
  const [draft, setDraft] = useState<UserSettings | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [email, setEmail] = useState("");
  const [fullName, setFullName] = useState("");
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [role, setRole] = useState("");
  const [editProfileOpen, setEditProfileOpen] = useState(false);
  const [changePasswordOpen, setChangePasswordOpen] = useState(false);
  const [invoiceBankingOpen, setInvoiceBankingOpen] = useState(false);

  const activeSection = useMemo(
    () => resolveSettingsSection(searchParams.get("section")),
    [searchParams]
  );
  const activeConfig = getSettingsSection(activeSection);

  useEffect(() => {
    if (!settingsQuery.data) return;
    setSaved((prevSaved) => {
      const server = settingsQuery.data;
      setDraft((prevDraft) => {
        if (!prevDraft || !prevSaved) return server;
        if (JSON.stringify(prevDraft) !== JSON.stringify(prevSaved)) {
          return prevDraft;
        }
        return server;
      });
      return server;
    });
  }, [settingsQuery.data]);

  useEffect(() => {
    if (profileQuery.data) {
      setEmail(profileQuery.data.email);
      setFullName(profileQuery.data.name ?? "");
      setAvatarUrl(profileQuery.data.avatarUrl ?? null);
      setRole(profileQuery.data.role ?? "USER");
    }
  }, [profileQuery.data]);

  const loading = (settingsQuery.isLoading && !settingsQuery.data) || (profileQuery.isLoading && !profileQuery.data);

  useEffect(() => {
    if (settingsQuery.error) {
      setError(formatQueryErrorMessage(settingsQuery.error, "Could not load settings."));
    } else if (profileQuery.error) {
      setError(formatQueryErrorMessage(profileQuery.error, "Could not load profile."));
    }
  }, [settingsQuery.error, profileQuery.error]);

  useEffect(() => {
    const next = new URLSearchParams(searchParams);
    let changed = false;

    if (!next.get("section")) {
      next.set("section", "account");
      changed = true;
    }

    if (next.get("invoiceBanking") === "1") {
      setInvoiceBankingOpen(true);
      if (next.get("section") !== "invoice-banking") {
        next.set("section", "invoice-banking");
        changed = true;
      }
    }

    if (changed) {
      setSearchParams(next, { replace: true });
    }
  }, [searchParams, setSearchParams]);

  useEffect(() => {
    const hash = window.location.hash.replace(/^#/, "");
    if (!hash || searchParams.get("section")) return;
    navigate(settingsSectionPath(resolveSettingsSection(hash)), { replace: true });
  }, [navigate, searchParams]);

  const dirty = useMemo(() => {
    if (!saved || !draft) return false;
    return JSON.stringify(saved) !== JSON.stringify(draft);
  }, [saved, draft]);

  const patchDraft = useCallback((patch: Partial<UserSettings>) => {
    setDraft((prev) => {
      if (!prev) return prev;
      const next = { ...prev, ...patch };
      previewWorkspaceAppearance({
        themePreference: next.themePreference,
        accentColor: next.accentColor,
        density: next.density
      });
      return next;
    });
  }, []);

  const cancel = useCallback(() => {
    if (saved) {
      setDraft(saved);
      previewWorkspaceAppearance({
        themePreference: saved.themePreference,
        accentColor: saved.accentColor,
        density: saved.density
      });
    }
    setSuccess(false);
    setError("");
  }, [saved]);

  const save = useCallback(async (): Promise<boolean> => {
    if (!draft || !saved) return false;
    const validationError = validateUserSettings(draft);
    if (validationError) {
      setError(validationError);
      return false;
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
      if (workspaceId) {
        queryClient.setQueryData(queryKeys.settings(workspaceId), updated);
        invalidateSettingsQueries({ workspaceId });
        if (
          patch.overdueAlertsEnabled !== undefined ||
          patch.paymentReminderDaysBeforeDue !== undefined ||
          patch.leaseExpiringAlertsEnabled !== undefined
        ) {
          invalidateWorkspaceNotifications({ workspaceId });
        }
      }
      previewWorkspaceAppearance({
        themePreference: updated.themePreference,
        accentColor: updated.accentColor,
        density: updated.density
      });
      await refreshProfile();
      setSuccess(true);
      window.setTimeout(() => setSuccess(false), 4000);
      return true;
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Could not save settings.");
      return false;
    } finally {
      setSaving(false);
    }
  }, [draft, saved, workspaceId, queryClient, refreshProfile]);

  useRegisterSettingsUnsavedChanges(dirty, save, cancel);

  const selectSection = useCallback(
    (sectionId: SettingsSectionId) => {
      const next = new URLSearchParams(searchParams);
      next.set("section", sectionId);
      next.delete("invoiceBanking");
      setSearchParams(next, { replace: false });
    },
    [searchParams, setSearchParams]
  );

  const goToSecurity = useCallback(() => {
    selectSection("security");
  }, [selectSection]);

  if (loading) {
    return (
      <AppPage variant="settings" className="pg-settings-page">
        <AppPageContent>
          <AppPageHeader>
            <AppPageTitle>Settings</AppPageTitle>
          </AppPageHeader>
          <div className="pg-settings-layout">
            <div className="pg-settings-nav-skeleton pg-settings-skeleton" />
            <div className="pg-settings-detail-skeleton pg-settings-skeleton" />
          </div>
        </AppPageContent>
      </AppPage>
    );
  }

  if (error && !draft) {
    return (
      <AppPage variant="settings" className="pg-settings-page">
        <AppPageContent>
          <QueryErrorCard
            message={error}
            onRetry={() => {
              void settingsQuery.refetch();
              void profileQuery.refetch();
            }}
            retrying={settingsQuery.isFetching || profileQuery.isFetching}
          />
        </AppPageContent>
      </AppPage>
    );
  }

  if (!draft) return null;

  const footer = activeConfig.supportsSave ? (
    <>
      <Button variant="soft" onClick={cancel} disabled={!dirty || saving}>
        Cancel
      </Button>
      <Button onClick={() => void save()} loading={saving} disabled={!dirty}>
        Save changes
      </Button>
    </>
  ) : null;

  return (
    <AppPage variant="settings" className="pg-settings-page">
      <AppPageContent>
        {!isMobile ? (
          <AppPageHeader>
            <div className="pg-app-page-header__main">
              <AppPageTitle>Settings</AppPageTitle>
              <AppPageSubtitle>Account preferences and workspace configuration.</AppPageSubtitle>
            </div>
          </AppPageHeader>
        ) : null}

        {error ? <div className="pg-alert pg-alert-error pg-settings-page-alert">{error}</div> : null}
        {success ? <div className="pg-alert pg-settings-page-alert">Settings saved.</div> : null}

        {isMobile ? (
          <SettingsNav
            sections={SETTINGS_SECTIONS}
            activeId={activeSection}
            onSelect={selectSection}
            mobile
          />
        ) : null}

        <div className="pg-settings-layout">
          {!isMobile ? (
            <SettingsNav sections={SETTINGS_SECTIONS} activeId={activeSection} onSelect={selectSection} />
          ) : null}

          <SettingsDetailPanel
            icon={activeConfig.icon}
            title={activeConfig.title}
            description={activeConfig.description}
            badge={activeConfig.badge}
          >
            <SettingsSectionContent
              sectionId={activeSection}
              draft={draft}
              patchDraft={patchDraft}
              email={email}
              fullName={fullName}
              avatarUrl={avatarUrl}
              role={role}
              freeUsesRemaining={profile?.free_uses_remaining}
              onEditProfile={() => setEditProfileOpen(true)}
              onOpenInvoiceBanking={() => setInvoiceBankingOpen(true)}
              onOpenChangePassword={() => setChangePasswordOpen(true)}
              onGoToSecurity={goToSecurity}
            />
          </SettingsDetailPanel>
        </div>

        {footer ? (
          <>
            <div className="pg-settings-footer pg-settings-footer-desktop">{footer}</div>
            <div className="pg-settings-footer-mobile">{footer}</div>
          </>
        ) : null}

        <EditProfileModal
          open={editProfileOpen}
          onClose={() => setEditProfileOpen(false)}
          onSaved={(name, avatar) => {
            setFullName(name);
            setAvatarUrl(avatar);
          }}
        />
        <ChangePasswordModal open={changePasswordOpen} onClose={() => setChangePasswordOpen(false)} />
        <InvoiceBankingDetailsModal
          open={invoiceBankingOpen}
          onClose={() => setInvoiceBankingOpen(false)}
        />
      </AppPageContent>
    </AppPage>
  );
}
