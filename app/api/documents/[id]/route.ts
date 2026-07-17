// app/api/documents/[id]/route.ts
// CRUD một tài liệu: GET (đọc), PATCH (sửa tiêu đề / sửa LaTeX thủ công + recompile — single-file
// HOẶC multi-file E1a), DELETE.
import { getConfig } from "@/lib/config";
import { compileLatex, compileProject, CompileServiceError } from "@/lib/compile/client";
import { validateLatex, diagnosticsToLog } from "@/lib/validation/validate";
import { truncateLog } from "@/lib/orchestrator/truncateLog";
import { getTemplate } from "@/lib/templates/registry";
import { validateProject, getRootContent } from "@/lib/store/project-document";
import {
  deleteDocument,
  getDocument,
  updateDocument,
} from "@/lib/store/documentStore";
import type { ProjectFile, UpdateDocumentPatch } from "@/lib/types/document";
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

/** Kiểm mỗi file gửi lên trong PATCH multi-file: path phải kết thúc bằng .tex + không rỗng. */
function validateProjectFileShapes(files: unknown): string | null {
  if (!Array.isArray(files) || files.length === 0) {
    return "files phải là một mảng không rỗng";
  }
  for (const f of files) {
    if (!f || typeof f !== "object") return "Mục file không hợp lệ";
    const path = (f as { path?: unknown }).path;
    if (typeof path !== "string" || path.trim().length === 0) {
      return "Mỗi file phải có 'path' không rỗng";
    }
    if (!path.toLowerCase().endsWith(".tex")) {
      // E1a: chỉ hỗ trợ file text .tex — asset nhị phân hoãn lại (xem explainer.md).
      return `Tên file phải có đuôi .tex: '${path}'`;
    }
  }
  return null;
}

/**
 * PATCH: cập nhật tiêu đề và/hoặc LaTeX (chỉnh sửa thủ công) và/hoặc dự án multi-file (E1a).
 * - Có `latex` (không có `files`): single-file — validate + compile lại (không gọi AI).
 * - Có `files` (+`rootFile` tuỳ chọn): multi-file — validateProject → validate nội dung ghép
 *   (template-aware) → compileProject. `latex` bị bỏ qua nếu gửi đồng thời với `files` (tránh mơ hồ
 *   về trường nào là nguồn sự thật); `patch.latex` luôn được đồng bộ = nội dung file gốc sau khi lưu.
 * Lưu kết quả kể cả khi lỗi để người dùng thấy log và sửa tiếp.
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

  const { title, latex, files, rootFile, compile } = (body ?? {}) as {
    title?: unknown;
    latex?: unknown;
    files?: unknown;
    rootFile?: unknown;
    compile?: unknown;
  };
  // compile !== false ⇒ giữ hành vi cũ (validate + compile). compile === false ⇒ CHỈ persist nội
  // dung (auto-save nháp, FE-2.4): bỏ qua validate + compile, GIỮ NGUYÊN pdfBase64/log/error và
  // KHÔNG đổi attempts (draft-save không phải một lần biên dịch). Vẫn chặn latex rỗng / path xấu.
  const skipCompile = compile === false;
  const patch: UpdateDocumentPatch = {};

  if (title !== undefined) {
    if (typeof title !== "string" || title.trim().length === 0) {
      return Response.json({ error: "title phải là chuỗi không rỗng" }, { status: 400 });
    }
    patch.title = title.trim().slice(0, 200);
  }

  const tpl = getTemplate(existing.template);
  const validateOpts = {
    packageAllowlist: tpl?.packageAllowlist,
    knownTheoremEnvironments: tpl?.knownTheoremEnvironments,
  };

  if (files !== undefined) {
    // ---- Nhánh multi-file (E1a) — `latex` gửi đồng thời (nếu có) bị BỎ QUA có chủ đích. ----
    const shapeError = validateProjectFileShapes(files);
    if (shapeError) {
      return Response.json({ error: shapeError }, { status: 400 });
    }
    const rootFileInput =
      typeof rootFile === "string" && rootFile.trim().length > 0
        ? rootFile
        : existing.rootFile ?? (files as ProjectFile[])[0]?.path;

    const validation = validateProject(files as ProjectFile[], String(rootFileInput));
    if (!validation.ok) {
      return Response.json({ error: validation.error }, { status: 400 });
    }
    const { files: normalizedFiles, rootFile: normalizedRoot } = validation;

    if (normalizedFiles.length > cfg.maxProjectFiles) {
      return Response.json(
        { error: `Quá nhiều file (giới hạn ${cfg.maxProjectFiles})` },
        { status: 400 },
      );
    }
    const totalBytes = normalizedFiles.reduce((sum, f) => {
      if (typeof f.contentBase64 === "string") {
        return sum + Buffer.byteLength(f.contentBase64, "base64");
      }
      return sum + Buffer.byteLength(f.content ?? "", "utf8");
    }, 0);
    if (totalBytes > cfg.maxProjectBytes) {
      return Response.json({ error: "Dự án vượt giới hạn kích thước" }, { status: 400 });
    }

    patch.files = normalizedFiles;
    patch.rootFile = normalizedRoot;
    // Luôn đồng bộ latex = nội dung file gốc (giữ invariant, kể cả khi chỉ persist không compile).
    patch.latex = getRootContent({
      files: normalizedFiles,
      rootFile: normalizedRoot,
      latex: existing.latex,
    });

    if (!skipCompile) {
      patch.attempts = 1;
      // Validate rẻ trước (ghép toàn bộ nội dung — cho phép \ref/\label liên-file không báo sai),
      // rồi compile CẢ dự án.
      const concatenated = normalizedFiles.map((f) => f.content ?? "").join("\n");
      const v = validateLatex(concatenated, validateOpts);
      if (!v.ok) {
        patch.pdfBase64 = undefined;
        patch.log = diagnosticsToLog(v.diagnostics);
        patch.error = "Mã LaTeX không hợp lệ (kiểm tra cấu trúc).";
      } else {
        try {
          const c = await compileProject(normalizedFiles, normalizedRoot, {
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
  } else if (latex !== undefined) {
    // ---- Nhánh single-file (không đổi hành vi ngoài việc bổ sung template-aware validate). ----
    if (typeof latex !== "string" || latex.trim().length === 0) {
      return Response.json({ error: "latex phải là chuỗi không rỗng" }, { status: 400 });
    }
    if (latex.length > cfg.maxInputChars * 4) {
      return Response.json({ error: "Mã LaTeX quá dài" }, { status: 400 });
    }

    patch.latex = latex;

    if (!skipCompile) {
      patch.attempts = 1;
      // Validate rẻ trước, rồi compile.
      const v = validateLatex(latex, validateOpts);
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
