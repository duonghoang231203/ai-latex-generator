// lib/ai/embedding-factory.ts
// Chọn EmbeddingProvider theo cấu hình (nhân mẫu lib/ai/factory.ts). ĐỘC LẬP với LatexProvider.
// Mặc định 'mock' (an toàn/offline); 'transformers' cần cài @xenova/transformers.

import type { EmbeddingProvider } from "@/lib/ai/embedding-types";
import { getConfig } from "@/lib/config";
import { MockEmbeddingProvider } from "@/lib/ai/embedding-mock";
import { TransformersEmbeddingProvider } from "@/lib/ai/embedding-transformers";

export function getEmbeddingProvider(): EmbeddingProvider {
  const cfg = getConfig();
  // Ở chế độ AI mock/offline → luôn dùng embedding mock để chạy tất định không cần mạng.
  if (cfg.aiProvider === "mock") return new MockEmbeddingProvider();

  switch (cfg.embeddingProvider) {
    case "transformers":
      return new TransformersEmbeddingProvider(cfg.embeddingModel, cfg.embeddingCacheDir);
    case "mock":
      return new MockEmbeddingProvider();
    default:
      throw new Error(`EMBEDDING_PROVIDER không hợp lệ: '${cfg.embeddingProvider}'`);
  }
}
