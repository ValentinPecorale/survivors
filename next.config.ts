import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  // The Featured card photos ask for quality 90; without listing it Next silently serves them at 75.
  images: { qualities: [75, 90] },
  cacheComponents: true,
  partialPrefetching: true,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
