import type { MetadataRoute } from 'next';

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    {
      url: 'https://startup-deck.martinbrian.com/',
      changeFrequency: 'monthly',
      priority: 1,
    },
  ];
}
