import type { MetadataRoute } from "next";

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    {
      url: "https://startupinabox.martinbrian.com/",
      changeFrequency: "monthly",
      priority: 1,
    },
  ];
}
