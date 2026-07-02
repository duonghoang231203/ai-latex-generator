// lib/ai/types.ts
import type { DocType, SourceFile, TemplateId } from "@/lib/types/document";

/** Ngữ cảnh cho lượt SỬA lỗi — đến từ AST validation HOẶC compile. */
export interface ErrorContext {
  previousLatex: string;
  errorLog: string;
}

/** Ngữ cảnh cho lượt CHỈNH SỬA nội dung theo chỉ thị người dùng (chat-edit). */
export interface EditContext {
  currentLatex: string;
  instruction: string;
}

export interface GenerateInput {
  description: string;
  docType: DocType;
  template?: TemplateId; // dạng tài liệu cụ thể (định hình format/gói)
  sources?: SourceFile[]; // tài liệu nguồn người dùng tải lên (dữ liệu tham khảo)
  errorContext?: ErrorContext; // có => lượt sửa lỗi compile/validate
  editContext?: EditContext; // có => lượt chỉnh sửa nội dung theo yêu cầu
  onChunk?: (chunk: string) => void; // callback để stream text/suy luận
}

/** Interface duy nhất code nghiệp vụ phụ thuộc (Nguyên tắc V — provider-agnostic). */
export interface LatexProvider {
  readonly name: string;
  generate(input: GenerateInput): Promise<{ latex: string }>;
}
