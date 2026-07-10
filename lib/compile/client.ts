import type { CompileResult, ProjectFile } from "@/lib/types/document";
import { sanitizeProjectPath } from "@/lib/compile/project-path";

export class CompileServiceError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CompileServiceError";
  }
}

export interface CompileClientOptions {
  serviceUrl: string;
  timeoutMs: number;
}

/** POST một body tới compile-service; trả PDF binary (success) hoặc {success:false,log}. */
async function postCompile(
  body: unknown,
  opts: CompileClientOptions,
): Promise<CompileResult> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), opts.timeoutMs);
  try {
    const res = await fetch(`${opts.serviceUrl}/compile`, {
      method: "POST",
      signal: controller.signal,
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
    const contentType = res.headers.get("content-type") ?? "";
    if (res.ok && contentType.includes("application/pdf")) {
      const buf = new Uint8Array(await res.arrayBuffer());
      return { success: true, pdf: buf };
    }
    // Trường hợp compile lỗi trả JSON.
    if (contentType.includes("application/json")) {
      const data = (await res.json()) as { log?: string };
      return { success: false, log: data.log ?? "Compile thất bại (không có log)" };
    }
    throw new CompileServiceError(
      `Compile service phản hồi bất thường: ${res.status}`,
    );
  } catch (e) {
    if (e instanceof CompileServiceError) throw e;
    throw new CompileServiceError(
      e instanceof Error ? e.message : "Không gọi được compile service",
    );
  } finally {
    clearTimeout(timer);
  }
}

/** Gọi compile-service (single-file). Giữ tương thích ngược cho luồng hiện có. */
export async function compileLatex(
  latex: string,
  opts: CompileClientOptions,
): Promise<CompileResult> {
  return postCompile({ latex }, opts);
}

/**
 * Gọi compile-service với dự án multi-file (E1).
 * Kiểm đường dẫn phía Next TRƯỚC khi gửi (fail nhanh); compile-service vẫn kiểm lại.
 */
export async function compileProject(
  files: ProjectFile[],
  rootFile: string,
  opts: CompileClientOptions,
): Promise<CompileResult> {
  if (!Array.isArray(files) || files.length === 0) {
    return { success: false, log: "Dự án rỗng: thiếu 'files'" };
  }
  const rootRel = sanitizeProjectPath(rootFile);
  if (!rootRel) {
    return { success: false, log: `rootFile không hợp lệ: ${String(rootFile)}` };
  }
  const normalized: ProjectFile[] = [];
  for (const f of files) {
    const rel = sanitizeProjectPath(f?.path);
    if (!rel) {
      return { success: false, log: `Đường dẫn file không hợp lệ: ${String(f?.path)}` };
    }
    normalized.push({ ...f, path: rel });
  }
  if (!normalized.some((f) => f.path === rootRel)) {
    return { success: false, log: `rootFile '${rootRel}' không nằm trong danh sách file` };
  }
  return postCompile({ files: normalized, rootFile: rootRel }, opts);
}
