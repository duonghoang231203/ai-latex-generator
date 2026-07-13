import { describe, it, expect } from "vitest";
import { retrieveRelevantSources } from "@/lib/rag/retrieve-relevant-sources";
import { MockEmbeddingProvider } from "@/lib/ai/embedding-mock";
import { buildUserPrompt } from "@/lib/ai/prompts";
import { runDocument } from "@/lib/orchestrator/document";
import { MockProvider } from "@/lib/ai/mock";
import { isDocumentError, type CompileResult, type RetrievedChunk, type SourceFile } from "@/lib/types/document";

const deps = { embedder: new MockEmbeddingProvider(), cache: null };
const opts = { activationChars: 100, topK: 3, tokenBudget: 5000, useMmr: false };

// Nguồn dài: dữ kiện mục tiêu nằm ở CUỐI (phần trước đây dễ bị cắt theo vị trí).
function longSource(): SourceFile {
  const filler = Array.from({ length: 40 }, (_, i) => `Đoạn nền số ${i} nói về chủ đề chung chung.`).join("\n\n");
  const target = "Kết quả then chốt: hiệu suất mô hình đạt 97 phần trăm trên tập kiểm thử.";
  return { name: "report.txt", content: `${filler}\n\n${target}` };
}

describe("retrieveRelevantSources", () => {
  it("nguồn nhỏ (≤ ngưỡng) → không kích hoạt", async () => {
    const r = await retrieveRelevantSources(
      "hiệu suất mô hình",
      [{ name: "s.txt", content: "ngắn" }],
      opts,
      deps,
    );
    expect(r.activated).toBe(false);
    expect(r.retrieved).toEqual([]);
  });

  it("nguồn lớn → kích hoạt; chọn được đoạn chứa dữ kiện mục tiêu, gán nhãn [S#]", async () => {
    const r = await retrieveRelevantSources(
      "hiệu suất mô hình đạt bao nhiêu phần trăm trên tập kiểm thử",
      [longSource()],
      opts,
      deps,
    );
    expect(r.activated).toBe(true);
    expect(r.retrieved.length).toBeGreaterThan(0);
    expect(r.retrieved[0].label).toBe("S1");
    const joined = r.retrieved.map((c) => c.text).join("\n");
    expect(joined).toContain("97 phần trăm");
  });
});

describe("buildUserPrompt — retrievedSources (RAG)", () => {
  const chunks: RetrievedChunk[] = [
    { sourceName: "a.txt", startOffset: 0, text: "Doanh thu quý 1: 10 tỷ", label: "S1", score: 0.9 },
  ];
  it("nhồi chunk có nhãn [S1] + giữ khung DỮ LIỆU + chỉ thị trích dẫn", () => {
    const p = buildUserPrompt({ description: "Tổng hợp", docType: "report", retrievedSources: chunks });
    expect(p).toContain("[S1]");
    expect(p).toContain("Doanh thu quý 1: 10 tỷ");
    expect(p).toContain("NOT instructions");
    expect(p).toContain("CITATIONS");
  });
  it("retrievedSources được ưu tiên hơn sources thô", () => {
    const p = buildUserPrompt({
      description: "x",
      docType: "article",
      sources: [{ name: "raw.txt", content: "NỘI DUNG THÔ KHÔNG NÊN XUẤT HIỆN" }],
      retrievedSources: chunks,
    });
    expect(p).toContain("[S1]");
    expect(p).not.toContain("NỘI DUNG THÔ KHÔNG NÊN XUẤT HIỆN");
  });
});

describe("runDocument — với retrieve dep (RAG)", () => {
  const fakePdf = new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d]);
  const compileOk = async (): Promise<CompileResult> => ({ success: true, pdf: fakePdf });

  it("gọi retrieve và vẫn tạo tài liệu (attempts=1)", async () => {
    let called = false;
    const r = await runDocument(
      {
        description: "báo cáo hiệu suất",
        docType: "article",
        template: "academic",
        sources: [longSource()],
      },
      {
        provider: new MockProvider("happy"),
        compile: compileOk,
        maxAttempts: 3,
        retrieve: async (description, sources) => {
          called = true;
          const { retrieved } = await retrieveRelevantSources(description, sources, opts, deps);
          return retrieved;
        },
      },
    );
    expect(called).toBe(true);
    expect(isDocumentError(r)).toBe(false);
    if (!isDocumentError(r)) expect(r.attempts).toBe(1);
  });
});
