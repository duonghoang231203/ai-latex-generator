import { describe, it, expect } from "vitest";
import { runEdit } from "@/lib/orchestrator/document";
import { MockProvider } from "@/lib/ai/mock";
import { isDocumentError, type CompileResult } from "@/lib/types/document";

const fakePdf = new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d]); // %PDF-
const compileOk = async (): Promise<CompileResult> => ({ success: true, pdf: fakePdf });

describe("orchestrator runEdit", () => {
  it("áp dụng chỉ thị → LaTeX mới chứa nội dung yêu cầu, attempts=1", async () => {
    const r = await runEdit(
      {
        currentLatex: "\\documentclass{article}\\begin{document}cũ\\end{document}",
        instruction: "Thêm mục Kết luận ABC",
        docType: "article",
      },
      { provider: new MockProvider("happy"), compile: compileOk, maxAttempts: 3 },
    );
    expect(isDocumentError(r)).toBe(false);
    if (!isDocumentError(r)) {
      expect(r.attempts).toBe(1);
      expect(r.latex).toContain("Thêm mục Kết luận ABC");
      expect(r.pdfBase64.length).toBeGreaterThan(0);
    }
  });

  it("chỉnh sửa tạo LaTeX hỏng liên tục → DocumentError, attempts=maxAttempts", async () => {
    const r = await runEdit(
      {
        currentLatex: "\\documentclass{article}\\begin{document}cũ\\end{document}",
        instruction: "làm hỏng",
        docType: "article",
      },
      { provider: new MockProvider("always-invalid"), compile: compileOk, maxAttempts: 2 },
    );
    expect(isDocumentError(r)).toBe(true);
    if (isDocumentError(r)) {
      expect(r.attempts).toBe(2);
      expect(r.latex).toBeTruthy();
    }
  });
});
