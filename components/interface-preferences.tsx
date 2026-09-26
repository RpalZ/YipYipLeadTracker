"use client";

import { createContext, useContext, useMemo, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";

import { uiCopy, type UiCopy } from "@/lib/i18n";
import {
  preferenceCookie,
  UI_LOCALE_COOKIE,
  UI_THEME_COOKIE,
  type UiLocale,
  type UiTheme,
} from "@/lib/interface-preferences";

interface InterfacePreferencesValue {
  locale: UiLocale;
  theme: UiTheme;
  copy: UiCopy;
  setLocale: (locale: UiLocale) => void;
  setTheme: (theme: UiTheme) => void;
}

const InterfacePreferencesContext = createContext<InterfacePreferencesValue | null>(null);

export function InterfacePreferencesProvider({
  initialLocale,
  initialTheme,
  children,
}: {
  initialLocale: UiLocale;
  initialTheme: UiTheme;
  children: ReactNode;
}) {
  const router = useRouter();
  const [locale, updateLocale] = useState(initialLocale);
  const [theme, updateTheme] = useState(initialTheme);

  const value = useMemo<InterfacePreferencesValue>(() => ({
    locale,
    theme,
    copy: uiCopy[locale],
    setLocale(nextLocale) {
      updateLocale(nextLocale);
      document.documentElement.lang = nextLocale;
      document.cookie = preferenceCookie(UI_LOCALE_COOKIE, nextLocale);
      router.refresh();
    },
    setTheme(nextTheme) {
      updateTheme(nextTheme);
      document.documentElement.dataset.theme = nextTheme;
      document.documentElement.style.colorScheme = nextTheme;
      document.cookie = preferenceCookie(UI_THEME_COOKIE, nextTheme);
    },
  }), [locale, router, theme]);

  return <InterfacePreferencesContext.Provider value={value}>{children}</InterfacePreferencesContext.Provider>;
}

export function useInterfacePreferences(): InterfacePreferencesValue {
  const value = useContext(InterfacePreferencesContext);
  if (!value) throw new Error("useInterfacePreferences must be used inside InterfacePreferencesProvider.");
  return value;
}

function PreferenceIcon({ name }: { name: "sun" | "moon" | "language" }) {
  const paths = {
    sun: <><circle cx="12" cy="12" r="3.5" /><path d="M12 2v2M12 20v2M4.93 4.93l1.42 1.42M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.42-1.42M17.66 6.34l1.41-1.41" /></>,
    moon: <path d="M20 15.2A8.2 8.2 0 0 1 8.8 4a8.2 8.2 0 1 0 11.2 11.2Z" />,
    language: <><circle cx="12" cy="12" r="9" /><path d="M3 12h18M12 3c2.2 2.4 3.2 5.4 3.2 9S14.2 18.6 12 21M12 3C9.8 5.4 8.8 8.4 8.8 12s1 6.6 3.2 9" /></>,
  };
  return <svg aria-hidden="true" viewBox="0 0 24 24">{paths[name]}</svg>;
}

export function InterfacePreferenceControls() {
  const { locale, theme, copy, setLocale, setTheme } = useInterfacePreferences();
  const nextLocale = locale === "en" ? "nl" : "en";
  const nextTheme = theme === "light" ? "dark" : "light";

  return (
    <div className="interface-preferences" aria-label={`${copy.preferences.language} / ${copy.preferences.theme}`}>
      <button
        type="button"
        onClick={() => setLocale(nextLocale)}
        aria-label={nextLocale === "nl" ? copy.preferences.switchToDutch : copy.preferences.switchToEnglish}
        title={nextLocale === "nl" ? copy.preferences.switchToDutch : copy.preferences.switchToEnglish}
      >
        <PreferenceIcon name="language" />
        <span>{locale.toUpperCase()}</span>
      </button>
      <button
        type="button"
        onClick={() => setTheme(nextTheme)}
        aria-label={nextTheme === "dark" ? copy.preferences.darkMode : copy.preferences.lightMode}
        title={nextTheme === "dark" ? copy.preferences.darkMode : copy.preferences.lightMode}
      >
        <PreferenceIcon name={theme === "light" ? "moon" : "sun"} />
      </button>
    </div>
  );
}
