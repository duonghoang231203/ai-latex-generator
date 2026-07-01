// lib/ai/mock.ts
import type { DocType } from "@/lib/types/document";
import type { GenerateInput, LatexProvider } from "@/lib/ai/types";

export type MockScenario = "happy" | "fail-then-succeed" | "always-invalid";

export function validLatex(description: string, docType: DocType): string {
  const cls = docType === "report" ? "report" : "article";
  const body =
    docType === "report"
      ? "\\chapter{Giới thiệu}\nNội dung: " +
        description +
        "\n\\section{Phần 1}\nChi tiết.\n\\chapter{Kết luận}\nTổng kết."
      : "\\section{Giới thiệu}\nNội dung: " +
        description +
        "\n\\section{Phần 1}\nChi tiết.\n\\section{Kết luận}\nTổng kết.";
  return [
    `\\documentclass{${cls}}`,
    "\\usepackage{fontspec}",
    "\\title{Tài liệu mẫu}",
    "\\author{AI LaTeX Generator}",
    "\\begin{document}",
    "\\maketitle",
    body,
    "\\end{document}",
    "",
  ].join("\n");
}

/** LaTeX hỏng: môi trường không đóng (thiếu \\end{itemize}). */
export function invalidLatex(docType: DocType): string {
  const cls = docType === "report" ? "report" : "article";
  return [
    `\\documentclass{${cls}}`,
    "\\begin{document}",
    "\\begin{itemize}",
    "\\item Một mục",
    "\\end{document}",
    "",
  ].join("\n");
}

/**
 * MockProvider — dùng cho test/dev offline, không tốn tiền/không phụ thuộc mạng.
 * Mặc định (không option) trả LaTeX hợp lệ (dùng khi AI_PROVIDER=mock).
 */
export class MockProvider implements LatexProvider {
  readonly name = "mock";
  private calls = 0;

  constructor(private readonly scenario: MockScenario = "happy") {}

  get callCount(): number {
    return this.calls;
  }

  async generate(input: GenerateInput): Promise<{ latex: string }> {
    this.calls += 1;
    switch (this.scenario) {
      case "always-invalid":
        return { latex: invalidLatex(input.docType) };
      case "fail-then-succeed":
        // Lượt đầu (chưa có errorContext) trả hỏng; lượt sửa trả hợp lệ.
        return input.errorContext
          ? { latex: validLatex(input.description, input.docType) }
          : { latex: invalidLatex(input.docType) };
      case "happy":
      default:
        // Lượt chỉnh sửa: trả LaTeX hợp lệ có chứa nội dung chỉ thị (để test được).
        if (input.editContext) {
          return { latex: validLatex(input.editContext.instruction, input.docType) };
        }
        return { latex: validLatex(input.description, input.docType) };
    }
  }
}
