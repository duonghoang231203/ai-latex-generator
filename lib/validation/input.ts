// lib/validation/input.ts
import { DOC_TYPES, type DocType } from "@/lib/types/document";

export interface ValidatedInput {
  description: string;
  docType: DocType;
}

export type InputValidation =
  | { ok: true; value: ValidatedInput }
  | { ok: false; error: string };

export function validateDocumentInput(
  body: unknown,
  maxInputChars: number,
): InputValidation {
  if (typeof body !== "object" || body === null) {
    return { ok: false, error: "Body không hợp lệ" };
  }
  const { description, docType } = body as {
    description?: unknown;
    docType?: unknown;
  };

  if (typeof description !== "string" || description.trim().length === 0) {
    return { ok: false, error: "Mô tả không được để trống" };
  }
  if (description.length > maxInputChars) {
    return {
      ok: false,
      error: `Mô tả quá dài (tối đa ${maxInputChars} ký tự)`,
    };
  }

  // docType: thiếu => mặc định 'article'; sai giá trị => lỗi.
  let dt: DocType = "article";
  if (docType !== undefined) {
    if (typeof docType !== "string" || !DOC_TYPES.includes(docType as DocType)) {
      return { ok: false, error: "docType phải là 'article' hoặc 'report'" };
    }
    dt = docType as DocType;
  }

  return { ok: true, value: { description: description.trim(), docType: dt } };
}
