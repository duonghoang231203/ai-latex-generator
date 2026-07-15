import type { CompileResult, ProjectFile } from "@/lib/types/document";
import { sanitizeProjectPath } from "@/lib/compile/project-path";
import type { LogFields } from "@/lib/log";

export class CompileServiceError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CompileServiceError";
  }
}

export interface CompileClientOptions {
  serviceUrl: string;
  timeoutMs: number;
  /**
   * Observability (BE-5.3.4, optional — mặc định không log gì, giữ hành vi hiện tại cho mọi
   * caller không truyền field này, vd. lib/prompt-eval/scorers/compile-success.ts). Cùng cơ chế
   * DI đã dùng cho OrchestratorDeps.logger (BE-5.3.2/5.3.3) — caller quyết định requestId gắn thế
   * nào, postCompile() chỉ gọi logger?.(event, fields).
   */
  logger?: (event: string, fields: LogFields) => void;
}

/** POST một body tới compile-service; trả PDF binary (success) hoặc {success:false,log}. */
async function postCompile(
  body: unknown,
  opts: CompileClientOptions,
): Promise<CompileResult> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), opts.timeoutMs);
  const startedAt = Date.now();
  try {
    const res = await fetch(`${opts.serviceUrl}/compile`, {
      method: "POST",
      signal: controller.signal,
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
    const latencyMs = Date.now() - startedAt;
    const contentType = res.headers.get("content-type") ?? "";
    if (res.ok && contentType.includes("application/pdf")) {
      const buf = new Uint8Array(await res.arrayBuffer());
      opts.logger?.("compile.request", {
        outcome: "success",
        latencyMs,
        status: res.status,
      });
      return { success: true, pdf: buf };
    }
    // Trường hợp compile lỗi trả JSON — lỗi NỘI DUNG LaTeX (không phải hạ tầng), phân biệt rõ với
    // lỗi network/timeout/status bất thường bên dưới (khác nhau ở việc nên sửa prompt hay sửa infra).
    if (contentType.includes("application/json")) {
      const data = (await res.json()) as { log?: string };
      opts.logger?.("compile.request", {
        outcome: "compile_error",
        latencyMs,
        status: res.status,
      });
      return { success: false, log: data.log ?? "Compile thất bại (không có log)" };
    }
    opts.logger?.("compile.request", {
      outcome: "infra_error",
      latencyMs,
      status: res.status,
    });
    throw new CompileServiceError(
      `Compile service phản hồi bất thường: ${res.status}`,
    );
  } catch (e) {
    if (e instanceof CompileServiceError) throw e;
    // Lỗi network/abort (timeout) — KHÔNG có res.status (fetch chưa từng nhận response).
    opts.logger?.("compile.request", {
      outcome: "infra_error",
      latencyMs: Date.now() - startedAt,
      message: e instanceof Error ? e.message : "unknown",
    });
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
