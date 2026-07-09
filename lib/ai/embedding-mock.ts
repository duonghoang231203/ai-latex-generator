// lib/ai/embedding-mock.ts
// Embedding TẤT ĐỊNH (offline, không phụ thuộc mạng/model) cho test & chế độ mock.
// Dùng bag-of-words hashing → vector chuẩn hoá: văn bản chia sẻ nhiều từ ⇒ cosine cao.
// Đủ để kiểm thử retrieval một cách xác định; KHÔNG dùng cho chất lượng thật.

import type { EmbeddingProvider } from "@/lib/ai/embedding-types";

const DIM = 64;

/** Hash chuỗi ổn định (FNV-1a) → chỉ số chiều. */
function hashToken(token: string): number {
  let h = 2166136261;
  for (let i = 0; i < token.length; i++) {
    h ^= token.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return Math.abs(h) % DIM;
}

/** Tách token: chữ cái Unicode (giữ tiếng Việt), viết thường. */
function tokenize(text: string): string[] {
  return text.toLowerCase().match(/\p{L}+/gu) ?? [];
}

function embedOne(text: string): number[] {
  const v = new Array<number>(DIM).fill(0);
  for (const tok of tokenize(text)) v[hashToken(tok)] += 1;
  // L2 normalize để cosine = dot product.
  const norm = Math.sqrt(v.reduce((s, x) => s + x * x, 0)) || 1;
  return v.map((x) => x / norm);
}

export class MockEmbeddingProvider implements EmbeddingProvider {
  readonly name = "mock";
  readonly dimension = DIM;
  async embed(texts: string[]): Promise<number[][]> {
    return texts.map(embedOne);
  }
}
