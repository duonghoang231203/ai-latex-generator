// app/api/documents/clarify/[jobId]/resume/route.ts
// E7 · Clarification Layer — endpoint resume (redesign lần 2, docs/features/e7-clarification-layer
// /explainer.md § 6.7). Nhận câu trả lời cho MỘT session đã lưu bền (Postgres/file, xem
// lib/clarification/session-store.ts), rồi bắt đầu MỘT LUỒNG GENERATE HOÀN TOÀN MỚI qua SSE MỚI —
// KHÔNG "tiếp tục" bất kỳ kết nối HTTP cũ nào (khác kiến trúc cũ giữ SSE mở + Promise treo trong
// RAM, đã bỏ — không còn giới hạn 5 phút cho việc TRẢ LỜI, chỉ còn giới hạn hợp lệ của session).
import { getCurrentUserId } from "@/lib/auth/current-user";
import { getSession, answerSession } from "@/lib/clarification/session-store";
import { runDocument, runDocumentFromMarkdown } from "@/lib/orchestrator/document";
import { buildOrchestratorDeps, deriveTitle } from "@/lib/orchestrator/deps";
import { CompileServiceError } from "@/lib/compile/client";
import { createDocument } from "@/lib/store/documentStore";
import { isDocumentError, type DocumentRequest, type DocumentResult } from "@/lib/types/document";
import type { OrchestratorDeps } from "@/lib/orchestrator/document";
import { log } from "@/lib/log";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface RouteParams {
  params: Promise<{ jobId: string }>;
}

/** Trùng logic với app/api/documents/route.ts — trùng lặp CÓ CHỦ Ý (2 route nhỏ, tách factor ra
 *  chung sẽ tăng phụ thuộc chéo không cần thiết cho lợi ích nhỏ; xem ghi chú tương tự nếu factor
 *  sau này khi có route thứ 3 cần). */
function runByFormat(
  req: DocumentRequest,
  deps: OrchestratorDeps,
  onChunk?: (text: string) => void,
  onCompileStart?: () => void,
): Promise<DocumentResult> {
  if (req.inputFormat === "markdown") {
    return runDocumentFromMarkdown(req, deps, onChunk, onCompileStart);
  }
  return runDocument(req, deps, onChunk, onCompileStart);
}

function enrichDescription(description: string, answers: Record<string, string>): string {
  const enrichment = Object.entries(answers)
    .map(([field, value]) => `${field}: ${value}`)
    .join("\n");
  if (!enrichment) return description;
  return `${description}\n\n[Thông tin bổ sung từ người dùng]\n${enrichment}`;
}

