import { describe, it, expect } from "vitest";
import { wrapBodyInTemplate } from "@/lib/templates/registry";
import { runDocumentFromMarkdown } from "@/lib/orchestrator/document";
import { MockProvider } from "@/lib/ai/mock";
import { validateLatex } from "@/lib/validation/validate";
import { isDocumentError, type CompileResult } from "@/lib/types/document";

const fakePdf = new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d]); // %PDF-
const compileOk = async (): Promise<CompileResult> => ({ success: true, pdf: fakePdf });

describe("wrapBodyInTemplate", () => {
  it("bọc body trong documentClass + gói của template, có fontspec", () => {
    const latex = wrapBodyInTemplate("general", "\\section{X}\nNội dung.", ["listings"]);
    expect(latex).toContain("\\documentclass{article}");
    expect(latex).toContain("\\usepackage{fontspec}");
    expect(latex).toContain("\\usepackage{geometry}"); // gói của general
    expect(latex).toContain("\\usepackage{listings}"); // gói phát sinh
    expect(latex).toContain("\\begin{document}");
    expect(latex).toContain("\\section{X}");
    expect(latex).toContain("\\end{document}");
    expect(validateLatex(latex).ok).toBe(true);
  });

  it("dedupe gói trùng giữa template và extra", () => {
    const latex = wrapBodyInTemplate("academic", "x", ["amsmath"]); // academic đã có amsmath
    const count = (latex.match(/\\usepackage\{amsmath\}/g) ?? []).length;
    expect(count).toBe(1);
  });

  it("thesis (report) dùng documentclass report", () => {
    const latex = wrapBodyInTemplate("thesis", "\\chapter{C}", []);
    expect(latex).toContain("\\documentclass{report}");
  });
});

describe("runDocumentFromMarkdown", () => {
  const deps = { provider: new MockProvider("happy"), compile: compileOk, maxAttempts: 3 };

  it("Markdown → LaTeX hợp lệ, compile PASS không cần fallback (attempts=1)", async () => {
    const r = await runDocumentFromMarkdown(
      {
        description: "",
        docType: "article",
        template: "general",
        inputFormat: "markdown",
        markdown: "# Tiêu đề\n\nĐoạn văn **quan trọng**.\n\n- Ý 1\n- Ý 2",
      },
      deps,
    );
    expect(isDocumentError(r)).toBe(false);
    if (!isDocumentError(r)) {
      expect(r.attempts).toBe(1);
      expect(r.latex).toContain("\\section{Tiêu đề}");
      expect(r.latex).toContain("\\textbf{quan trọng}");
      expect(r.latex).toContain("\\begin{itemize}");
      expect(r.pdfBase64.length).toBeGreaterThan(0);
    }
  });

  it("đính cảnh báo khi có ảnh (placeholder)", async () => {
    const r = await runDocumentFromMarkdown(
      {
        description: "",
        docType: "article",
        template: "general",
        inputFormat: "markdown",
        markdown: "![sơ đồ](https://x/y.png)\n\nnội dung",
      },
      deps,
    );
    expect(r.warnings && r.warnings.length).toBeGreaterThan(0);
  });

  it("report template → dùng \\chapter cho heading cấp 1", async () => {
    const r = await runDocumentFromMarkdown(
      {
        description: "",
        docType: "report",
        template: "thesis",
        inputFormat: "markdown",
        markdown: "# Chương một\n\nnội dung",
      },
      deps,
    );
    if (!isDocumentError(r)) {
      expect(r.latex).toContain("\\chapter{Chương một}");
    }
  });
});
