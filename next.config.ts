import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["better-sqlite3"],
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "www.google.com", pathname: "/s2/favicons" },
    ],
  },
};

export default nextConfig;
