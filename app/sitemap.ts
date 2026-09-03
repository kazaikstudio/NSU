import type { MetadataRoute } from "next";

export const revalidate = 3600;

const BASE_URL = "https://nollstudios.org";

const publicRoutes = [
  "/",
  "/about",
  "/Audio",
  "/download",
  "/downloads",
  "/Feature",
  "/search",
] as const;

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();

  return publicRoutes.map((route) => ({
    url: `${BASE_URL}${route}`,
    lastModified: now,
    changeFrequency: route === "/" ? "daily" : "weekly",
    priority: route === "/" ? 1.0 : 0.7,
  }));
}
