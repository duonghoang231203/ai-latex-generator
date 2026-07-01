import { describe, it, expect } from "vitest";
import { MockProvider } from "@/lib/ai/mock";

describe("MockProvider — editContext (chat-edit)", () => {
  it("scenario happy: trả LaTeX hợp lệ chứa nội dung chỉ thị", async () => {
    const p = new MockProvider("happy");
    const { latex } = await p.generate({
      description: "",
      docType: "article",
      editContext: { currentLatex: "\\documentclass{article}", instruction: "NOI_DUNG_MOI" },
    });
    expect(latex).toContain("\\documentclass{article}");
    expect(latex).toContain("\\begin{document}");
    expect(latex).toContain("\\end{document}");
    expect(latex).toContain("NOI_DUNG_MOI");
  });

  it("editContext không ảnh hưởng lượt sửa lỗi (errorContext) ở scenario fail-then-succeed", async () => {
    const p = new MockProvider("fail-then-succeed");
    // Lượt đầu (không errorContext) → invalid: itemize chưa đóng.
    const first = await p.generate({ description: "x", docType: "article" });
    expect(first.latex).toContain("\\begin{itemize}");
    expect(first.latex).not.toContain("\\end{itemize}");
    // Lượt sửa (errorContext) → valid: không còn itemize hở.
    const second = await p.generate({
      description: "x",
      docType: "article",
      errorContext: { previousLatex: first.latex, errorLog: "! err" },
    });
    expect(second.latex).not.toContain("\\begin{itemize}");
    expect(second.latex).toContain("\\end{document}");
  });
});
