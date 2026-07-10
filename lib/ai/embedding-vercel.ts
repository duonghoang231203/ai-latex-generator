import { embedMany, APICallError, type EmbeddingModel } from "ai";
import type { EmbeddingProvider } from "@/lib/ai/embedding-types";

export class VercelEmbeddingProvider implements EmbeddingProvider {
  constructor(
    public readonly name: string,
    private readonly model: EmbeddingModel,
    public readonly dimension: number
  ) {}

  async embed(texts: string[]): Promise<number[][]> {
    if (texts.length === 0) return [];
    
    try {
      const { embeddings } = await embedMany({
        model: this.model,
        values: texts,
      });
      return embeddings;
    } catch (e: unknown) {
      if (APICallError.isInstance(e)) {
        if (e.statusCode === 429) {
          throw new Error("Vượt giới hạn tần suất của nhà cung cấp AI (429).");
        }
      }
      throw e;
    }
  }
}
