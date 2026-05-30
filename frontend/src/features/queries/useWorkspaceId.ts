import { useAuth } from "../../contexts/AuthContext";

/** Signed-in user id — used as workspace scope for query keys. */
export function useWorkspaceId(): string | undefined {
  return useAuth().session?.user?.id;
}
