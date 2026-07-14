// app/api/documents/route.ts
// CRUD tài liệu: GET (danh sách), POST (tạo mới = generate + lưu trữ).
import { getConfig } from "@/lib/config";
import { validateDocumentInput } from "@/lib/validation/input";
import { runDocument, runDocumentFromMarkdown } from "@/lib/orchestrator/document";
import { buildOrchestratorDeps, deriveTitle } from "@/lib/orchestrator/deps";
import { CompileServiceError } from "@/lib/compile/client";
import { getRateLimiter, clientIp } from "@/lib/ratelimit/tokenBucket";
import { createDocument, listDocuments } from "@/lib/store/documentStore";
import { getCurrentUserId } from "@/lib/auth/current-user";
import { isDocumentError, type DocumentRequest, type DocumentResult } from "@/lib/types/document";
import type { OrchestratorDeps } from "@/lib/orchestrator/document";
import { log } from "@/lib/log";
import { understandRequest } from "@/lib/clarification/understand-request";
import { createPendingSession, SessionTimeoutError, SESSION_TTL_MS } from "@/lib/clarification/session";
import type { LatexProvider } from "@/lib/ai/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Chọn orchestrator theo inputFormat: markdown → converter tất định, còn lại → generate AI. */
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

/**
 * E7 (docs/features/e7-clarification-layer/explainer.md § 6, Task 5+7) — chạy Request
 * Understanding TRƯỚC generate, chỉ khi bật `CLARIFICATION_ENABLED=true` VÀ request có `template`
 * (clarificationFields gắn với template — không áp dụng khi không chọn template).
 *
 * QUYẾT ĐỊNH THIẾT KẾ (khác với mô tả gốc "gọi TRONG runDocument" ở mục 3.6/Task 5 — xem lý do đầy
 * đủ trong explainer.md § 6.4): tách HOÀN TOÀN khỏi runDocument()/DocumentResult để không đổi
 * signature của 4 orchestrator entrypoint (10 call site hiện có, bao gồm 8 file test) — an toàn
 * hơn nhiều so với thêm 1 union case thứ 3 vào DocumentResult (rủi ro: isDocumentError() ở 2 route
 * khác sẽ coi case mới là "không lỗi" và cố lưu như document thành công).
 *
 * `enqueue` được truyền vào để gửi 2 SSE event mới (`understanding`, `awaiting_user_input`) ngay
 * trong closure của stream ĐANG MỞ — route KHÔNG mở stream thứ 2. Nếu user trả lời trước khi hết
 * TTL, trả về answers đã merge; nếu hết hạn, ném SessionTimeoutError để caller xử lý (đóng stream
 * bằng event lỗi rõ ràng thay vì treo vô hạn).
 *
 * Trả về mô tả bổ sung để nhồi vào `description` gốc trước khi generate — cách đơn giản nhất để
 * "enrich context" (mục 3.3 luồng dữ liệu) mà không cần đổi GenerateInput/DocumentRequest.
 */
async function maybeClarify(
  req: DocumentRequest,
  provider: LatexProvider,
  enqueue: (event: string, data: unknown) => void,
): Promise<DocumentRequest> {
  const cfg = getConfig();
  if (!cfg.clarificationEnabled || !req.template) return req;

  enqueue("status", { status: "understanding" });

  let result;
  try {
    result = await understandRequest(provider, {
      description: req.description,
      templateId: req.template,
    });
  } catch (e) {
    // Lỗi hạ tầng AI (vd. generateObject thất bại) KHÔNG được chặn user — coi như "generate" với
    // description gốc, log lại để biết tần suất fallback này xảy ra bao nhiêu.
    log.warn("clarification.understand_failed", {
      template: req.template,
      message: e instanceof Error ? e.message : String(e),
    });
    return req;
  }

  if (result.decision.action === "generate" || result.decision.questions.length === 0) {
    return req;
  }

  const { jobId, wait } = createPendingSession(result.decision.questions);
  enqueue("awaiting_user_input", {
    jobId,
    questions: result.decision.questions,
    reason: result.plan.intent,
    // Timestamp TUYỆT ĐỐI (không phải "còn bao nhiêu ms") — tránh sai lệch do độ trễ network giữa
    // lúc server tạo session và lúc client nhận được event này. Client tự tính "còn lại" bằng
    // Date.now() so với giá trị này, không cần đồng bộ đồng hồ tuyệt đối (đủ chính xác cho UX
    // đếm ngược, sai lệch vài giây không quan trọng ở đây).
    expiresAt: new Date(Date.now() + SESSION_TTL_MS).toISOString(),
  });

  let answers: Record<string, string>;
  try {
    answers = await wait;
  } catch (e) {
    if (e instanceof SessionTimeoutError) {
      // Hết TTL không có trả lời — KHÔNG chặn generate vô thời hạn: tiếp tục với description gốc
      // (giống case field optional bị skip), thay vì để SSE treo mãi.
      log.info("clarification.timeout", { template: req.template });
      return req;
    }
    throw e;
  }

  const enrichment = Object.entries(answers)
    .map(([field, value]) => `${field}: ${value}`)
    .join("\n");
  return {
    ...req,
    description: `${req.description}\n\n[Thông tin bổ sung từ người dùng]\n${enrichment}`,
  };
}

