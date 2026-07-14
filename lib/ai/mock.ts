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
 * Sinh dữ liệu giả TỐI THIỂU nhưng HỢP LỆ từ một Zod schema bất kỳ, dùng cho MockProvider —
 * không phụ thuộc thư viện ngoài (zocker/@anatine/zod-mock...), chỉ đủ cho nhu cầu thật hiện tại
 * (schema tương đối đơn giản như RequestPlan — object lồng nhau, string/number/boolean/enum/array).
 *
 * Dùng API introspection CHÍNH THỨC của Zod 4 cho library authors (`_zod.def`, `def.type` là
 * discriminator) — đã verify bằng thực nghiệm (node -e) cấu trúc thật của từng loại def:
 *   object   → def.shape (Record<string, ZodType>)
 *   optional → def.innerType (schema bên trong, KHÔNG bắt buộc — trả undefined để hợp lệ)
 *   enum     → def.entries (Record<key, value> — không phải array)
 *   array    → def.element (schema của 1 phần tử)
 *   string/number/boolean → không có field lồng, trả giá trị mặc định theo loại
 *
 * KHÔNG cố tổng quát hoá cho MỌI kiểu Zod có thể có (union/tuple/record/date/...) — nếu gặp loại
 * chưa hỗ trợ, throw lỗi rõ ràng để người viết schema mới biết cần bổ sung, tránh silently trả
 * `undefined` sai kiểu rồi validate fail khó hiểu ở nơi khác.
 */
function generateMockFromSchema(schema: z.ZodTypeAny): unknown {
  // Zod 4 core internals — xem https://zod.dev/library-authors, đã verify runtime.
  const def = (schema as unknown as { _zod: { def: Record<string, unknown> } })._zod.def;
  const type = def.type as string;

  switch (type) {
    case "object": {
      const shape = def.shape as Record<string, z.ZodTypeAny>;
      const out: Record<string, unknown> = {};
      for (const [key, fieldSchema] of Object.entries(shape)) {
        out[key] = generateMockFromSchema(fieldSchema);
      }
      return out;
    }
    case "optional":
    case "nullable":
      // Field không bắt buộc — trả undefined vẫn hợp lệ, tránh phải suy luận giá trị giả cho
      // innerType (đơn giản hơn, và đúng ngữ nghĩa "mock tối thiểu" cho field optional).
      return undefined;
    case "default":
      // Có default value sẵn trong schema — dùng luôn giá trị đó, không cần bịa.
      return typeof def.defaultValue === "function"
        ? (def.defaultValue as () => unknown)()
        : def.defaultValue;
    case "enum": {
      const entries = def.entries as Record<string, string | number>;
      const first = Object.values(entries)[0];
      return first;
    }
    case "array": {
      // Mảng rỗng vẫn hợp lệ với hầu hết schema (trừ khi có .min(1)) — mock tối thiểu.
      return [];
    }
    case "string":
      return "mock";
    case "number":
      return 0;
    case "boolean":
      return true;
    default:
      throw new Error(
        `generateMockFromSchema: chưa hỗ trợ Zod type "${type}" — bổ sung case mới khi có schema dùng loại này (xem lib/ai/mock.ts).`,
      );
  }
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

  /**
   * Sinh dữ liệu giả HỢP LỆ theo schema (không throw) — dùng generateMockFromSchema() rồi PARSE
   * LẠI qua chính schema đó trước khi trả, để đảm bảo kết quả luôn pass validation của caller
   * (bắt lỗi sớm ngay tại đây nếu generateMockFromSchema() sinh sai, thay vì để caller tự phát
   * hiện qua lỗi khó hiểu ở xa).
   */
  async generateObject<T>(schema: z.ZodType<T>, prompt: string): Promise<T> {
    const raw = generateMockFromSchema(schema);
    return schema.parse(raw);
  }
}
