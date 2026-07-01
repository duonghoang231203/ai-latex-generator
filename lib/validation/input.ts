// lib/validation/input.ts
import { DOC_TYPES, type DocType, type SourceFile } from "@/lib/types/document";

export interface ValidatedInput {
  description: string;
  docType: DocType;
  sources: SourceFile[];
}

export interface InputLimits {
  maxInputChars: number;
  maxSourceFiles: number;
  maxSourceChars: number;
}

export type InputValidation =
  | { ok: true; value: ValidatedInput }
  | { ok: false; error: string };

function parseSources(
  raw: unknown,
  limits: InputLimits,
): { ok: true; sources: SourceFile[] } | { ok: false; error: string } {
  if (raw === undefined || raw === null) return { ok: true, sources: [] };
  if (!Array.isArray(raw)) return { ok: false, error: "sources phải là mảng" };
  if (raw.length > limits.maxSourceFiles) {
    return { ok: false, error: `Tối đa ${limits.maxSourceFiles} file nguồn` };
  }
  const sources: SourceFile[] = [];
  let total = 0;
  for (const item of raw) {
    const { name, content } = (item ?? {}) as { name?: unknown; content?: unknown };
    if (typeof name !== "string" || typeof content !== "string") {
      return { ok: false, error: "Mỗi file nguồn cần có 'name' và 'content' dạng chuỗi" };
    }
    total += content.length;
    if (total > limits.maxSourceChars) {
      return {
        ok: false,
        error: `Tổng nội dung file nguồn vượt ${limits.maxSourceChars} ký tự`,
      };
    }
    sources.push({ name, content });
  }
  return { ok: true, sources };
}

export function validateDocumentInput(
  body: unknown,
  limits: InputLimits,
): InputValidation {
  if (typeof body !== "object" || body === null) {
    return { ok: false, error: "Body không hợp lệ" };
  }
  const { description, docType, sources } = body as {
    description?: unknown;
    docType?: unknown;
    sources?: unknown;
  };

  const parsedSources = parseSources(sources, limits);
  if (!parsedSources.ok) return { ok: false, error: parsedSources.error };

  const desc = typeof description === "string" ? description : "";
  const hasSources = parsedSources.sources.length > 0;

  // Cho phép mô tả trống NẾU có ít nhất một file nguồn.
  if (desc.trim().length === 0 && !hasSources) {
    return { ok: false, error: "Cần nhập mô tả hoặc tải lên ít nhất một file nguồn" };
  }
  if (desc.length > limits.maxInputChars) {
    return { ok: false, error: `Mô tả quá dài (tối đa ${limits.maxInputChars} ký tự)` };
  }

  let dt: DocType = "article";
  if (docType !== undefined) {
    if (typeof docType !== "string" || !DOC_TYPES.includes(docType as DocType)) {
      return { ok: false, error: "docType phải là 'article' hoặc 'report'" };
    }
    dt = docType as DocType;
  }

  return {
    ok: true,
    value: { description: desc.trim(), docType: dt, sources: parsedSources.sources },
  };
}
