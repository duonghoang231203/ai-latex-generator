// lib/ai/embedding-types.ts
// Interface provider embedding — ĐỘC LẬP với LatexProvider (Anthropic không có embedding API).
// Cho phép hoán đổi: mock (deterministic, offline/test) ↔ transformers (local ONNX) ↔ API.

export interface EmbeddingProvider {
  readonly name: string;
  /** Số chiều vector (để kiểm tra tương thích vector store/cache). */
  readonly dimension: number;
  /** Nhúng một batch văn bản → mảng vector (cùng thứ tự đầu vào). */
  embed(texts: string[]): Promise<number[][]>;
}