export async function POST(request: Request, { params }: RouteParams): Promise<Response> {
  const userId = await getCurrentUserId();
  if (!userId) {
    return Response.json({ error: "Chưa đăng nhập" }, { status: 401 });
  }
  // BE-5.3.1: requestId riêng cho luồng resume này — KHÔNG dùng lại requestId của request tạo
  // session ban đầu (đã đóng từ lâu, có thể không còn trace log cũ), vì đây là 1 request HTTP
  // hoàn toàn mới, độc lập (đúng kiến trúc § 6.7).
  const requestId = crypto.randomUUID();

  const { jobId } = await params;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "JSON không hợp lệ" }, { status: 400 });
  }

  const answersRaw = (body as { answers?: unknown })?.answers;
  if (typeof answersRaw !== "object" || answersRaw === null || Array.isArray(answersRaw)) {
    return Response.json(
      { error: "Thiếu hoặc sai định dạng 'answers' (cần là object { fieldId: string })." },
      { status: 400 },
    );
  }
  const answers: Record<string, string> = {};
  for (const [key, value] of Object.entries(answersRaw as Record<string, unknown>)) {
    answers[key] = String(value);
  }

  // Đọc session TRƯỚC (không đổi trạng thái) để lấy description/template — nếu hết hạn,
  // getSession() đã tự áp lazy-expiry và trả status='expired', biết ngay không cần answerSession().
  const session = await getSession(jobId, userId);
  if (!session) {
    return Response.json(
      { error: "Không tìm thấy phiên hỏi đáp (sai id hoặc không thuộc quyền của bạn)." },
      { status: 404 },
    );
  }
  if (session.status === "expired") {
    return Response.json(
      {
        error:
          "Phiên hỏi đáp này đã hết hạn. Vui lòng gửi lại yêu cầu ban đầu (mô tả tài liệu) để " +
          "tạo phiên mới.",
      },
      { status: 410 }, // 410 Gone — đúng ngữ nghĩa hơn 404 (tồn tại nhưng không còn dùng được).
    );
  }
  if (session.status === "answered") {
    return Response.json(
      { error: "Phiên hỏi đáp này đã được trả lời trước đó." },
      { status: 409 },
    );
  }

  // Đánh dấu 'answered' NGAY (trước khi generate) — chặn 2 request PATCH đồng thời cùng resume 1
  // session (idempotency tối thiểu: request thứ 2 sẽ nhận 409 ở answerSession() trả null).
  const answered = await answerSession(jobId, userId);
  if (!answered) {
    return Response.json(
      { error: "Phiên hỏi đáp không còn ở trạng thái chờ (đã hết hạn hoặc đã trả lời)." },
      { status: 409 },
    );
  }

  const req: DocumentRequest = {
    description: enrichDescription(session.description, answers),
    docType: session.docType,
    template: session.template,
    sources: [],
    inputFormat: session.inputFormat,
    markdown: session.markdown,
  };

  const wantsStream = request.headers.get("accept") === "text/event-stream";

  // Luồng SSE MỚI HOÀN TOÀN — giống cấu trúc nhánh SSE của app/api/documents/route.ts, KHÔNG tái
  // dùng bất kỳ kết nối/controller nào từ request tạo session ban đầu (đã đóng từ lâu).
  if (wantsStream) {
    const stream = new ReadableStream({
      async start(controller) {
        const encoder = new TextEncoder();
        const enqueue = (event: string, data: unknown) => {
          const jsonString = JSON.stringify(data);
          const lines = jsonString.split("\n");
          for (const line of lines) {
            controller.enqueue(encoder.encode(`event: ${event}\ndata: ${line}\n\n`));
          }
        };

        try {
          const deps = buildOrchestratorDeps(requestId);
          const result = await runByFormat(
            req,
            deps,
            (chunk) => enqueue("chunk", { text: chunk }),
            () => enqueue("status", { status: "compiling" }),
          );

          const failed = isDocumentError(result);
          const doc = await createDocument({
            title: deriveTitle(session.description, []),
            ownerId: userId,
            docType: session.docType,
            template: session.template,
            description: req.description,
            latex: result.latex ?? "",
            pdfBase64: failed ? undefined : result.pdfBase64,
            log: result.log,
            error: failed ? result.error : undefined,
            attempts: result.attempts,
            inputFormat: session.inputFormat,
            sourceMarkdown: session.markdown,
          });

          log.info("document.create", {
            requestId,
            id: doc.id,
            template: session.template,
            docType: session.docType,
            attempts: result.attempts,
            ok: !failed,
            sources: 0,
            inputFormat: session.inputFormat ?? "natural",
            fromClarificationSession: jobId,
          });

          enqueue("complete", { doc, warnings: result.warnings ?? [] });
          controller.close();
        } catch (e) {
          if (e instanceof CompileServiceError) {
            enqueue("error", { message: `Compile service không phản hồi: ${e.message}` });
          } else {
            const msg = e instanceof Error ? e.message : "Lỗi không xác định";
            enqueue("error", { message: `Lỗi xử lý: ${msg}` });
          }
          controller.close();
        }
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      },
    });
  }

  // Non-SSE — theo đúng cấu trúc nhánh else của route.ts chính.
  try {
    const result = await runByFormat(req, buildOrchestratorDeps(requestId));
    const failed = isDocumentError(result);
    const doc = await createDocument({
      title: deriveTitle(session.description, []),
      ownerId: userId,
      docType: session.docType,
      template: session.template,
      description: req.description,
      latex: result.latex ?? "",
      pdfBase64: failed ? undefined : result.pdfBase64,
      log: result.log,
      error: failed ? result.error : undefined,
      attempts: result.attempts,
      inputFormat: session.inputFormat,
      sourceMarkdown: session.markdown,
    });

    log.info("document.create", {
      requestId,
      id: doc.id,
      template: session.template,
      docType: session.docType,
      attempts: result.attempts,
      ok: !failed,
      sources: 0,
      inputFormat: session.inputFormat ?? "natural",
      fromClarificationSession: jobId,
    });
    return Response.json({ ...doc, warnings: result.warnings ?? [] }, { status: 201 });
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
