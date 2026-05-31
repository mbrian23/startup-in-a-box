import type { Metadata } from "next";
import Script from "next/script";
import "./globals.css";

const SITE_URL = "https://startupinabox.martinbrian.com";
const TITLE = "Startup in a Box — autonomous agent swarm that builds startups";
const DESCRIPTION =
  "An open-source dual-agent system: a boardroom (Google ADK) plans a startup while a factory (Claude Agent SDK) builds and deploys it — streamed live. Built by Martin Brian.";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: { default: TITLE, template: "%s · Startup in a Box" },
  description: DESCRIPTION,
  applicationName: "Startup in a Box",
  authors: [{ name: "Martin Brian", url: "https://martinbrian.com" }],
  creator: "Martin Brian",
  keywords: [
    "Startup in a Box",
    "agentic AI",
    "multi-agent system",
    "Claude Agent SDK",
    "Google ADK",
    "AG-UI protocol",
    "autonomous agents",
    "AI demo",
    "Martin Brian",
  ],
  alternates: { canonical: "/" },
  openGraph: {
    title: TITLE,
    description: DESCRIPTION,
    url: SITE_URL,
    siteName: "Startup in a Box",
    locale: "en_US",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: TITLE,
    description:
      "A boardroom of AI agents plans a startup while a factory builds and deploys it — live.",
  },
  robots: {
    index: true,
    follow: true,
    googleBot: { index: true, follow: true, "max-image-preview": "large" },
  },
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
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@type": "SoftwareApplication",
              name: "Startup in a Box",
              applicationCategory: "DeveloperApplication",
              operatingSystem: "Web",
              description:
                "Open-source dual-agent system: a boardroom (Google ADK) plans a startup while a factory (Claude Agent SDK) builds and deploys it, streamed live.",
              url: "https://startupinabox.martinbrian.com",
              author: {
                "@type": "Person",
                name: "Martin Brian",
                url: "https://martinbrian.com",
              },
              offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
              codeRepository: "https://github.com/mbrian23/startup-in-a-box",
            }),
          }}
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
