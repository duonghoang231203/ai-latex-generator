// lib/types/document.ts
// Shared data contracts. Nguồn chuẩn: docs/11-data-model.md.

export type DocType = "article" | "report";

export const DOC_TYPES: readonly DocType[] = ["article", "report"] as const;

export interface DocumentRequest {
  description: string;
  docType: DocType;
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
