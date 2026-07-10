// lib/compile/project-path.ts
// Path-guard cho dự án multi-file (E1). Chuẩn hoá + kiểm đường dẫn tương đối an toàn.
//
// VÌ SAO CẦN (theo spike docs/features/e1-multi-file-project/spike-tectonic-multifile.md):
// Tectonic --untrusted KHÔNG chặn đọc file theo đường dẫn tuyệt đối/`..`. Nên trước khi ghi bất kỳ
// file dự án nào (do người dùng/AI đặt tên), ta PHẢI tự kiểm để mọi đường dẫn nằm trong thư mục dự án.
// Đây là bản mirror (TypeScript) của safeProjectPath trong compile-service/compile.js — kiểm sớm
// phía Next để fail nhanh; compile-service vẫn kiểm lại (defense-in-depth).

/**
 * Chuẩn hoá một đường dẫn tương đối trong dự án. Trả về đường dẫn POSIX sạch,
 * hoặc `null` nếu KHÔNG an toàn (rỗng, tuyệt đối, có `..`, ổ đĩa Windows, null-byte).
 * Segment `.` (thư mục hiện tại) được bỏ qua; segment `..` bị từ chối.
 */
export function sanitizeProjectPath(p: unknown): string | null {
  if (typeof p !== "string" || p.length === 0) return null;
  if (p.includes("\0")) return null;
  const norm = p.replace(/\\/g, "/"); // gộp backslash Windows về '/'
  if (norm.startsWith("/")) return null; // tuyệt đối POSIX
  if (/^[a-zA-Z]:/.test(norm)) return null; // ổ đĩa Windows (C:...)
  const segs = norm.split("/").filter((s) => s !== "" && s !== ".");
  if (segs.length === 0) return null;
  for (const s of segs) {
    if (s === "..") return null; // chặn traversal
  }
  return segs.join("/");
}

/** true nếu `p` là đường dẫn dự án an toàn. */
export function isSafeProjectPath(p: unknown): boolean {
  return sanitizeProjectPath(p) !== null;
}
