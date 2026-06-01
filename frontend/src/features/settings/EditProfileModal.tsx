import { FormEvent, useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { AppFormModal } from "../../components/ui/AppModal";
import { Button } from "../../components/ui/Button";
import { Field, Input } from "../../components/ui/Input";
import { useAuth } from "../../contexts/AuthContext";
import { updateProfileDetails, uploadProfileAvatar } from "../../services/profileSupabase";
import { upsertUserSettings } from "../../services/settingsSupabase";
import { invalidateSettingsQueries, queryKeys, useProfileQuery, useSettingsQuery, useWorkspaceId } from "../queries";
import {
  profileContactFormFromMe,
  profileContactFormToPayloads,
  type ProfileContactFormState
} from "./profileContactForm";

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

type Props = {
  open: boolean;
  onClose: () => void;
  onSaved: (name: string, avatarUrl: string | null) => void;
};

export function EditProfileModal({ open, onClose, onSaved }: Props) {
  const { refreshProfile } = useAuth();
  const queryClient = useQueryClient();
  const workspaceId = useWorkspaceId();
  const profileQuery = useProfileQuery({ enabled: open });
  const settingsQuery = useSettingsQuery({ enabled: open });
  const fileRef = useRef<HTMLInputElement>(null);
  const [form, setForm] = useState<ProfileContactFormState | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [error, setError] = useState("");

  const loginEmail = profileQuery.data?.email ?? "";

  useEffect(() => {
    if (!open) {
      setError("");
      return;
    }
    void profileQuery.refetch();
    void settingsQuery.refetch();
  }, [open, profileQuery, settingsQuery]);

  useEffect(() => {
    if (!open || !profileQuery.data) return;
    const me = profileQuery.data;
    setForm(
      profileContactFormFromMe(
        {
          name: me.name,
          email: me.email,
          profileDetails: me.profileDetails,
          businessDetails: me.businessDetails
        },
        settingsQuery.data?.useBusinessForFinancials ?? false
      )
    );
    setAvatarPreview(me.avatarUrl ?? null);
  }, [open, profileQuery.data, profileQuery.dataUpdatedAt, settingsQuery.data?.useBusinessForFinancials]);

  const patch = (partial: Partial<ProfileContactFormState>) => {
    setForm((prev) => (prev ? { ...prev, ...partial } : prev));
  };

  const onAvatarPick = async (file: File | null) => {
    if (!file || !form) return;
    setUploadingAvatar(true);
    setError("");
    try {
      const key = await uploadProfileAvatar(file);
      patch({ avatarStorageKey: key });
      setAvatarPreview(URL.createObjectURL(file));
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Could not upload photo.");
    } finally {
      setUploadingAvatar(false);
    }
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!form) return;
    setSaving(true);
    setError("");
    try {
      const payloads = profileContactFormToPayloads(form);
      await updateProfileDetails({
        fullName: payloads.fullName,
        profileDetails: payloads.profileDetails,
        businessDetails: payloads.businessDetails
      });
      await upsertUserSettings({ useBusinessForFinancials: payloads.useBusinessForFinancials });
      await refreshProfile();
      if (workspaceId) {
        await queryClient.invalidateQueries({ queryKey: queryKeys.profile(workspaceId) });
      }
      invalidateSettingsQueries({ queryClient, workspaceId });
      const refetched = await profileQuery.refetch();
      onSaved(form.fullName, refetched.data?.avatarUrl ?? avatarPreview);
      onClose();
    } catch (ex: unknown) {
      setError(ex instanceof Error ? ex.message : "Could not save profile.");
    } finally {
      setSaving(false);
    }
  };

  const loading = open && (!form || profileQuery.isLoading);

  return (
    <AppFormModal
      open={open}
      onOpenChange={(next) => {
        if (!next && !saving) onClose();
      }}
      title="Edit profile"
      description="Personal details for your account. Business details can be used on invoices and financial documents."
      size="md"
      loading={saving}
      closeOnOverlayClick={!saving}
      onSubmit={(e) => void submit(e)}
      footer={
        <div className="pg-app-modal-actions">
          <Button type="button" variant="soft" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button type="submit" loading={saving} disabled={loading || uploadingAvatar}>
            Save
          </Button>
        </div>
      }
    >
      {loading ? (
        <p className="pg-muted">Loading…</p>
      ) : form ? (
        <div className="pg-edit-profile-fields">
          <section className="pg-edit-profile-section">
            <h3 className="pg-edit-profile-section-title">Profile</h3>
            <div className="pg-edit-profile-avatar-row">
              <div className="pg-settings-avatar pg-edit-profile-avatar">
                {avatarPreview ? (
                  <img src={avatarPreview} alt="" className="pg-edit-profile-avatar-img" />
                ) : (
                  <span aria-hidden>{(form.fullName || loginEmail).slice(0, 2).toUpperCase()}</span>
                )}
              </div>
              <div>
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  className="pg-visually-hidden"
                  onChange={(e) => void onAvatarPick(e.target.files?.[0] ?? null)}
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  loading={uploadingAvatar}
                  disabled={saving}
                  onClick={() => fileRef.current?.click()}
                >
                  {avatarPreview ? "Change photo" : "Upload photo"}
                </Button>
                <p className="pg-text-helper" style={{ marginTop: 8 }}>
                  PNG, JPG, or WebP. Shown in Settings and your workspace header when available.
                </p>
              </div>
            </div>
            <Field label="Full name">
              <Input
                value={form.fullName}
                onChange={(e) => patch({ fullName: e.target.value })}
                autoComplete="name"
                disabled={saving}
              />
            </Field>
            <Field label="Email" help="Login email. Change via account security if your provider allows it.">
              <Input type="email" value={loginEmail} disabled readOnly />
            </Field>
            <Field label="Cell number">
              <Input
                type="tel"
                value={form.personalPhone}
                onChange={(e) => patch({ personalPhone: e.target.value })}
                autoComplete="tel"
                disabled={saving}
              />
            </Field>
            <Field label="Address">
              <textarea
                className="pg-input pg-inv-banking-modal-textarea"
                rows={2}
                value={form.personalAddress}
                onChange={(e) => patch({ personalAddress: e.target.value })}
                disabled={saving}
              />
            </Field>
          </section>

          <section className="pg-edit-profile-section">
            <h3 className="pg-edit-profile-section-title">Business details</h3>
            <div className="pg-settings-row pg-edit-profile-toggle-row">
              <div>
                <div className="pg-settings-row-label">Use business details for financials</div>
                <div className="pg-settings-row-desc">
                  When on, invoice PDFs and related documents use business details instead of your personal profile.
                </div>
              </div>
              <SettingsToggle
                label="Use business details for financials"
                checked={form.useBusinessForFinancials}
                disabled={saving}
                onChange={(useBusinessForFinancials) => patch({ useBusinessForFinancials })}
              />
            </div>
            <Field label="Business name">
              <Input
                value={form.businessName}
                onChange={(e) => patch({ businessName: e.target.value })}
                autoComplete="organization"
                disabled={saving}
              />
            </Field>
            <Field label="Landlord name" help="Contact name shown on invoices when using business details.">
              <Input
                value={form.landlordName}
                onChange={(e) => patch({ landlordName: e.target.value })}
                autoComplete="name"
                disabled={saving}
              />
            </Field>
            <Field label="Business email">
              <Input
                type="email"
                value={form.businessEmail}
                onChange={(e) => patch({ businessEmail: e.target.value })}
                autoComplete="email"
                disabled={saving}
              />
            </Field>
            <Field label="Business cell number">
              <Input
                type="tel"
                value={form.businessPhone}
                onChange={(e) => patch({ businessPhone: e.target.value })}
                autoComplete="tel"
                disabled={saving}
              />
            </Field>
            <Field label="Business address">
              <textarea
                className="pg-input pg-inv-banking-modal-textarea"
                rows={2}
                value={form.businessAddress}
                onChange={(e) => patch({ businessAddress: e.target.value })}
                disabled={saving}
              />
            </Field>
          </section>
        </div>
      ) : null}
      {error ? (
        <div className="pg-alert pg-alert-error" role="alert" style={{ marginTop: 12 }}>
          {error}
        </div>
      ) : null}
    </AppFormModal>
  );
}
