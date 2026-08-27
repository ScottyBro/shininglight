import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      // Photos are uploaded through server actions as FormData. The default
      // 1 MB cap is too small; images are also downscaled client-side before
      // upload (see lib/image.ts) so payloads stay well under Vercel's limit.
      bodySizeLimit: "4mb",
    },
  },
};

export default nextConfig;
