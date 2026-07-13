import { describe, it, expect } from "vitest";
import { runDocument } from "@/lib/orchestrator/document";
import { MockProvider } from "@/lib/ai/mock";
import { isDocumentError, type CompileResult } from "@/lib/types/document";

const fakePdf = new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d]); // %PDF-
const compileOk = async (): Promise<CompileResult> => ({ success: true, pdf: fakePdf });

describe("orchestrator — truncation recovery (tách biệt khỏi repair loop)", () => {
  it("generation bị cắt cụt (finishReason:length) → tự retry với token budget lớn hơn, KHÔNG tính vào attempts của repair loop", async () => {
    const provider = new MockProvider("truncated-then-succeed");
    const r = await runDocument(
      { description: "Tài liệu dài về ma trận", docType: "article" },
      { provider, compile: compileOk, maxAttempts: 3 },
    );
    expect(isDocumentError(r)).toBe(false);
    if (!isDocumentError(r)) {
      // attempts=1 nghĩa là runRepairLoop KHÔNG coi truncation-retry là một "lần sửa lỗi" —
      // đúng thiết kế: truncation được xử lý HOÀN TOÀN trước khi vào runRepairLoop.
      expect(r.attempts).toBe(1);
      expect(r.latex).toContain("\\end{document}");
    }
    // callCount=2: lần 1 bị cắt (finishReason:"length") + lần 2 retry với maxTokensOverride → hoàn chỉnh.
    // Nếu callCount=1, nghĩa là truncation-recovery KHÔNG chạy (regression).
    expect(provider.callCount).toBe(2);
  });

  it("generation hoàn chỉnh ngay từ đầu (happy path) → KHÔNG retry, callCount=1", async () => {
    const provider = new MockProvider("happy");
    const r = await runDocument(
      { description: "Tài liệu ngắn", docType: "article" },
      { provider, compile: compileOk, maxAttempts: 3 },
    );
    expect(isDocumentError(r)).toBe(false);
    if (!isDocumentError(r)) {
      expect(r.attempts).toBe(1);
    }
    expect(provider.callCount).toBe(1);
  });
});
