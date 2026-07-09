// lib/rag/retrieve-relevant-sources.ts
// Điều phối RAG: gate kích hoạt → chunk → embed (có cache) → cosine top-k (+MMR) → token budget
// → gán nhãn [S#]. Trả về RetrievedChunk[] để orchestrator truyền vào GenerateInput.retrievedSources.
// Chạy ASYNC ở tầng orchestrator (TRƯỚC provider.generate) vì embedding bất đồng bộ.

import type { RetrievedChunk, SourceFile } from "@/lib/types/document";
import type { EmbeddingProvider } from "@/lib/ai/embedding-types";
import { chunkSources, DEFAULT_CHUNK_OPTIONS, type ChunkOptions } from "@/lib/rag/chunk-source-text";
import { InMemoryVectorStore } from "@/lib/rag/in-memory-vector-store";
import { mmrSelect } from "@/lib/rag/mmr";
import { fitToBudget } from "@/lib/rag/token-budget";
import { cacheKey, type EmbeddingCache } from "@/lib/rag/embedding-cache";
import type { ScoredChunk } from "@/lib/rag/vector-store";

export interface RetrieveOptions {
  activationChars: number; // tổng ký tự nguồn > ngưỡng mới bật RAG
  topK: number;
  tokenBudget: number; // ngân sách ký tự nhồi
  useMmr: boolean;
  chunk?: ChunkOptions;
  mmrLambda?: number;
}

export interface RetrieveDeps {
  embedder: EmbeddingProvider;
  cache?: EmbeddingCache | null; // null = tắt cache (test)
}

export interface RetrieveResult {
  activated: boolean; // false ⇒ caller dùng sources như cũ (nhồi thẳng)
  retrieved: RetrievedChunk[];
}

function totalChars(sources: SourceFile[]): number {
  return sources.reduce((s, f) => s + f.content.length, 0);
}

/**
 * Chọn chunk liên quan tới `description`. Nếu tổng nguồn ≤ activationChars ⇒ không kích hoạt
 * (trả activated=false) để caller giữ hành vi nhồi-thẳng cũ (fallback an toàn cho nguồn nhỏ).
 */
export async function retrieveRelevantSources(
  description: string,
  sources: SourceFile[],
  opts: RetrieveOptions,
  deps: RetrieveDeps,
): Promise<RetrieveResult> {
  if (sources.length === 0 || totalChars(sources) <= opts.activationChars) {
    return { activated: false, retrieved: [] };
  }

  const chunkOpts = opts.chunk ?? DEFAULT_CHUNK_OPTIONS;
  const chunks = chunkSources(sources, chunkOpts);
  if (chunks.length === 0) return { activated: false, retrieved: [] };

  const { embedder, cache } = deps;

  // Cache embeddings theo hash nội dung + tham số chunk + provider.
  const payload = JSON.stringify({
    sources: sources.map((s) => ({ n: s.name, c: s.content })),
    chunk: chunkOpts,
  });
  const key = cacheKey(embedder.name, embedder.dimension, payload);

  let vectors: number[][] | null = null;
  if (cache) {
    const cached = await cache.get(key);
    if (cached && cached.vectors.length === chunks.length) vectors = cached.vectors;
  }
  if (!vectors) {
    vectors = await embedder.embed(chunks.map((c) => c.text));
    if (cache) await cache.set(key, { chunks, vectors });
  }

  const [queryVec] = await embedder.embed([description]);

  const store = InMemoryVectorStore.of(chunks, vectors);
  const ranked: ScoredChunk[] = await store.searchAll(queryVec);

  // MMR (giảm trùng lặp) hoặc top-k thuần.
  const selected = opts.useMmr
    ? mmrSelect(ranked, queryVec, opts.topK, opts.mmrLambda ?? 0.5)
    : ranked.slice(0, opts.topK);

  // Giới hạn ngân sách ký tự rồi gán nhãn [S#] ổn định.
  const budgeted = fitToBudget(selected, opts.tokenBudget);
  const retrieved: RetrievedChunk[] = budgeted.map((sc, i) => ({
    ...sc.chunk,
    label: `S${i + 1}`,
    score: sc.score,
  }));

  return { activated: true, retrieved };
}
