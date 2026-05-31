import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Startup in a Box — Deck',
    short_name: 'SIB Deck',
    description: 'How Google ADK and the Claude Agent SDK build a startup while you watch.',
    start_url: '/',
    display: 'standalone',
    background_color: '#0B1220',
    theme_color: '#0B1220',
  };
}
