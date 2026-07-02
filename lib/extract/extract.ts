// lib/extract/extract.ts
// Trích xuất văn bản từ file upload. Lõi tách khỏi thư viện nặng (DI qua ExtractHandlers)
// để dễ test; handler thật (pdf-parse/mammoth/tesseract) ở handlers.ts.

export type ExtractKind = "text" | "pdf" | "docx" | "image";

export interface ExtractInput {
  name: string;
  mimeType: string;
  bytes: Uint8Array;
}

export interface ExtractOptions {
  maxUploadBytes: number;
  ocrEnabled: boolean;
  ocrLangs: string;
}

/** Các bộ trích xuất phụ thuộc — tách ra để inject/mock trong test. */
export interface ExtractHandlers {
  pdf: (bytes: Uint8Array) => Promise<string>;
  docx: (bytes: Uint8Array) => Promise<string>;
  ocr: (bytes: Uint8Array, langs: string) => Promise<string>;
}

export type ExtractResult =
  | { ok: true; name: string; kind: ExtractKind; content: string; chars: number }
  | { ok: false; error: string };

const TEXT_EXT = new Set([
  "txt", "md", "markdown", "tex", "csv", "json", "log", "rtf",
]);
const IMAGE_EXT = new Set(["png", "jpg", "jpeg", "webp", "bmp", "tif", "tiff", "gif"]);
const DOCX_MIME =
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

function ext(name: string): string {
  const i = name.lastIndexOf(".");
  return i >= 0 ? name.slice(i + 1).toLowerCase() : "";
}

/** Phân loại kiểu file theo phần mở rộng + MIME. null = không hỗ trợ. */
export function classify(name: string, mimeType: string): ExtractKind | null {
  const e = ext(name);
  const m = (mimeType || "").toLowerCase();

  if (e === "pdf" || m === "application/pdf") return "pdf";
  if (e === "docx" || m === DOCX_MIME) return "docx";
  if (IMAGE_EXT.has(e) || m.startsWith("image/")) return "image";
  if (TEXT_EXT.has(e) || m.startsWith("text/") || m === "application/json") {
    return "text";
  }
  // .doc cũ (binary) không hỗ trợ.
  return null;
}

function decodeText(bytes: Uint8Array): string {
  return new TextDecoder("utf-8", { fatal: false }).decode(bytes);
}

/**
 * Trích xuất văn bản từ một file. Kiểm giới hạn kích thước, phân loại, rồi gọi handler phù hợp.
 * Ảnh chỉ được OCR khi `ocrEnabled`.
 */
export async function extractText(
  input: ExtractInput,
  opts: ExtractOptions,
  handlers: ExtractHandlers,
): Promise<ExtractResult> {
  if (input.bytes.byteLength === 0) {
    return { ok: false, error: "Tệp rỗng" };
  }
  if (input.bytes.byteLength > opts.maxUploadBytes) {
    const mb = (opts.maxUploadBytes / (1024 * 1024)).toFixed(0);
    return { ok: false, error: `Tệp quá lớn (giới hạn ${mb}MB)` };
  }

  const kind = classify(input.name, input.mimeType);
  if (!kind) {
    return {
      ok: false,
      error:
        "Định dạng không hỗ trợ. Hỗ trợ: văn bản (.txt/.md/.tex/.csv/.json), .pdf, .docx, và ảnh (.png/.jpg/...).",
    };
  }

  let content: string;
  try {
    switch (kind) {
      case "text":
        content = decodeText(input.bytes);
        break;
      case "pdf":
        content = await handlers.pdf(input.bytes);
        break;
      case "docx":
        content = await handlers.docx(input.bytes);
        break;
      case "image":
        if (!opts.ocrEnabled) {
          return {
            ok: false,
            error: "OCR đang tắt (OCR_ENABLED=false) nên không đọc được ảnh.",
          };
        }
        content = await handlers.ocr(input.bytes, opts.ocrLangs);
        break;
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : "lỗi không xác định";
    return { ok: false, error: `Không trích xuất được nội dung (${kind}): ${msg}` };
  }

  const trimmed = (content ?? "").trim();
  if (trimmed.length === 0) {
    return {
      ok: false,
      error:
        kind === "image"
          ? "OCR không nhận được văn bản từ ảnh (ảnh mờ hoặc không có chữ?)."
          : "Không tìm thấy văn bản trong tệp.",
    };
  }

  return { ok: true, name: input.name, kind, content: trimmed, chars: trimmed.length };
}
