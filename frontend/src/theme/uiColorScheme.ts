export const UI_COLOR_SCHEME_STORAGE_KEY = "pg-ui-color-scheme";

export type UiColorScheme = "dark" | "light";

export function normalizeUiColorScheme(value: unknown): UiColorScheme {
  return value === "light" ? "light" : "dark";
}

/** Apply palette to `document.documentElement` and mirror to localStorage for first paint on next load. */
export function applyUiColorScheme(scheme: UiColorScheme): void {
  const html = document.documentElement;
  if (scheme === "light") {
    html.setAttribute("data-theme", "light");
  } else {
    html.removeAttribute("data-theme");
  }
  try {
    localStorage.setItem(UI_COLOR_SCHEME_STORAGE_KEY, scheme);
  } catch {
    /* ignore quota / private mode */
  }
}

export function readStoredUiColorScheme(): UiColorScheme | null {
  try {
    const v = localStorage.getItem(UI_COLOR_SCHEME_STORAGE_KEY);
    if (v === "light" || v === "dark") return v;
  } catch {
    /* ignore */
  }
  return null;
}
