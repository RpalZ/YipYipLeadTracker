import type { Metadata } from "next";
import { JetBrains_Mono } from "next/font/google";
import type { ReactNode } from "react";

import { MotionProvider } from "@/components/motion-provider";

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

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" data-scroll-behavior="smooth">
      <body className={jetBrainsMono.variable}><MotionProvider>{children}</MotionProvider></body>
    </html>
  );
}
