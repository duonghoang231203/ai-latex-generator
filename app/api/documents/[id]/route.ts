// app/api/documents/[id]/route.ts
// CRUD một tài liệu: GET (đọc), PATCH (sửa tiêu đề / sửa LaTeX thủ công + recompile), DELETE.
import { getConfig } from "@/lib/config";
import { compileLatex, CompileServiceError } from "@/lib/compile/client";
import { validateLatex, diagnosticsToLog } from "@/lib/validation/validate";
import { truncateLog } from "@/lib/orchestrator/truncateLog";
import {
  deleteDocument,
  getDocument,
  updateDocument,
} from "@/lib/store/documentStore";
import type { UpdateDocumentPatch } from "@/lib/types/document";
import { getCurrentUserId } from "@/lib/auth/current-user";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_request: Request, ctx: Ctx): Promise<Response> {
  const { id } = await ctx.params;
  const userId = await getCurrentUserId();
  if (!userId) {
    return Response.json({ error: "Chưa đăng nhập" }, { status: 401 });
  }
  const doc = await getDocument(id, userId);
  if (!doc) {
    return Response.json({ error: "Không tìm thấy tài liệu" }, { status: 404 });
  }
  return Response.json(doc, { status: 200 });
}

export async function DELETE(_request: Request, ctx: Ctx): Promise<Response> {
  const { id } = await ctx.params;
  const userId = await getCurrentUserId();
  if (!userId) {
    return Response.json({ error: "Chưa đăng nhập" }, { status: 401 });
  }
  const ok = await deleteDocument(id, userId);
  if (!ok) {
    return Response.json({ error: "Không tìm thấy tài liệu" }, { status: 404 });
  }
  return Response.json({ ok: true }, { status: 200 });
}

/**
 * PATCH: cập nhật tiêu đề và/hoặc LaTeX (chỉnh sửa thủ công).
 * Khi có `latex`: validate + compile lại (không gọi AI). Lưu kết quả kể cả khi lỗi
 * để người dùng thấy log và sửa tiếp.
 */
export async function PATCH(request: Request, ctx: Ctx): Promise<Response> {
  const { id } = await ctx.params;
  const cfg = getConfig();

  const userId = await getCurrentUserId();
  if (!userId) {
    return Response.json({ error: "Chưa đăng nhập" }, { status: 401 });
  }

  const existing = await getDocument(id, userId);
  if (!existing) {
    return Response.json({ error: "Không tìm thấy tài liệu" }, { status: 404 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "JSON không hợp lệ" }, { status: 400 });
  }

  const { title, latex } = (body ?? {}) as { title?: unknown; latex?: unknown };
  const patch: UpdateDocumentPatch = {};

  if (title !== undefined) {
    if (typeof title !== "string" || title.trim().length === 0) {
      return Response.json({ error: "title phải là chuỗi không rỗng" }, { status: 400 });
    }
    patch.title = title.trim().slice(0, 200);
  }

  if (latex !== undefined) {
    if (typeof latex !== "string" || latex.trim().length === 0) {
      return Response.json({ error: "latex phải là chuỗi không rỗng" }, { status: 400 });
    }
    if (latex.length > cfg.maxInputChars * 4) {
      return Response.json({ error: "Mã LaTeX quá dài" }, { status: 400 });
    }

    patch.latex = latex;
    patch.attempts = 1;

    // Validate rẻ trước, rồi compile.
    const v = validateLatex(latex);
    if (!v.ok) {
      patch.pdfBase64 = undefined;
      patch.log = diagnosticsToLog(v.diagnostics);
      patch.error = "Mã LaTeX không hợp lệ (kiểm tra cấu trúc).";
    } else {
      try {
        const c = await compileLatex(latex, {
          serviceUrl: cfg.compileServiceUrl,
          timeoutMs: cfg.requestTimeoutMs,
        });
        if (c.success) {
          patch.pdfBase64 = Buffer.from(c.pdf).toString("base64");
          patch.log = undefined;
          patch.error = undefined;
        } else {
          patch.pdfBase64 = undefined;
          patch.log = truncateLog(c.log);
          patch.error = "Biên dịch thất bại. Xem log để sửa.";
        }
      } catch (e) {
        if (e instanceof CompileServiceError) {
          return Response.json(
            { error: `Compile service không phản hồi: ${e.message}` },
            { status: 502 },
          );
        }
        const msg = e instanceof Error ? e.message : "Lỗi không xác định";
        return Response.json({ error: `Lỗi xử lý: ${msg}` }, { status: 502 });
      }
    }
  }

  if (Object.keys(patch).length === 0) {
    return Response.json({ error: "Không có trường nào để cập nhật" }, { status: 400 });
  }

  const updated = await updateDocument(id, patch, userId);
  if (!updated) {
    return Response.json({ error: "Không tìm thấy tài liệu" }, { status: 404 });
  }
  return Response.json(updated, { status: 200 });
}
