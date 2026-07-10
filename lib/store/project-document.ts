// lib/store/project-document.ts
// Cầu nối single-file ↔ multi-file (E1). Cho phép phần còn lại của hệ thống xử lý MỌI tài liệu
// theo một hình dạng thống nhất (danh sách file + file gốc), bất kể nó là single-file (cũ) hay
// dự án multi-file (mới). Tái dùng path-guard (sanitizeProjectPath) để không tin đường dẫn mù quáng.

import type { ProjectFile, StoredDocument } from "@/lib/types/document";
import { sanitizeProjectPath } from "@/lib/compile/project-path";

export const DEFAULT_ROOT_FILE = "main.tex";

/** true nếu tài liệu là dự án multi-file (có mảng `files` không rỗng). */
export function isMultiFile(
  doc: Pick<StoredDocument, "files">,
): boolean {
  return Array.isArray(doc.files) && doc.files.length > 0;
}

/** Tên file gốc để compile. Multi-file: `rootFile` (mặc định file đầu/`main.tex`); single-file: `main.tex`. */
export function getRootFile(
  doc: Pick<StoredDocument, "files" | "rootFile">,
): string {
  if (isMultiFile(doc)) {
    return doc.rootFile ?? doc.files![0].path ?? DEFAULT_ROOT_FILE;
  }
  return DEFAULT_ROOT_FILE;
}

/**
 * Danh sách file dự án theo hình dạng thống nhất.
 * - Multi-file: trả `files` như-hiện-có.
 * - Single-file: tổng hợp một file `main.tex` từ `latex` (để compile/hiển thị đồng nhất).
 */
export function getProjectFiles(
  doc: Pick<StoredDocument, "files" | "latex">,
): ProjectFile[] {
  if (Array.isArray(doc.files) && doc.files.length > 0) {
    return doc.files;
  }
  return [{ path: DEFAULT_ROOT_FILE, content: doc.latex ?? "" }];
}

export interface ProjectValidationError {
  ok: false;
  error: string;
}
export interface ProjectValidationOk {
  ok: true;
  files: ProjectFile[];
  rootFile: string;
}
export type ProjectValidation = ProjectValidationOk | ProjectValidationError;

/**
 * Kiểm một dự án multi-file trước khi lưu/compile: mọi path an toàn + duy nhất, rootFile hợp lệ và
 * nằm trong danh sách. Trả về danh sách đã chuẩn hoá path (POSIX sạch) khi hợp lệ.
 */
export function validateProject(
  files: ProjectFile[],
  rootFile: string,
): ProjectValidation {
  if (!Array.isArray(files) || files.length === 0) {
    return { ok: false, error: "Dự án rỗng: thiếu 'files'" };
  }
  const rootRel = sanitizeProjectPath(rootFile);
  if (!rootRel) {
    return { ok: false, error: `rootFile không hợp lệ: ${String(rootFile)}` };
  }
  const seen = new Set<string>();
  const normalized: ProjectFile[] = [];
  for (const f of files) {
    const rel = sanitizeProjectPath(f?.path);
    if (!rel) {
      return { ok: false, error: `Đường dẫn file không hợp lệ: ${String(f?.path)}` };
    }
    if (seen.has(rel)) {
      return { ok: false, error: `Đường dẫn file trùng lặp: ${rel}` };
    }
    seen.add(rel);
    normalized.push({ ...f, path: rel });
  }
  if (!seen.has(rootRel)) {
    return { ok: false, error: `rootFile '${rootRel}' không nằm trong danh sách file` };
  }
  return { ok: true, files: normalized, rootFile: rootRel };
}

/** Nội dung file gốc (để đồng bộ trường `latex`). Rỗng nếu không tìm thấy. */
export function getRootContent(
  doc: Pick<StoredDocument, "files" | "rootFile" | "latex">,
): string {
  if (!isMultiFile(doc)) return doc.latex ?? "";
  const root = getRootFile(doc);
  const found = doc.files!.find((f) => f.path === root);
  return found?.content ?? doc.latex ?? "";
}
