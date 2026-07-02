import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  // Các thư viện trích xuất/OCR dùng file/wasm/worker của Node — không bundle,
  // require trực tiếp từ node_modules lúc chạy (tránh lỗi bundling).
  serverExternalPackages: ["pdf-parse", "mammoth", "tesseract.js"],
};

export default nextConfig;
