// lib/types/document.ts
// Shared data contracts. Nguồn chuẩn: docs/11-data-model.md.

export type DocType = "article" | "report";

export const DOC_TYPES: readonly DocType[] = ["article", "report"] as const;

/** File nguồn người dùng tải lên (đã đọc thành text ở client). */
export interface SourceFile {
  name: string;
  content: string;
}

export interface DocumentRequest {
  description: string;
  docType: DocType;
  sources?: SourceFile[];
}

export interface DocumentMetadata {
  engine: string; // 'xetex'
  packages?: string[];
  template: DocType;
}

/** Response thành công của /api/document. */
export interface DocumentResponse {
  latex: string;
  pdfBase64: string;
  attempts: number;
  metadata?: DocumentMetadata;
  log?: string;
}

/** Response thất bại nghiệp vụ (repair loop vượt N lần) — vẫn HTTP 200. */
export interface DocumentError {
  error: string;
  latex?: string;
  log?: string;
  attempts: number;
}

export type DocumentResult = DocumentResponse | DocumentError;

export function isDocumentError(r: DocumentResult): r is DocumentError {
  return (r as DocumentError).error !== undefined;
}

// ---- Chat-edit ----
/** Yêu cầu chỉnh sửa một tài liệu đã có bằng chỉ thị ngôn ngữ tự nhiên. */
export interface EditRequest {
  currentLatex: string;
  instruction: string;
  docType: DocType;
}

// ---- Persistence (lưu trữ tài liệu đã generate) ----
export type ChatRole = "user" | "assistant";

/** Một lượt trong lịch sử chat chỉnh sửa tài liệu. */
export interface ChatMessage {
  id: string;
  role: ChatRole;
  content: string;
  createdAt: string; // ISO 8601
}

/** Tài liệu được lưu trữ (file-based). Nguồn sự thật cho luồng CRUD. */
export interface StoredDocument {
  id: string;
  title: string;
  docType: DocType;
  description: string;
  latex: string;
  pdfBase64?: string;
  log?: string;
  error?: string; // thất bại nghiệp vụ gần nhất (nếu có)
  attempts: number;
  messages: ChatMessage[];
  createdAt: string; // ISO 8601
  updatedAt: string; // ISO 8601
}

/** Dữ liệu tạo mới tài liệu (id/timestamps/messages sinh tự động). */
export type CreateDocumentInput = Omit<
  StoredDocument,
  "id" | "createdAt" | "updatedAt" | "messages"
> & { messages?: ChatMessage[] };

/** Trường được phép cập nhật qua store.update. */
export type UpdateDocumentPatch = Partial<
  Pick<
    StoredDocument,
    "title" | "latex" | "pdfBase64" | "log" | "error" | "attempts" | "messages"
  >
>;

/** Bản tóm tắt cho danh sách (không kèm latex/pdf nặng). */
export interface DocumentSummary {
  id: string;
  title: string;
  docType: DocType;
  attempts: number;
  hasPdf: boolean;
  createdAt: string;
  updatedAt: string;
}

// ---- Compile ----
export interface CompileSuccess {
  success: true;
  pdf: Uint8Array;
}

export interface CompileFailure {
  success: false;
  log: string;
}

export type CompileResult = CompileSuccess | CompileFailure;
