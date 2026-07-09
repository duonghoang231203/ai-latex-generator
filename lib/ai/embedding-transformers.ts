// lib/ai/embedding-transformers.ts
// Embedding LOCAL bằng Transformers.js (ONNX). Phụ thuộc TUỲ CHỌN, NẶNG → dynamic import,
// chỉ nạp khi EMBEDDING_PROVIDER=transformers. Nếu chưa cài @xenova/transformers, ném lỗi rõ ràng.
// Model multilingual (mặc định e5-small) hỗ trợ tiếng Việt. Cache model qua thư mục ghi được.

import type { EmbeddingProvider } from "@/lib/ai/embedding-types";

// Kích thước vector theo model phổ biến (để kiểm tra cache; fallback 384).
const KNOWN_DIMS: Record<string, number> = {
  "Xenova/multilingual-e5-small": 384,
  "Xenova/multilingual-e5-base": 768,
  "Xenova/bge-m3": 1024,
};

// Kiểu tối thiểu cho pipeline trả về (tránh phụ thuộc type khi lib chưa cài).
type FeatureExtractor = (
  texts: string[],
  opts: { pooling: "mean"; normalize: boolean },
) => Promise<{ tolist(): number[][] }>;

export class TransformersEmbeddingProvider implements EmbeddingProvider {
  readonly name = "transformers";
  readonly dimension: number;
  private readonly model: string;
  private extractor: FeatureExtractor | null = null;

  constructor(model: string, private readonly cacheDir?: string) {
    this.model = model;
    this.dimension = KNOWN_DIMS[model] ?? 384;
  }

  private async getExtractor(): Promise<FeatureExtractor> {
    if (this.extractor) return this.extractor;
    let mod: { pipeline: (task: string, model: string) => Promise<FeatureExtractor>; env?: { cacheDir?: string } };
    try {
      // Phụ thuộc TUỲ CHỌN, có thể chưa cài. Dùng specifier biến + @vite-ignore để bundler/tsc
      // KHÔNG cố resolve tĩnh (nếu không, build/test sẽ lỗi khi package vắng mặt).
      const pkg = "@xenova/transformers";
      mod = await import(/* @vite-ignore */ /* webpackIgnore: true */ pkg);
    } catch {
      throw new Error(
        "EMBEDDING_PROVIDER=transformers cần cài '@xenova/transformers'. " +
          "Chạy: npm install @xenova/transformers — hoặc đặt EMBEDDING_PROVIDER=mock.",
      );
    }
    if (this.cacheDir && mod.env) mod.env.cacheDir = this.cacheDir;
    this.extractor = await mod.pipeline("feature-extraction", this.model);
    return this.extractor;
  }

  async embed(texts: string[]): Promise<number[][]> {
    if (texts.length === 0) return [];
    const extractor = await this.getExtractor();
    const output = await extractor(texts, { pooling: "mean", normalize: true });
    return output.tolist();
  }
}
