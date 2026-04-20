import type { Metadata } from 'next';
import { Press_Start_2P, VT323, JetBrains_Mono } from 'next/font/google';
import './globals.css';

const display = Press_Start_2P({ subsets: ['latin'], weight: '400', variable: '--font-display', display: 'swap' });
const pixel = VT323({ subsets: ['latin'], weight: '400', variable: '--font-pixel', display: 'swap' });
const mono = JetBrains_Mono({ subsets: ['latin'], variable: '--font-mono', display: 'swap' });

export const metadata: Metadata = {
  title: 'Startup in a Box — Martin Brian',
  description: 'How Google ADK and the Claude Agent SDK, wired together, build a startup while you watch.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${display.variable} ${pixel.variable} ${mono.variable}`}>
      <body>{children}</body>
    </html>
  );
}
