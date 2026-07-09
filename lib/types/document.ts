// lib/types/document.ts
// Shared data contracts. Nguồn chuẩn: docs/11-data-model.md.

export type DocType = "article" | "report";

export const DOC_TYPES: readonly DocType[] = ["article", "report"] as const;

/** documentClass LaTeX thực tế của template (rộng hơn DocType). */
export type LatexClass = "article" | "report" | "beamer" | "exam" | "letter";

/**
 * Template cụ thể người dùng chọn để định hình format/layout/gói LaTeX.
 * `docType` (article|report) là LỚP nền coarse; `TemplateId` là DẠNG tài liệu cụ thể.
 */
export type TemplateId =
  | "general" // Báo cáo thường — thuần văn bản
  | "academic" // Bài báo học thuật — abstract + tài liệu tham khảo
  | "math" // Tài liệu Toán học — định lý, chứng minh, công thức
  | "physics" // Tài liệu Vật lý — công thức, đơn vị SI, hình minh hoạ
  | "technical" // Báo cáo kỹ thuật — bảng, sơ đồ, hình
  | "thesis" // Luận văn/Báo cáo dài — nhiều chương, mục lục
  | "slides" // Trình chiếu Beamer
  | "letter" // Thư trang trọng
  | "cv" // Sơ yếu lý lịch / CV
  | "exam" // Đề thi / bài kiểm tra
  | "chemistry"; // Hóa học — phương trình phản ứng (mhchem)

export const TEMPLATE_IDS: readonly TemplateId[] = [
  "general",
  "academic",
  "math",
  "physics",
  "technical",
  "thesis",
  "slides",
  "letter",
  "cv",
  "exam",
  "chemistry",
] as const;

/** File nguồn người dùng tải lên (đã đọc thành text ở client). */
export interface SourceFile {
  name: string;
  content: string;
}

/** Định dạng đầu vào người dùng dùng để tạo tài liệu. */
export type InputFormat = "natural" | "markdown" | "latex";

export const INPUT_FORMATS: readonly InputFormat[] = [
  "natural",
  "markdown",
  "latex",
] as const;

export interface DocumentRequest {
  description: string;
  docType: DocType;
  template?: TemplateId; // dạng tài liệu cụ thể (định hình format/layout/gói)
  sources?: SourceFile[];
  inputFormat?: InputFormat; // thiếu ⇒ "natural" (đường sinh-từ-mô-tả cũ)
  markdown?: string; // chỉ dùng khi inputFormat === "markdown"
}

// ---- RAG (E3) ----
/** Một đoạn (chunk) tách từ tài liệu nguồn, giữ vị trí để trích dẫn/kiểm chứng. */
export interface Chunk {
  sourceName: string; // = SourceFile.name
  startOffset: number; // vị trí bắt đầu trong content gốc
  text: string;
}

/** Chunk đã được retrieve (kèm nhãn trích dẫn ổn định + điểm tương đồng). */
export interface RetrievedChunk extends Chunk {
  label: string; // "S1", "S2", ... (nhãn trích dẫn)
  score: number; // cosine similarity (debug/threshold)
}

export interface DocumentMetadata {
  engine: string; // 'xetex'
  packages?: string[];
  template: DocType; // lớp nền (article|report) — giữ tên field tương thích
  templateId?: TemplateId; // dạng tài liệu cụ thể
}

/** Response thành công của /api/document. */
export interface DocumentResponse {
  latex: string;
  pdfBase64: string;
  attempts: number;
  metadata?: DocumentMetadata;
  log?: string;
  warnings?: string[]; // cảnh báo không chặn (vd Markdown→LaTeX: ảnh placeholder)
}

/** Response thất bại nghiệp vụ (repair loop vượt N lần) — vẫn HTTP 200. */
export interface DocumentError {
  error: string;
  latex?: string;
  log?: string;
  attempts: number;
  warnings?: string[];
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
  template?: TemplateId;
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
  template: TemplateId;
  description: string;
  latex: string;
  pdfBase64?: string;
  log?: string;
  error?: string; // thất bại nghiệp vụ gần nhất (nếu có)
  attempts: number;
  messages: ChatMessage[];
  createdAt: string; // ISO 8601
  updatedAt: string; // ISO 8601
  inputFormat?: InputFormat; // định dạng đã dùng để tạo (thiếu ⇒ "natural")
  sourceMarkdown?: string; // Markdown gốc nếu tạo từ Markdown (để round-trip)
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
  template: TemplateId;
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
