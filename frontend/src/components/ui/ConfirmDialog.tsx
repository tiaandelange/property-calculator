import type { ReactNode } from "react";
import { AppConfirmDialog } from "./AppModal";

export function ConfirmDialog({
  open,
  title,
  children,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  confirmVariant = "primary",
  loading,
  onConfirm,
  onClose
}: {
  open: boolean;
  title: string;
  children: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  confirmVariant?: "primary" | "danger";
  loading?: boolean;
  onConfirm: () => void;
  onClose: () => void;
}) {
  return (
    <AppConfirmDialog
      open={open}
      title={title}
      confirmLabel={confirmLabel}
      cancelLabel={cancelLabel}
      destructive={confirmVariant === "danger"}
      loading={loading}
      onConfirm={onConfirm}
      onClose={onClose}
    >
      {children}
    </AppConfirmDialog>
  );
}
