export const UI_LOCALE_COOKIE = "yipyip-ui-locale";
export const UI_THEME_COOKIE = "yipyip-ui-theme";

export type UiLocale = "en" | "nl";
export type UiTheme = "light" | "dark";

export function resolveUiLocale(value: unknown): UiLocale {
  return value === "nl" ? "nl" : "en";
}

export function resolveUiTheme(value: unknown): UiTheme {
  return value === "dark" ? "dark" : "light";
}

export function preferenceCookie(name: string, value: string): string {
  return `${name}=${encodeURIComponent(value)}; Path=/; Max-Age=31536000; SameSite=Lax`;
}
