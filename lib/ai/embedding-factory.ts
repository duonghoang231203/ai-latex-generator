// lib/ai/embedding-factory.ts
// Chọn EmbeddingProvider theo cấu hình (nhân mẫu lib/ai/factory.ts). ĐỘC LẬP với LatexProvider.
// Mặc định 'mock' (an toàn/offline); 'transformers' cần cài @xenova/transformers.

import type { EmbeddingProvider } from "@/lib/ai/embedding-types";
import { getConfig } from "@/lib/config";
import { MockEmbeddingProvider } from "@/lib/ai/embedding-mock";
import { TransformersEmbeddingProvider } from "@/lib/ai/embedding-transformers";
import { VercelEmbeddingProvider } from "@/lib/ai/embedding-vercel";
import { createOpenAI } from "@ai-sdk/openai";
import { createGoogleGenerativeAI } from "@ai-sdk/google";

export function getEmbeddingProvider(): EmbeddingProvider {
  const cfg = getConfig();
  // Ở chế độ AI mock/offline → luôn dùng embedding mock để chạy tất định không cần mạng.
  if (cfg.aiProvider === "mock") return new MockEmbeddingProvider();

  switch (cfg.embeddingProvider) {
    case "transformers":
      return new TransformersEmbeddingProvider(cfg.embeddingModel, cfg.embeddingCacheDir);
    case "openai": {
      const apiKey = process.env.AI_API_KEY ?? "";
      const openai = createOpenAI({ apiKey, baseURL: cfg.aiBaseUrl || undefined });
      const modelName = cfg.embeddingModel || "text-embedding-3-small";
      const dimension = modelName.includes("large") ? 3072 : 1536;
      return new VercelEmbeddingProvider("openai", openai.embedding(modelName), dimension);
    }
    case "google": {
      const apiKey = process.env.AI_API_KEY ?? "";
      const google = createGoogleGenerativeAI({ apiKey, baseURL: cfg.aiBaseUrl || undefined });
      const modelName = cfg.embeddingModel || "text-embedding-004";
      const dimension = 768;
      return new VercelEmbeddingProvider("google", google.textEmbeddingModel(modelName), dimension);
    }
    case "mock":
      return new MockEmbeddingProvider();
    default:
      throw new Error(`EMBEDDING_PROVIDER không hợp lệ: '${cfg.embeddingProvider}'`);
  }
}
