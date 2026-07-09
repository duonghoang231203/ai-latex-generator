import { describe, it, expect } from "vitest";
import { chunkText, chunkSources } from "@/lib/rag/chunk-source-text";
import { cosineSim } from "@/lib/rag/vector-store";
import { fitToBudget } from "@/lib/rag/token-budget";
import { MockEmbeddingProvider } from "@/lib/ai/embedding-mock";
import type { ScoredChunk } from "@/lib/rag/vector-store";

describe("chunkText", () => {
  it("tách theo đoạn, giữ offset chính xác", () => {
    const content = "Đoạn một.\n\nĐoạn hai dài hơn một chút.";
    const chunks = chunkText(content ? "f.txt" : "", content, { targetChars: 20, overlap: 5 });
    expect(chunks.length).toBeGreaterThanOrEqual(2);
    // offset trỏ đúng vị trí trong content gốc.
    for (const c of chunks) {
      expect(content.slice(c.startOffset)).toContain(c.text.slice(0, 5));
    }
  });

  it("cắt cứng đoạn quá dài với overlap", () => {
    const long = "x".repeat(2000);
    const chunks = chunkText("f.txt", long, { targetChars: 500, overlap: 100 });
    expect(chunks.length).toBeGreaterThan(1);
    expect(chunks.every((c) => c.text.length <= 500)).toBe(true);
  });

  it("chunkSources gộp nhiều file", () => {
    const chunks = chunkSources([
      { name: "a.txt", content: "alpha" },
      { name: "b.txt", content: "beta" },
    ]);
    expect(chunks.map((c) => c.sourceName).sort()).toEqual(["a.txt", "b.txt"]);
  });
});

describe("cosineSim", () => {
  it("vector giống nhau → 1; trực giao → 0", () => {
    expect(cosineSim([1, 0], [1, 0])).toBeCloseTo(1);
    expect(cosineSim([1, 0], [0, 1])).toBeCloseTo(0);
  });
  it("vector 0 → 0 (không NaN)", () => {
    expect(cosineSim([0, 0], [1, 1])).toBe(0);
  });
});

describe("MockEmbeddingProvider", () => {
  it("tất định + văn bản chia sẻ từ có cosine cao hơn", async () => {
    const p = new MockEmbeddingProvider();
    const [q] = await p.embed(["doanh thu quý một tăng"]);
    const [related] = await p.embed(["doanh thu quý một đạt mức cao"]);
    const [unrelated] = await p.embed(["thời tiết hôm nay có mưa"]);
    expect(cosineSim(q, related)).toBeGreaterThan(cosineSim(q, unrelated));
    // Tất định: gọi lại cho cùng vector.
    const [q2] = await p.embed(["doanh thu quý một tăng"]);
    expect(q2).toEqual(q);
  });
});

describe("fitToBudget", () => {
  it("giữ chunk tới khi hết ngân sách; luôn giữ ít nhất 1", () => {
    const mk = (t: string): ScoredChunk => ({
      chunk: { sourceName: "x", startOffset: 0, text: t },
      score: 1,
      vector: [],
    });
    const items = [mk("a".repeat(100)), mk("b".repeat(100)), mk("c".repeat(100))];
    expect(fitToBudget(items, 150).length).toBe(1);
    expect(fitToBudget(items, 250).length).toBe(2);
    // chunk đầu lớn hơn ngân sách vẫn giữ 1.
    expect(fitToBudget([mk("z".repeat(500))], 100).length).toBe(1);
  });
});
