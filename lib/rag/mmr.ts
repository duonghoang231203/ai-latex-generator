// lib/rag/mmr.ts
// Maximal Marginal Relevance: chọn chunk vừa LIÊN QUAN query vừa ĐA DẠNG (giảm trùng lặp).
// score = λ·sim(q, c) − (1−λ)·max sim(c, đã-chọn).

import { cosineSim, type ScoredChunk } from "@/lib/rag/vector-store";

/** Chọn tối đa `k` chunk theo MMR từ danh sách candidate đã chấm điểm với query. */
export function mmrSelect(
  candidates: ScoredChunk[],
  queryVector: number[],
  k: number,
  lambda = 0.5,
): ScoredChunk[] {
  const pool = [...candidates];
  const selected: ScoredChunk[] = [];
  const limit = Math.min(k, pool.length);

  while (selected.length < limit) {
    let bestIdx = -1;
    let bestScore = -Infinity;
    for (let i = 0; i < pool.length; i++) {
      const relevance = cosineSim(queryVector, pool[i].vector);
      let maxRedundancy = 0;
      for (const s of selected) {
        const r = cosineSim(pool[i].vector, s.vector);
        if (r > maxRedundancy) maxRedundancy = r;
      }
      const mmr = lambda * relevance - (1 - lambda) * maxRedundancy;
      if (mmr > bestScore) {
        bestScore = mmr;
        bestIdx = i;
      }
    }
    if (bestIdx === -1) break;
    selected.push(pool[bestIdx]);
    pool.splice(bestIdx, 1);
  }
  return selected;
}
