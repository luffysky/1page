import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Phase 1 尚未引入外部圖片來源。Phase 2 接 Supabase Storage 時再設定 remotePatterns。
  reactStrictMode: true,
};

export default nextConfig;
