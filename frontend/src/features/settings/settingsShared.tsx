import { FormEvent, useEffect, useState } from "react";
import { AppFormModal } from "../../components/ui/AppModal";
import { Button } from "../../components/ui/Button";
import { Field, Input } from "../../components/ui/Input";
import { supabase } from "../../lib/supabaseClient";

export function profileInitials(name: string | null | undefined, email: string): string {
  const n = (name ?? "").trim();
  if (n) {
    const parts = n.split(/\s+/).filter(Boolean);
    if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    return parts[0].slice(0, 2).toUpperCase();
  }
  return email.slice(0, 2).toUpperCase();
}

export function SettingsToggle({
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

export function ChangePasswordModal({ open, onClose }: { open: boolean; onClose: () => void }) {
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
