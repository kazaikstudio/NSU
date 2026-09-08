import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactCompiler: false,
  async headers() {
    return [
      {
        source: "/(about|artist|Audio|Comedy|Feature|download|downloads|search|video|dashboard|uploads)(/:path*)?",
        headers: [{ key: "X-Robots-Tag", value: "noindex, nofollow" }],
      },
      {
        source: "/api/:path*",
        headers: [{ key: "X-Robots-Tag", value: "noindex, nofollow" }],
      },
    ];
  },
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: 'images.unsplash.com',
      },
      {
        protocol: "https",
        hostname: "i.ytimg.com",
      },
      {
        protocol: "https",
        hostname: 'yt3.ggpht.com',
      },
      {
        protocol: "https",
        hostname: 'drive.google.com',
      },
    ],
  },
};

export default nextConfig;
