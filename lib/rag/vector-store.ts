// lib/rag/vector-store.ts
// Interface VectorStore để hoán đổi: in-memory (mặc định) → sqlite-vec/LanceDB → pgvector (v2).
// Giữ tối giản (add/search) để v2 thay backend không đau.

import type { Chunk } from "@/lib/types/document";

export interface ScoredChunk {
  chunk: Chunk;
  score: number; // cosine similarity với query
  vector: number[]; // giữ vector để MMR (giảm trùng lặp)
}

export interface VectorItem {
  vector: number[];
  chunk: Chunk;
}

export interface VectorStore {
  add(items: VectorItem[]): Promise<void>;
  /** Top-k theo cosine (giảm dần). */
  search(query: number[], k: number): Promise<ScoredChunk[]>;
}

/** Cosine similarity. An toàn với vector 0 (trả 0). */
export function cosineSim(a: number[], b: number[]): number {
  let dot = 0;
  let na = 0;
  let nb = 0;
  const n = Math.min(a.length, b.length);
  for (let i = 0; i < n; i++) {
    dot += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }
  const denom = Math.sqrt(na) * Math.sqrt(nb);
  return denom === 0 ? 0 : dot / denom;
}
