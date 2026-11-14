import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  cacheComponents: true,
  // www.elch.chat → elch.chat (one canonical origin: logins and API CORS are tied to it)
  async redirects() {
    return [
      {
        source: "/:path*",
        has: [{ type: "host", value: "www.elch.chat" }],
        destination: "https://elch.chat/:path*",
        permanent: true,
      },
    ];
  },
  partialPrefetching: true,
  turbopack: {
    root: __dirname,
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
