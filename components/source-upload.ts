"use client";

// Tiện ích upload nguồn dùng chung cho UI: đọc file text tại client, còn pdf/docx/ảnh
// gửi /api/extract để trích xuất văn bản (server). Trả về SourceFile { name, content }.

import type { SourceFile } from "@/lib/types/document";

// Định dạng chấp nhận: văn bản (đọc tại client) + pdf/docx/ảnh (trích xuất tại server).
export const SOURCE_ACCEPT =
  ".txt,.md,.markdown,.tex,.csv,.json,.log,.rtf,.pdf,.docx,.png,.jpg,.jpeg,.webp,.bmp,.tif,.tiff,.gif";

const TEXT_EXT = new Set(["txt", "md", "markdown", "tex", "csv", "json", "log", "rtf"]);

export function extOf(name: string): string {
  const i = name.lastIndexOf(".");
  return i >= 0 ? name.slice(i + 1).toLowerCase() : "";
}

export function isTextLike(name: string): boolean {
  return TEXT_EXT.has(extOf(name));
}

/** Đọc text-file tại client; file khác (pdf/docx/ảnh) gửi /api/extract để trích xuất. */
export async function fileToSource(f: File): Promise<SourceFile> {
  if (isTextLike(f.name)) {
    return { name: f.name, content: await f.text() };
  }
  const fd = new FormData();
  fd.append("file", f);
  const res = await fetch("/api/extract", { method: "POST", body: fd });
  const data = (await res.json()) as { content?: string; error?: string };
  if (!res.ok || typeof data.content !== "string") {
    throw new Error(data.error ?? `Không trích xuất được ${f.name}`);
  }
  return { name: f.name, content: data.content };
}

/** Trích xuất một danh sách file → sources; gom lỗi theo từng file (không dừng cả mẻ). */
export async function filesToSources(
  files: File[],
): Promise<{ sources: SourceFile[]; errors: string[] }> {
  const sources: SourceFile[] = [];
  const errors: string[] = [];
  for (const f of files) {
    try {
      sources.push(await fileToSource(f));
    } catch (err) {
      errors.push(err instanceof Error ? err.message : `Lỗi với ${f.name}`);
    }
  }
  return { sources, errors };
}
