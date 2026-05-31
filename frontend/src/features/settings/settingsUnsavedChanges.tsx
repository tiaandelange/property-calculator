import {
  createContext,
  useCallback,
  useContext,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode
} from "react";
import { AppModal } from "../../components/ui/AppModal";
import { Button } from "../../components/ui/Button";
import { useSettingsLeaveGuard } from "./useSettingsLeaveGuard";

type SettingsGuardHandlers = {
  dirty: boolean;
  save: () => Promise<boolean>;
  discard: () => void;
};

type SettingsUnsavedChangesContextValue = {
  syncGuard: (handlers: SettingsGuardHandlers | null) => void;
};

const emptyHandlers: SettingsGuardHandlers = {
  dirty: false,
  save: async () => true,
  discard: () => undefined
};

const SettingsUnsavedChangesContext = createContext<SettingsUnsavedChangesContextValue | null>(null);

export function SettingsUnsavedChangesProvider({ children }: { children: ReactNode }) {
  const guardRef = useRef<SettingsGuardHandlers>(emptyHandlers);
  const [, setGuardVersion] = useState(0);
  const [leaveSaving, setLeaveSaving] = useState(false);

  const syncGuard = useCallback((handlers: SettingsGuardHandlers | null) => {
    guardRef.current = handlers ?? emptyHandlers;
    setGuardVersion((version) => version + 1);
  }, []);

  const { dirty, save, discard } = guardRef.current;

  const { leaveDialogOpen, cancelLeave, confirmLeaveSave, confirmLeaveDiscard } = useSettingsLeaveGuard(
    dirty,
    save,
    discard
  );

  const handleLeaveSave = async () => {
    setLeaveSaving(true);
    try {
      await confirmLeaveSave();
    } finally {
      setLeaveSaving(false);
    }
  };

  const value = useMemo(
    () => ({
      syncGuard
    }),
    [syncGuard]
  );

  return (
    <SettingsUnsavedChangesContext.Provider value={value}>
      {children}
      <AppModal
        open={leaveDialogOpen}
        onOpenChange={(open) => {
          if (!open) cancelLeave();
        }}
        onClose={cancelLeave}
        title="Save before leaving"
        description="You have unsaved changes. Save them before leaving settings?"
        closeOnOverlayClick={!leaveSaving}
        footer={
          <div className="pg-app-modal-actions">
            <Button type="button" variant="soft" onClick={confirmLeaveDiscard} disabled={leaveSaving}>
              Discard
            </Button>
            <Button type="button" onClick={() => void handleLeaveSave()} loading={leaveSaving}>
              Save
            </Button>
          </div>
        }
      >
        {null}
      </AppModal>
    </SettingsUnsavedChangesContext.Provider>
  );
}

export function useRegisterSettingsUnsavedChanges(
  dirty: boolean,
  save: () => Promise<boolean>,
  discard: () => void
) {
  const context = useContext(SettingsUnsavedChangesContext);
  const saveRef = useRef(save);
  const discardRef = useRef(discard);

  saveRef.current = save;
  discardRef.current = discard;

  const handlers = useMemo(
    () => ({
      dirty,
      save: () => saveRef.current(),
      discard: () => discardRef.current()
    }),
    [dirty]
  );

  useLayoutEffect(() => {
    if (!context) return;
    context.syncGuard(handlers);
    return () => {
      if (!handlers.dirty) {
        context.syncGuard(null);
      }
    };
  }, [context, handlers]);
}
