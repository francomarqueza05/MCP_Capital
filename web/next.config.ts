import type { NextConfig } from "next";

// The hackathon keys live in the repo root's .env, shared with the scripts.
try {
  process.loadEnvFile("../.env");
} catch {}

const nextConfig: NextConfig = {
  cacheComponents: true,
  partialPrefetching: true,
};

export default nextConfig;
