import type { MetadataRoute } from "next";

const BASE_URL = "https://nollstudios.org";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: [
        "/about",
        "/artist",
        "/Audio",
        "/Comedy",
        "/Feature",
        "/download",
        "/downloads",
        "/search",
        "/video",
        "/dashboard",
        "/uploads",
        "/api",
      ],
    },
    sitemap: `${BASE_URL}/sitemap.xml`,
  };
}
