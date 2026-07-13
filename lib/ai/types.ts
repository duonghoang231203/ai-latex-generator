import type { DocType, SourceFile, TemplateId, RetrievedChunk } from "@/lib/types/document";
import { z } from "zod";

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
  retrievedSources?: RetrievedChunk[]; // RAG: chunk liên quan đã retrieve (thay cho sources khi có)
  errorContext?: ErrorContext; // có => lượt sửa lỗi compile/validate
  editContext?: EditContext; // có => lượt chỉnh sửa nội dung theo yêu cầu
  onChunk?: (chunk: string) => void; // callback để stream text/suy luận
  /** Template-specific repair hints forwarded to buildRepairPrompt(). Set by orchestrator. */
  templateRepairHints?: Array<{ errorPattern: string; action: string }>;
}

/** Interface duy nhất code nghiệp vụ phụ thuộc (Nguyên tắc V — provider-agnostic). */
export interface LatexProvider {
  readonly name: string;
  generate(input: GenerateInput): Promise<{ latex: string }>;
  generateObject<T>(schema: z.ZodType<T>, prompt: string): Promise<T>;
}

export class ProviderError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ProviderError";
  }
}
