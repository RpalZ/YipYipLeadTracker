import type { Metadata } from "next";
import { JetBrains_Mono } from "next/font/google";
import { cookies } from "next/headers";
import type { ReactNode } from "react";

import { InterfacePreferencesProvider } from "@/components/interface-preferences";
import { MotionProvider } from "@/components/motion-provider";
import {
  resolveUiLocale,
  resolveUiTheme,
  UI_LOCALE_COOKIE,
  UI_THEME_COOKIE,
} from "@/lib/interface-preferences";

import "./globals.css";

const jetBrainsMono = JetBrains_Mono({
  variable: "--font-jetbrains-mono",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "YipYip Early Signal",
  description: "Find and qualify digital project opportunities before formal procurement.",
};

export default async function RootLayout({ children }: { children: ReactNode }) {
  const cookieStore = await cookies();
  const locale = resolveUiLocale(cookieStore.get(UI_LOCALE_COOKIE)?.value);
  const theme = resolveUiTheme(cookieStore.get(UI_THEME_COOKIE)?.value);

  return (
    <html lang={locale} data-theme={theme} data-scroll-behavior="smooth" style={{ colorScheme: theme }}>
      <body className={jetBrainsMono.variable}>
        <InterfacePreferencesProvider initialLocale={locale} initialTheme={theme}>
          <MotionProvider>{children}</MotionProvider>
        </InterfacePreferencesProvider>
      </body>
    </html>
  );
}
