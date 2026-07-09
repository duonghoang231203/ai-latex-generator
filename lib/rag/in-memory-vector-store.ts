// lib/rag/in-memory-vector-store.ts
// VectorStore in-memory: cosine thuần, 0 phụ thuộc. Đủ cho corpus per-document nhỏ.
// Nâng lên sqlite-vec/LanceDB khi cần cache bền vững (xem research §5.3).

import type { Chunk } from "@/lib/types/document";
import { cosineSim, type ScoredChunk, type VectorItem, type VectorStore } from "@/lib/rag/vector-store";

export class InMemoryVectorStore implements VectorStore {
  private items: VectorItem[] = [];

  async add(items: VectorItem[]): Promise<void> {
    this.items.push(...items);
  }

  async search(query: number[], k: number): Promise<ScoredChunk[]> {
    const scored: ScoredChunk[] = this.items.map((it) => ({
      chunk: it.chunk,
      vector: it.vector,
      score: cosineSim(query, it.vector),
    }));
    scored.sort((a, b) => b.score - a.score);
    return scored.slice(0, Math.max(0, k));
  }

  /** Trả toàn bộ candidate đã chấm điểm (dùng cho MMR trên tập lớn hơn top-k). */
  async searchAll(query: number[]): Promise<ScoredChunk[]> {
    return this.search(query, this.items.length);
  }

  size(): number {
    return this.items.length;
  }

  static of(chunks: Chunk[], vectors: number[][]): InMemoryVectorStore {
    const store = new InMemoryVectorStore();
    store.items = chunks.map((chunk, i) => ({ chunk, vector: vectors[i] ?? [] }));
    return store;
  }
}
