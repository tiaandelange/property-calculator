import { useAuth } from "../../contexts/AuthContext";

/**
 * True when auth bootstrap finished and a signed-in user id is available.
 * Use for `enabled` on protected TanStack Query hooks and data prefetch gates.
 */
export function useAuthQueryEnabled(): boolean {
  const { initialized, authLoading, session } = useAuth();
  return initialized && !authLoading && Boolean(session?.user?.id);
}

/** Signed-in user id — workspace scope for query keys. Undefined until auth is ready. */
export function useWorkspaceId(): string | undefined {
  const authReady = useAuthQueryEnabled();
  const userId = useAuth().session?.user?.id;
  return authReady ? userId : undefined;
}
