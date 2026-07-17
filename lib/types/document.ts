// lib/types/document.ts
// Shared data contracts. Nguồn chuẩn: docs/11-data-model.md.

export type DocType = "article" | "report";

export const DOC_TYPES: readonly DocType[] = ["article", "report"] as const;

/** documentClass LaTeX thực tế của template (rộng hơn DocType). */
export type LatexClass = "article" | "report" | "beamer" | "exam" | "letter";

/**
 * Template cụ thể người dùng chọn để định hình format/layout/gói LaTeX.
 * `docType` (article|report) là LỚP nền coarse; `TemplateId` là DẠNG tài liệu cụ thể.
 *
 * Core set (11 templates):
 *   academic — bài báo học thuật (article)
 *   math     — toán học/định lý (article)
 *   thesis   — luận văn/báo cáo dài, nhiều chương (report)
 *   report   — báo cáo chung, theo section, KHÔNG chương (report)
 *   slides   — trình chiếu Beamer (beamer)
 *   chemistry — hóa học, phương trình phản ứng/công thức qua mhchem (article)
 *   physics   — vật lý, vector (\vec/\bm) + đơn vị SI qua siunitx (article)
 *   exam      — đề thi, câu hỏi/điểm/lời giải qua document class `exam`
 *   engineering — kỹ thuật, siunitx + circuitikz (mạch) + listings (code) (article)
 *   letter    — thư trang trọng, \opening/\closing qua document class `letter`
 *   cv        — sơ yếu lý lịch/CV, article tự layout (KHÔNG moderncv/ảnh ngoài)
 *
 * Để thêm template mới: dùng factory `defineTemplate()` trong registry.ts.
 */
export type TemplateId =
  | "academic" // Bài báo học thuật — abstract, cite, sections chuẩn
  | "math"     // Tài liệu Toán học — theorem, proof, equation
  | "thesis"   // Luận văn/Báo cáo dài — chapter hierarchy, TOC
  | "report"   // Báo cáo chung — report class nhưng theo \section (không \chapter), ngắn hơn thesis
  | "slides"   // Trình chiếu Beamer — frames, blocks, wow factor
  | "chemistry" // Hóa học — phương trình phản ứng/công thức qua mhchem (\ce{})
  | "physics"  // Vật lý — vector (\vec/\bm), đơn vị SI (siunitx), phương trình
  | "exam"     // Đề thi — document class `exam`: \question/\part/\choices/\begin{solution}
  | "engineering" // Kỹ thuật — siunitx + circuitikz (mạch) + listings (code), technical report
  | "letter"   // Thư trang trọng — document class `letter`: \opening/\closing (KHÔNG \section)
  | "cv"; // CV/Sơ yếu lý lịch — article tự layout (KHÔNG moderncv, KHÔNG \includegraphics ảnh)

export const TEMPLATE_IDS: readonly TemplateId[] = [
  "academic",
  "math",
  "thesis",
  "report",
  "slides",
  "chemistry",
  "physics",
  "exam",
  "engineering",
  "letter",
  "cv",
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
  ownerId?: string; // id chủ sở hữu (Supabase user). Tài liệu cũ (trước auth) có thể thiếu.
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
  // ---- Multi-file project (E1) ----
  // Nếu `files` có mặt ⇒ tài liệu là DỰ ÁN nhiều file (text). `rootFile` là file gốc để compile
  // (mặc định "main.tex"). Quy ước: `latex` giữ nội dung file gốc để tương thích các luồng single-file
  // (editor/chat-edit đọc `latex`). Tài liệu cũ không có `files` ⇒ single-file như trước.
  files?: ProjectFile[];
  rootFile?: string;
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
    | "title"
    | "latex"
    | "pdfBase64"
    | "log"
    | "error"
    | "attempts"
    | "messages"
    | "files"
    | "rootFile"
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
  /** true nếu tài liệu là dự án multi-file (E1a) — có `files[]` không rỗng. */
  isProject: boolean;
}

// ---- Compile ----
/**
 * Một file trong dự án multi-file (E1). Dùng cho payload gửi tới compile-service.
 * Chỉ một trong hai: `content` (text, vd .tex) HOẶC `contentBase64` (nhị phân, vd ảnh).
 */
export interface ProjectFile {
  path: string; // đường dẫn tương đối trong dự án (POSIX, không '..'/tuyệt đối)
  content?: string; // nội dung text
  contentBase64?: string; // nội dung nhị phân, mã hoá base64
}

export interface CompileSuccess {
  success: true;
  pdf: Uint8Array;
}

export interface CompileFailure {
  success: false;
  log: string;
}

export type CompileResult = CompileSuccess | CompileFailure;
