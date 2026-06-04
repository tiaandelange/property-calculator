import { useEffect, useState } from "react";

export type WorkspaceWordmarkVariant = "default" | "on-dark";

function readWorkspaceWordmarkVariant(): WorkspaceWordmarkVariant {
  return document.documentElement.getAttribute("data-theme") === "light" ? "default" : "on-dark";
}

/** Light wordmark on dark workspace chrome; default wordmark on light theme. */
export function useWorkspaceWordmarkVariant(): WorkspaceWordmarkVariant {
  const [variant, setVariant] = useState<WorkspaceWordmarkVariant>(() =>
    typeof document !== "undefined" ? readWorkspaceWordmarkVariant() : "default"
  );

  useEffect(() => {
    setVariant(readWorkspaceWordmarkVariant());
    const observer = new MutationObserver(() => setVariant(readWorkspaceWordmarkVariant()));
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
    return () => observer.disconnect();
  }, []);

  return variant;
}
