// lib/ai/mock.ts
import type { DocType } from "@/lib/types/document";
import type { GenerateInput, GenerateOutcome, LatexProvider } from "@/lib/ai/types";
import { z } from "zod";
import { renderTemplateLatex } from "@/lib/templates/registry";

export type MockScenario =
  | "happy"
  | "fail-then-succeed"
  | "always-invalid"
  | "truncated-then-succeed"; // finishReason:"length" lượt đầu, "stop" lượt sau — test truncation recovery

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
 * LaTeX BỊ CẮT CỤT giữa câu (mô phỏng finishReason:"length" thật) — khác invalidLatex():
 * ở đây KHÔNG có \\end{document} vì output ngừng giữa nội dung, không phải lỗi cấu trúc cố ý.
 * Dùng cho scenario "truncated-then-succeed" để test truncation-recovery path.
 */
export function truncatedLatex(docType: DocType): string {
  const cls = docType === "report" ? "report" : "article";
  return [
    `\\documentclass{${cls}}`,
    "\\usepackage{fontspec}",
    "\\begin{document}",
    "\\section{Giới thiệu}",
    "Đây là một đoạn nội dung dài đang được viết và bị cắt cụt giữa câu vì hết",
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

  async generate(input: GenerateInput): Promise<GenerateOutcome> {
    this.calls += 1;
    switch (this.scenario) {
      case "always-invalid":
        return { latex: invalidLatex(input.docType), finishReason: "stop" };
      case "fail-then-succeed":
        // Lượt đầu (chưa có errorContext) trả hỏng; lượt sửa trả hợp lệ.
        return input.errorContext
          ? { latex: validLatex(input.description, input.docType), finishReason: "stop" }
          : { latex: invalidLatex(input.docType), finishReason: "stop" };
      case "truncated-then-succeed":
        // Lượt đầu (chưa retry, không có maxTokensOverride) → bị cắt cụt (finishReason:"length").
        // Lượt retry (có maxTokensOverride — do truncation-recovery gọi lại) → hoàn chỉnh.
        return input.maxTokensOverride
          ? { latex: validLatex(input.description, input.docType), finishReason: "stop" }
          : { latex: truncatedLatex(input.docType), finishReason: "length" };
      case "happy":
      default:
        // Lượt chỉnh sửa: trả LaTeX hợp lệ có chứa nội dung chỉ thị (để test được).
        if (input.editContext) {
          return input.template
            ? {
                latex: renderTemplateLatex(input.template, input.editContext.instruction),
                finishReason: "stop",
              }
            : { latex: validLatex(input.editContext.instruction, input.docType), finishReason: "stop" };
        }
        // Có template → dùng khung theo dạng tài liệu; nếu không → khung cơ bản theo docType.
        return input.template
          ? { latex: renderTemplateLatex(input.template, input.description), finishReason: "stop" }
          : { latex: validLatex(input.description, input.docType), finishReason: "stop" };
    }
  }

  async generateObject<T>(schema: z.ZodType<T>, prompt: string): Promise<T> {
    throw new Error("MockProvider.generateObject not implemented for dynamic schemas");
  }
}
