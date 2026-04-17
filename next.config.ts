import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // pdf-parse / pdfjs-dist are intended for Node; avoid Turbopack bundling edge cases.
  serverExternalPackages: ["pdf-parse", "pdfjs-dist", "canvas"],
};

export default nextConfig;
