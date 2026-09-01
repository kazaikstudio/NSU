import type { MetadataRoute } from "next";

export const revalidate = 3600;

const BASE_URL = "https://nollstudios.org";
const HOME_URL = `${BASE_URL}/`;

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();

  return [
    {
      url: HOME_URL,
      lastModified: now,
      changeFrequency: "daily",
      priority: 1.0,
    }
  ];
}

