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
  /** Override maxOutputTokens cho lượt gọi này (dùng bởi truncation-recovery retry). */
  maxTokensOverride?: number;
}

/**
 * Unified finish reason — mirror Vercel AI SDK's FinishReason (ai@7.x), nhưng khai báo riêng
 * ở đây để LatexProvider KHÔNG phụ thuộc trực tiếp vào type nội bộ của 'ai' package
 * (Nguyên tắc V — provider-agnostic; MockProvider không import 'ai').
 *
 *   "stop"           — model tự kết thúc, output hoàn chỉnh.
 *   "length"          — BỊ CẮT vì đạt maxOutputTokens. KHÔNG coi là compile error — xử lý bằng
 *                       truncation-recovery (tăng token/regenerate ngắn hơn), KHÔNG đi qua
 *                       runRepairLoop (đó là dành cho lỗi compile của một document HOÀN CHỈNH).
 *   "content-filter"  — bị chặn bởi content policy của provider — không nên retry mù quáng.
 *   "tool-calls"      — model gọi tool (không dùng trong luồng generate LaTeX hiện tại).
 *   "error"           — lỗi phía provider trong lúc generate.
 *   "other"           — giá trị không map được vào các loại trên.
 */
export type FinishReason =
  | "stop"
  | "length"
  | "content-filter"
  | "tool-calls"
  | "error"
  | "other";

/** Kết quả một lượt generate — kèm tín hiệu finishReason để orchestrator quyết định đúng nhánh xử lý. */
export interface GenerateOutcome {
  latex: string;
  finishReason: FinishReason;
  /** Giá trị gốc từ provider trước khi map — dùng để debug/log, không dùng để quyết định logic. */
  rawFinishReason?: string;
  usage?: {
    inputTokens?: number;
    outputTokens?: number;
    totalTokens?: number;
  };
}

/** Interface duy nhất code nghiệp vụ phụ thuộc (Nguyên tắc V — provider-agnostic). */
export interface LatexProvider {
  readonly name: string;
  generate(input: GenerateInput): Promise<GenerateOutcome>;
  generateObject<T>(schema: z.ZodType<T>, prompt: string): Promise<T>;
}

export class ProviderError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ProviderError";
  }
}
