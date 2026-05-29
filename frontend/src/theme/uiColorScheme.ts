export const UI_COLOR_SCHEME_STORAGE_KEY = "pg-ui-color-scheme";

export type ThemePreference = "light" | "dark" | "system";

/** Resolved palette applied to the document (light or dark). */
export type UiColorScheme = "dark" | "light";

export function normalizeUiColorScheme(value: unknown): UiColorScheme {
  return value === "light" ? "light" : "dark";
}

export function normalizeThemePreference(value: unknown): ThemePreference {
  if (value === "light" || value === "dark" || value === "system") return value;
  return "system";
}

export function resolveEffectiveUiColorScheme(pref: ThemePreference): UiColorScheme {
  if (pref === "light" || pref === "dark") return pref;
  if (typeof window !== "undefined" && window.matchMedia("(prefers-color-scheme: light)").matches) {
    return "light";
  }
  return "dark";
}

/** Apply palette to `document.documentElement` and mirror preference to localStorage for first paint. */
export function applyUiColorScheme(scheme: UiColorScheme): void {
  const html = document.documentElement;
  if (scheme === "light") {
    html.setAttribute("data-theme", "light");
  } else {
    html.removeAttribute("data-theme");
  }
}

/** Apply theme preference (light/dark/system) immediately for preview. */
export function applyThemePreference(pref: ThemePreference): void {
  applyUiColorScheme(resolveEffectiveUiColorScheme(pref));
  try {
    localStorage.setItem(UI_COLOR_SCHEME_STORAGE_KEY, pref);
  } catch {
    /* ignore quota / private mode */
  }
}

export function readStoredThemePreference(): ThemePreference | null {
  try {
    const v = localStorage.getItem(UI_COLOR_SCHEME_STORAGE_KEY);
    if (v === "light" || v === "dark" || v === "system") return v;
    if (v === "light" || v === "dark") return v;
  } catch {
    /* ignore */
  }
  return null;
}

/** @deprecated Use readStoredThemePreference */
export function readStoredUiColorScheme(): UiColorScheme | null {
  const pref = readStoredThemePreference();
  if (pref === "light" || pref === "dark") return pref;
  if (pref === "system") return resolveEffectiveUiColorScheme("system");
  return null;
}

export function subscribeToSystemTheme(onChange: () => void): () => void {
  if (typeof window === "undefined") return () => {};
  const mq = window.matchMedia("(prefers-color-scheme: light)");
  const handler = () => onChange();
  mq.addEventListener("change", handler);
  return () => mq.removeEventListener("change", handler);
}
