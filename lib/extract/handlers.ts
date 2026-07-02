// lib/extract/handlers.ts
// Handler thật cho trích xuất: pdf-parse (PDF), mammoth (DOCX), tesseract.js (OCR ảnh).
// Dùng dynamic import để không nạp thư viện nặng khi chưa cần (và không vỡ nếu chỉ dùng text).

import type { ExtractHandlers } from "@/lib/extract/extract";

async function extractPdf(bytes: Uint8Array): Promise<string> {
  // Import lib nội bộ để tránh khối "debug mode" trong index của pdf-parse.
  const { default: pdfParse } = await import("pdf-parse/lib/pdf-parse.js");
  const data = await pdfParse(Buffer.from(bytes));
  return data?.text ?? "";
}

async function extractDocx(bytes: Uint8Array): Promise<string> {
  const mammoth = await import("mammoth");
  const res = await mammoth.extractRawText({ buffer: Buffer.from(bytes) });
  return res?.value ?? "";
}

/** OCR ảnh bằng Tesseract.js. Tải model ngôn ngữ lần đầu (cần mạng nếu chưa cache). */
async function ocrImage(bytes: Uint8Array, langs: string): Promise<string> {
  const os = await import("node:os");
  const path = await import("node:path");
  const { createWorker } = await import("tesseract.js");
  // Cache model vào thư mục ghi được & bền vững (mount volume trong Docker).
  // Cấu hình qua TESSERACT_CACHE_DIR; mặc định tmpdir (container Next chạy non-root).
  const cachePath =
    process.env.TESSERACT_CACHE_DIR || path.join(os.tmpdir(), "tesseract-cache");
  const worker = await createWorker(langs, undefined, { cachePath });
  try {
    const { data } = await worker.recognize(Buffer.from(bytes));
    return data?.text ?? "";
  } finally {
    await worker.terminate();
  }
}

export const realHandlers: ExtractHandlers = {
  pdf: extractPdf,
  docx: extractDocx,
  ocr: ocrImage,
};
