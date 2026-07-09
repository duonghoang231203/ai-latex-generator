// lib/rag/token-budget.ts
// Giới hạn tổng ký tự các chunk nhồi vào prompt (ước lượng token theo ký tự — đơn giản, an toàn).
// Tôn trọng trần MAX_PROMPT_SOURCE_CHARS: chỉ nhồi tới khi hết ngân sách.

import type { ScoredChunk } from "@/lib/rag/vector-store";

/**
 * Giữ các chunk theo thứ tự đầu vào cho tới khi tổng độ dài vượt `budgetChars`.
 * Luôn giữ ít nhất 1 chunk (chunk đầu) để không rỗng khi 1 chunk đã lớn hơn ngân sách.
 */
export function fitToBudget(chunks: ScoredChunk[], budgetChars: number): ScoredChunk[] {
  const kept: ScoredChunk[] = [];
  let total = 0;
  for (const c of chunks) {
    const len = c.chunk.text.length;
    if (kept.length > 0 && total + len > budgetChars) break;
    kept.push(c);
    total += len;
  }
  return kept;
}
