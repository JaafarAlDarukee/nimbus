import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    // CV studio sends CVs and job descriptions (PDF / Word) to the server to read them
    serverActions: { bodySizeLimit: "6mb" },
  },
  // Read on the server only; keep them out of the bundler
  serverExternalPackages: ["unpdf", "mammoth"],
};

export default nextConfig;
