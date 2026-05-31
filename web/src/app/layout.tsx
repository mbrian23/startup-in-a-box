import type { Metadata } from 'next';
import { Press_Start_2P, VT323, JetBrains_Mono } from 'next/font/google';
import './globals.css';

const display = Press_Start_2P({ subsets: ['latin'], weight: '400', variable: '--font-display', display: 'swap' });
const pixel = VT323({ subsets: ['latin'], weight: '400', variable: '--font-pixel', display: 'swap' });
const mono = JetBrains_Mono({ subsets: ['latin'], variable: '--font-mono', display: 'swap' });

const SITE_URL = 'https://startup-deck.martinbrian.com';
const TITLE = 'Startup in a Box — Martin Brian';
const DESCRIPTION =
  'How Google ADK and the Claude Agent SDK, wired together, build a startup while you watch. The slide deck.';

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: TITLE,
  description: DESCRIPTION,
  applicationName: 'Startup in a Box — Deck',
  authors: [{ name: 'Martin Brian', url: 'https://martinbrian.com' }],
  creator: 'Martin Brian',
  keywords: [
    'Startup in a Box',
    'agentic AI',
    'Claude Agent SDK',
    'Google ADK',
    'slide deck',
    'Martin Brian',
  ],
  alternates: { canonical: '/' },
  openGraph: {
    title: TITLE,
    description: DESCRIPTION,
    url: SITE_URL,
    siteName: 'Startup in a Box',
    locale: 'en_US',
    type: 'article',
  },
  twitter: {
    card: 'summary_large_image',
    title: TITLE,
    description: DESCRIPTION,
  },
  robots: {
    index: true,
    follow: true,
    googleBot: { index: true, follow: true, 'max-image-preview': 'large' },
  },
};

const SCHEMA = {
  '@context': 'https://schema.org',
  '@type': 'PresentationDigitalDocument',
  name: 'Startup in a Box',
  description: DESCRIPTION,
  url: SITE_URL,
  author: { '@type': 'Person', name: 'Martin Brian', url: 'https://martinbrian.com' },
  isPartOf: { '@type': 'CollectionPage', name: 'Talks — Martin Brian', url: 'https://talks.martinbrian.com/' },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${display.variable} ${pixel.variable} ${mono.variable}`}>
      <head>
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(SCHEMA) }} />
      </head>
      <body>{children}</body>
    </html>
  );
}
