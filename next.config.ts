import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // unpdf ships a bundled serverless PDF.js; keep it external so Next resolves its ESM build cleanly.
  serverExternalPackages: ["unpdf"],
};

export default nextConfig;
