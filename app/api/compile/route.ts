// app/api/compile/route.ts
// Compile thuần (KHÔNG qua AI). Nhận:
//   - { latex }                    → single-file (tương thích ngược).
//   - { files: ProjectFile[], rootFile } → dự án multi-file (E1). Path-guard trong client.
import { getConfig } from "@/lib/config";
import {
  compileLatex,
  compileProject,
  CompileServiceError,
} from "@/lib/compile/client";
import type { ProjectFile, CompileResult } from "@/lib/types/document";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request): Promise<Response> {
  const cfg = getConfig();
  const clientOpts = {
    serviceUrl: cfg.compileServiceUrl,
    timeoutMs: cfg.requestTimeoutMs,
  };

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "JSON không hợp lệ" }, { status: 400 });
  }

  const b = body as { latex?: unknown; files?: unknown; rootFile?: unknown };

  try {
    let result: CompileResult;
    if (Array.isArray(b.files)) {
      // Multi-file (E1).
      if (typeof b.rootFile !== "string" || b.rootFile.trim().length === 0) {
        return Response.json({ error: "Thiếu 'rootFile'" }, { status: 400 });
      }
      result = await compileProject(
        b.files as ProjectFile[],
        b.rootFile,
        clientOpts,
      );
    } else if (typeof b.latex === "string" && b.latex.trim().length > 0) {
      // Single-file (tương thích ngược).
      result = await compileLatex(b.latex, clientOpts);
    } else {
      return Response.json(
        { error: "Thiếu 'latex' hoặc 'files' + 'rootFile'" },
        { status: 400 },
      );
    }

    if (result.success) {
      return new Response(new Uint8Array(result.pdf), {
        status: 200,
        headers: { "content-type": "application/pdf" },
      });
    }
    return Response.json({ success: false, log: result.log }, { status: 200 });
  } catch (e) {
    if (e instanceof CompileServiceError) {
      return Response.json(
        { error: `Compile service lỗi: ${e.message}` },
        { status: 502 },
      );
    }
    return Response.json({ error: "Lỗi không xác định" }, { status: 500 });
  }
}
