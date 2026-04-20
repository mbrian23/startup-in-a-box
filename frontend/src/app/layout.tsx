import type { Metadata } from "next";
import Script from "next/script";
import "./globals.css";

export const metadata: Metadata = {
  title: "Startup in a Box",
  description: "Dual-screen multi-agent demo",
};

// Inline pre-hydration script: read the persisted theme before React
// paints, so returning visitors don't flash the default palette.
const THEME_INIT = `(function(){try{var t=localStorage.getItem('sib:theme');if(t)document.documentElement.dataset.theme=t;}catch(e){}})();`;

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    // suppressHydrationWarning: the inline theme-init script intentionally
    // sets data-theme on <html> before hydration so returning users don't
    // flash the default palette. The mismatch is expected and scoped to
    // this one attribute.
    <html lang="en" suppressHydrationWarning>
      <head>
        <Script id="theme-init" strategy="beforeInteractive">{THEME_INIT}</Script>
      </head>
      <body>{children}</body>
    </html>
  );
}
