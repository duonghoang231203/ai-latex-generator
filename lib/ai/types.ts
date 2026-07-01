// lib/ai/types.ts
import type { DocType } from "@/lib/types/document";

/** Ngữ cảnh cho lượt SỬA lỗi — đến từ AST validation HOẶC compile. */
export interface ErrorContext {
  previousLatex: string;
  errorLog: string;
}

export interface GenerateInput {
  description: string;
  docType: DocType;
  errorContext?: ErrorContext; // có => lượt sửa
}

/** Interface duy nhất code nghiệp vụ phụ thuộc (Nguyên tắc V — provider-agnostic). */
export interface LatexProvider {
  readonly name: string;
  generate(input: GenerateInput): Promise<{ latex: string }>;
}
