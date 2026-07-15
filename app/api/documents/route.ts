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
import { createSession } from "@/lib/clarification/session-store";
import type { LatexProvider } from "@/lib/ai/types";

/** TTL cho session hỏi-đáp E7 — 24 giờ để bắt đầu trả lời (tăng từ 5 phút ban đầu, theo yêu cầu
 *  người dùng — 5 phút không đủ cho use case "đợi vài ngày" đã xác nhận ở redesign § 6.7), nhưng
 *  KHÔNG chặn user quá thời hạn này: đây chỉ là mốc "sau bao lâu coi là hết hạn nếu resume" —
 *  session vẫn nằm trong DB/file vô thời hạn (không có cron xoá), user resume SAU mốc này chỉ
 *  nhận lỗi rõ ràng "đã hết hạn", KHÔNG mất dữ liệu đã hỏi. Xem
 *  docs/features/e7-clarification-layer/explainer.md § 6.7 cho toàn bộ lý do đổi kiến trúc (bỏ
 *  Promise-treo-trong-RAM, không còn tự generate im lặng khi hết hạn). */
const CLARIFICATION_SESSION_TTL_MS = 24 * 60 * 60 * 1000;

export type MaybeClarifyResult =
  | { needsClarification: false; req: DocumentRequest }
  | {
      needsClarification: true;
      jobId: string;
      questions: import("@/lib/clarification/policy").PendingQuestion[];
      reason: string;
      expiresAt: string;
    };

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
 * E7 (docs/features/e7-clarification-layer/explainer.md § 6.7, redesign lần 2) — chạy Request
 * Understanding TRƯỚC generate, chỉ khi bật `CLARIFICATION_ENABLED=true` VÀ request có `template`.
 *
 * KIẾN TRÚC MỚI (thay hoàn toàn cách cũ giữ SSE mở + Promise treo trong RAM — xem § 6.7 để biết
 * đầy đủ lý do): hàm này KHÔNG còn `await` chờ user trả lời. Nếu cần hỏi, nó tạo 1
 * `ClarificationSession` BỀN (Postgres/file theo `STORE_BACKEND`, xem `session-store.ts`) rồi trả
 * về NGAY `{ needsClarification: true, ... }` — route (caller) tự quyết định đóng SSE stream tại
 * đó, KHÔNG tiếp tục generate. User có thể trả lời bất cứ lúc nào sau đó (5 phút hay 5 ngày) qua
 * route mới `POST /api/documents/clarify/[jobId]/resume`, route đó tự mở 1 SSE stream HOÀN TOÀN
 * MỚI để generate — không có gì "tiếp tục" từ request cũ.
 */
async function maybeClarify(
  req: DocumentRequest,
  provider: LatexProvider,
  ownerId: string,
  enqueue: (event: string, data: unknown) => void,
  requestId: string,
): Promise<MaybeClarifyResult> {
  const cfg = getConfig();
  if (!cfg.clarificationEnabled || !req.template) {
    return { needsClarification: false, req };
  }

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
      requestId,
      template: req.template,
      message: e instanceof Error ? e.message : String(e),
    });
    return { needsClarification: false, req };
  }

  if (result.decision.action === "generate") {
    log.info("clarification.understood", {
      requestId,
      template: req.template,
      recommendedAction: "generate",
      questionCount: 0,
      ambiguity: result.plan.ambiguity,
      confidence: result.plan.confidence,
    });
    return { needsClarification: false, req };
  }

  if (result.decision.questions.length === 0) {
    log.info("clarification.understood", {
      requestId,
      template: req.template,
      recommendedAction: "clarify",
      questionCount: 0,
      ambiguity: result.plan.ambiguity,
      confidence: result.plan.confidence,
    });
    return { needsClarification: false, req };
  }

  const session = await createSession({
    ownerId,
    description: req.description,
    docType: req.docType,
    template: req.template,
    inputFormat: req.inputFormat,
    markdown: req.markdown,
    questions: result.decision.questions,
    expiresAt: new Date(Date.now() + CLARIFICATION_SESSION_TTL_MS).toISOString(),
  });

  log.info("clarification.understood", {
    requestId,
    template: req.template,
    recommendedAction: result.decision.action,
    questionCount: result.decision.questions.length,
    ambiguity: result.plan.ambiguity,
    confidence: result.plan.confidence,
    jobId: session.id,
  });

  return {
    needsClarification: true,
    jobId: session.id,
    questions: session.questions,
    reason: result.plan.intent,
    expiresAt: session.expiresAt,
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
  // BE-5.3.1: 1 requestId cho toàn bộ request này, gắn vào mọi dòng log phát sinh (orchestrator,
  // clarification, document.create) — cho phép trace 1 request cụ thể qua nhiều dòng log rời rạc.
  const requestId = crypto.randomUUID();

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
          const deps = buildOrchestratorDeps(requestId);
          const clarifyResult = await maybeClarify(
            {
              description: parsed.value.description,
              docType: parsed.value.docType,
              template: parsed.value.template,
              sources: parsed.value.sources,
              inputFormat: parsed.value.inputFormat,
              markdown: parsed.value.markdown,
            },
            deps.provider,
            userId,
            enqueue,
            requestId,
          );

          if (clarifyResult.needsClarification) {
            // ĐÓNG stream NGAY — KHÔNG giữ mở chờ user trả lời (kiến trúc mới, xem § 6.7). User
            // resume qua POST /api/documents/clarify/[jobId]/resume, route đó tự mở SSE MỚI.
            enqueue("awaiting_user_input", {
              jobId: clarifyResult.jobId,
              questions: clarifyResult.questions,
              reason: clarifyResult.reason,
              expiresAt: clarifyResult.expiresAt,
            });
            controller.close();
            return;
          }

          const result = await runByFormat(
            clarifyResult.req,
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
            requestId,
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
        buildOrchestratorDeps(requestId),
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
        requestId,
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
