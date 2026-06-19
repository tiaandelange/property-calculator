import { useCallback, useEffect, useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useNavigate, useSearchParams } from "react-router-dom";
import { AppPage, AppPageContent } from "../../components/ui/AppPage";
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
import { SettingsSaveBar } from "./components/SettingsSaveBar";
import { MobileSettingsHome } from "./MobileSettingsHome";
import { MobileSettingsScreen } from "./MobileSettingsScreen";
import type { UserSettings } from "./settingsTypes";
import { useMobileSettingsSubtitles } from "./useMobileSettingsSubtitles";
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
  settingsSectionMobileTitle,
  settingsSectionPath,
  type SettingsSectionId
} from "./settingsSections";

const DRAFT_SECTIONS: SettingsSectionId[] = [
  "general",
  "appearance",
  "invoice-banking",
  "notifications"
];

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
  const [saveError, setSaveError] = useState("");
  const [success, setSuccess] = useState(false);
  const [email, setEmail] = useState("");
  const [fullName, setFullName] = useState("");
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [avatarIcon, setAvatarIcon] = useState<string | null>(null);
  const [role, setRole] = useState("");
  const [editProfileOpen, setEditProfileOpen] = useState(false);
  const [changePasswordOpen, setChangePasswordOpen] = useState(false);
  const [invoiceBankingOpen, setInvoiceBankingOpen] = useState(false);

  const rawSectionParam = searchParams.get("section");
  const mobileShowHome = isMobile && !rawSectionParam;
  const activeSection = useMemo(
    () => resolveSettingsSection(rawSectionParam),
    [rawSectionParam]
  );
  const activeConfig = getSettingsSection(activeSection);
  const { subtitleForItem, planName } = useMobileSettingsSubtitles(draft, fullName, email);

  const settingsLoadError = settingsQuery.error
    ? formatQueryErrorMessage(settingsQuery.error, "Could not load settings.")
    : "";
  const profileLoadError = profileQuery.error
    ? formatQueryErrorMessage(profileQuery.error, "Could not load profile.")
    : "";

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
      setAvatarIcon(profileQuery.data.profileDetails?.avatarIcon ?? null);
      setRole(profileQuery.data.role ?? "USER");
    }
  }, [profileQuery.data]);

  const initialLoading =
    (settingsQuery.isLoading && !settingsQuery.data) || (profileQuery.isLoading && !profileQuery.data);

  useEffect(() => {
    const next = new URLSearchParams(searchParams);
    let changed = false;

    if (!isMobile && !next.get("section")) {
      next.set("section", "general");
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
  }, [searchParams, setSearchParams, isMobile]);

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
    setSaveError("");
  }, [saved]);

  const save = useCallback(async (): Promise<boolean> => {
    if (!draft || !saved) return false;
    const validationError = validateUserSettings(draft);
    if (validationError) {
      setSaveError(validationError);
      return false;
    }
    setSaving(true);
    setSaveError("");
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
      setSaveError(e instanceof Error ? e.message : "Could not save settings.");
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

  const goMobileHome = useCallback(() => {
    const next = new URLSearchParams(searchParams);
    next.delete("section");
    next.delete("invoiceBanking");
    setSearchParams(next, { replace: false });
  }, [searchParams, setSearchParams]);

  const goDashboard = useCallback(() => {
    navigate("/owned-properties/dashboard");
  }, [navigate]);

  const sectionNeedsDraft = DRAFT_SECTIONS.includes(activeSection);
  const sectionBlockedBySettings = sectionNeedsDraft && !draft && Boolean(settingsLoadError);

  if (initialLoading) {
    return (
      <AppPage variant="settings" className="pg-settings-page">
        <AppPageContent>
          <div className="pg-settings-panel-wrap">
            <div className="pg-settings-panel pg-settings-panel--loading" aria-busy="true">
              <div className="pg-settings-panel__grid">
                <div className="pg-settings-nav-skeleton pg-settings-skeleton" />
                <div className="pg-settings-detail-skeleton pg-settings-skeleton" />
              </div>
            </div>
          </div>
        </AppPageContent>
      </AppPage>
    );
  }

  if (!draft && !profileQuery.data && settingsLoadError && profileLoadError) {
    return (
      <AppPage variant="settings" className="pg-settings-page">
        <AppPageContent>
          <QueryErrorCard
            message={settingsLoadError || profileLoadError}
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

  const showSaveBar = activeConfig.supportsSave && draft && dirty;

  const saveBar = showSaveBar ? (
    <>
      <Button variant="soft" onClick={cancel} disabled={saving}>
        Cancel
      </Button>
      <Button onClick={() => void save()} loading={saving}>
        Save changes
      </Button>
    </>
  ) : null;

  const sectionContent = sectionBlockedBySettings ? (
    <QueryErrorCard
      message={settingsLoadError}
      onRetry={() => void settingsQuery.refetch()}
      retrying={settingsQuery.isFetching}
    />
  ) : (
    <SettingsSectionContent
      sectionId={activeSection}
      draft={draft}
      patchDraft={patchDraft}
      email={email}
      fullName={fullName}
      avatarUrl={avatarUrl}
      avatarIcon={avatarIcon}
      role={role}
      freeUsesRemaining={profile?.free_uses_remaining}
      settingsLoadError={settingsLoadError}
      profileLoadError={profileLoadError}
      onRetrySettings={() => void settingsQuery.refetch()}
      onRetryProfile={() => void profileQuery.refetch()}
      settingsRetrying={settingsQuery.isFetching}
      profileRetrying={profileQuery.isFetching}
      onEditProfile={() => setEditProfileOpen(true)}
      onOpenInvoiceBanking={() => setInvoiceBankingOpen(true)}
      onOpenChangePassword={() => setChangePasswordOpen(true)}
    />
  );

  const sectionAlerts = (
    <>
      {saveError ? <div className="pg-alert pg-alert-error pg-settings-panel-alert">{saveError}</div> : null}
      {success ? <div className="pg-alert pg-settings-panel-alert">Settings saved.</div> : null}
    </>
  );

  return (
    <AppPage
      variant="settings"
      className={[
        "pg-settings-page",
        isMobile ? "pg-settings-page--mobile" : "",
        mobileShowHome ? "pg-settings-page--mobile-home" : "",
        isMobile && !mobileShowHome ? "pg-settings-page--mobile-section" : ""
      ]
        .filter(Boolean)
        .join(" ")}
    >
      <AppPageContent>
        {isMobile && mobileShowHome ? (
          <MobileSettingsHome
            fullName={fullName}
            email={email}
            avatarUrl={avatarUrl}
            avatarIcon={avatarIcon}
            planName={planName}
            onBack={goDashboard}
            onSelectSection={selectSection}
            subtitleForItem={subtitleForItem}
          />
        ) : isMobile ? (
          <MobileSettingsScreen
            title={settingsSectionMobileTitle(activeConfig)}
            onBack={goMobileHome}
            footer={
              showSaveBar ? (
                <SettingsSaveBar mobile>{saveBar}</SettingsSaveBar>
              ) : null
            }
          >
            <div
              className={[
                "pg-settings-mobile-section__content",
                showSaveBar ? "pg-settings-mobile-section__content--save-bar" : ""
              ]
                .filter(Boolean)
                .join(" ")}
            >
              {sectionAlerts}
              {sectionContent}
            </div>
          </MobileSettingsScreen>
        ) : (
          <div className="pg-settings-panel-wrap">
            <div className="pg-settings-panel">
              <div className="pg-settings-panel__grid">
                <SettingsNav sections={SETTINGS_SECTIONS} activeId={activeSection} onSelect={selectSection} />

                <div
                  className={[
                    "pg-settings-panel__content",
                    showSaveBar ? "pg-settings-panel__content--save-bar" : ""
                  ]
                    .filter(Boolean)
                    .join(" ")}
                >
                  <SettingsDetailPanel title={activeConfig.title} badge={activeConfig.badge}>
                    {sectionAlerts}
                    {sectionContent}
                  </SettingsDetailPanel>

                  {saveBar ? <SettingsSaveBar mobile={false}>{saveBar}</SettingsSaveBar> : null}
                </div>
              </div>
            </div>
          </div>
        )}

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
