import type { ReactNode } from "react";
import { Button } from "./Button";
import { ModalOverlay, ModalPanel } from "./Modal";

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
  if (!open) return null;

  return (
    <>
      <ModalOverlay open onClose={onClose} />
      <div
        style={{
          position: "fixed",
          inset: 0,
          display: "grid",
          placeItems: "center",
          padding: 16,
          zIndex: 60,
          pointerEvents: "none"
        }}
      >
        <div style={{ pointerEvents: "auto", width: "min(100%, 440px)" }}>
          <ModalPanel
            title={title}
            onClose={onClose}
            actions={
              <>
                <Button type="button" variant="ghost" onClick={onClose} disabled={loading}>
                  {cancelLabel}
                </Button>
                <Button
                  type="button"
                  variant={confirmVariant === "danger" ? "danger" : "primary"}
                  onClick={onConfirm}
                  loading={loading}
                >
                  {confirmLabel}
                </Button>
              </>
            }
          >
            <div style={{ padding: "4px 0 0" }}>{children}</div>
          </ModalPanel>
        </div>
      </div>
    </>
  );
}