/** Tiêu đề: ưu tiên mô tả; với Markdown lấy dòng đầu (bỏ ký tự '#'). */
function titleFor(value: {
  description: string;
  markdown?: string;
  sources: { name: string; content: string }[];
}): string {
  if (value.description.trim().length > 0 || !value.markdown) {
    return deriveTitle(value.description, value.sources);
  }
  const firstLine = value.markdown
    .split("\n")
    .map((l) => l.replace(/^#+\s*/, "").trim())
    .find((l) => l.length > 0);
  return deriveTitle(firstLine ?? "", value.sources);
}

export async function GET(): Promise<Response> {
  const userId = await getCurrentUserId();
  if (!userId) {
    return Response.json({ error: "Chưa đăng nhập" }, { status: 401 });
  }
  const docs = await listDocuments(userId);
  return Response.json({ documents: docs }, { status: 200 });
}

export async function POST(request: Request): Promise<Response> {
  const cfg = getConfig();

  const userId = await getCurrentUserId();
  if (!userId) {
    return Response.json({ error: "Chưa đăng nhập" }, { status: 401 });
  }

  // Rate limit theo IP (tạo mới gọi AI).
  const limiter = getRateLimiter(cfg.rateLimitPerMinute);
  const ip = clientIp(request.headers);
  if (!limiter.take(ip)) {
    return Response.json(
      { error: "Vượt giới hạn tần suất. Vui lòng thử lại sau." },
      { status: 429 },
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "JSON không hợp lệ" }, { status: 400 });
  }

  const parsed = validateDocumentInput(body, {
    maxInputChars: cfg.maxInputChars,
    maxSourceFiles: cfg.maxSourceFiles,
    maxSourceChars: cfg.maxSourceChars,
  });
  if (!parsed.ok) {
    return Response.json({ error: parsed.error }, { status: 400 });
  }

  // Cổng tính năng: chặn nhánh Markdown khi bị tắt qua cấu hình.
  if (parsed.value.inputFormat === "markdown" && !cfg.markdownInputEnabled) {
    return Response.json(
      { error: "Chế độ soạn Markdown đang tắt (MARKDOWN_INPUT_ENABLED=false)." },
      { status: 400 },
    );
  }

  const wantsStream = request.headers.get("accept") === "text/event-stream";
  if (wantsStream) {
    const stream = new ReadableStream({
      async start(controller) {
        const encoder = new TextEncoder();
        const enqueue = (event: string, data: unknown) => {
          const jsonString = JSON.stringify(data);
          const lines = jsonString.split("\n");
          for (const line of lines) {
            controller.enqueue(
              encoder.encode(`event: ${event}\ndata: ${line}\n\n`),
            );
          }
        };

        try {
          const deps = buildOrchestratorDeps();
          const clarifiedReq = await maybeClarify(
            {
              description: parsed.value.description,
              docType: parsed.value.docType,
              template: parsed.value.template,
              sources: parsed.value.sources,
              inputFormat: parsed.value.inputFormat,
              markdown: parsed.value.markdown,
            },
            deps.provider,
            enqueue,
          );

          const result = await runByFormat(
            clarifiedReq,
            deps,
            (chunk) => {
              enqueue("chunk", { text: chunk });
            },
            () => {
              enqueue("status", { status: "compiling" });
            }
          );

          const failed = isDocumentError(result);
          const doc = await createDocument({
            title: titleFor(parsed.value),
            ownerId: userId,
            docType: parsed.value.docType,
            template: parsed.value.template,
            description: parsed.value.description,
            latex: result.latex ?? "",
            pdfBase64: failed ? undefined : result.pdfBase64,
            log: result.log,
            error: failed ? result.error : undefined,
            attempts: result.attempts,
            inputFormat: parsed.value.inputFormat,
            sourceMarkdown: parsed.value.markdown,
          });

          log.info("document.create", {
            id: doc.id,
            template: parsed.value.template,
            docType: parsed.value.docType,
            attempts: result.attempts,
            ok: !failed,
            sources: parsed.value.sources.length,
            inputFormat: parsed.value.inputFormat,
          });

          enqueue("complete", { doc, warnings: result.warnings ?? [] });
          controller.close();
        } catch (e) {
          if (e instanceof CompileServiceError) {
            enqueue("error", {
              message: `Compile service không phản hồi: ${e.message}`,
            });
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
  } else {
    // E7 (Request Understanding + clarify) KHÔNG áp dụng ở nhánh non-SSE này — clarify cần chờ
    // user trả lời qua MỘT request HTTP khác (PATCH .../clarify/[jobId]), không thể xảy ra trong
    // một request/response đồng bộ, không streaming. Nhánh này luôn generate ngay dù
    // CLARIFICATION_ENABLED=true, giống hành vi trước khi E7 tồn tại.
    try {
      const result = await runByFormat(
        {
          description: parsed.value.description,
          docType: parsed.value.docType,
          template: parsed.value.template,
          sources: parsed.value.sources,
          inputFormat: parsed.value.inputFormat,
          markdown: parsed.value.markdown,
        },
        buildOrchestratorDeps(),
      );

      const failed = isDocumentError(result);
      const doc = await createDocument({
        title: titleFor(parsed.value),
        ownerId: userId,
        docType: parsed.value.docType,
        template: parsed.value.template,
        description: parsed.value.description,
        latex: result.latex ?? "",
        pdfBase64: failed ? undefined : result.pdfBase64,
        log: result.log,
        error: failed ? result.error : undefined,
        attempts: result.attempts,
        inputFormat: parsed.value.inputFormat,
        sourceMarkdown: parsed.value.markdown,
      });

      log.info("document.create", {
        id: doc.id,
        template: parsed.value.template,
        docType: parsed.value.docType,
        attempts: result.attempts,
        ok: !failed,
        sources: parsed.value.sources.length,
        inputFormat: parsed.value.inputFormat,
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
}
