import type { AccentColor, DensityPreference } from "../features/settings/settingsTypes";
import {
  applyDocumentTheme,
  applyThemePreference,
  resolveEffectiveUiColorScheme,
  subscribeToSystemTheme,
  type ThemePreference
} from "./uiColorScheme";

export type WorkspaceAppearance = {
  themePreference: ThemePreference;
  accentColor: AccentColor;
  density: DensityPreference;
};

export function applyDocumentAccent(accent: AccentColor): void {
  if (accent === "purple") {
    document.documentElement.removeAttribute("data-accent");
    return;
  }
  document.documentElement.setAttribute("data-accent", accent);
}

export function applyDocumentDensity(_density: DensityPreference): void {
  document.documentElement.setAttribute("data-density", "comfortable");
}

/** Public marketing pages always use the light marketing palette regardless of user prefs. */
export function applyMarketingAppearance(): void {
  applyDocumentTheme("light");
  document.documentElement.removeAttribute("data-accent");
  document.documentElement.removeAttribute("data-density");
}

/** Signed-in workspace/dashboard appearance (theme, accent, density). */
export function applyWorkspaceAppearance(settings: WorkspaceAppearance): void {
  applyThemePreference(settings.themePreference);
  applyDocumentAccent(settings.accentColor);
  applyDocumentDensity(settings.density);
}

/** Live preview while editing settings (persists theme preference to localStorage). */
export function previewWorkspaceAppearance(settings: WorkspaceAppearance): void {
  applyWorkspaceAppearance(settings);
}

export function subscribeWorkspaceSystemTheme(
  themePreference: ThemePreference,
  enabled: boolean,
  onChange: () => void
): () => void {
  if (!enabled || themePreference !== "system") return () => {};
  return subscribeToSystemTheme(onChange);
}

export function resolveWorkspaceDocumentTheme(themePreference: ThemePreference) {
  return resolveEffectiveUiColorScheme(themePreference);
}
