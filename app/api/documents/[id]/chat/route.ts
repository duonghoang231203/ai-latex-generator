// app/api/documents/[id]/chat/route.ts
// Chat-edit: người dùng gửi chỉ thị → AI sửa LaTeX hiện có → recompile → lưu + trả tài liệu.
import { getConfig } from "@/lib/config";
import { runEdit } from "@/lib/orchestrator/document";
import { buildOrchestratorDeps } from "@/lib/orchestrator/deps";
import { CompileServiceError } from "@/lib/compile/client";
import { getRateLimiter, clientIp } from "@/lib/ratelimit/tokenBucket";
import { getDocument, newMessage, updateDocument } from "@/lib/store/documentStore";
import { getCurrentUserId } from "@/lib/auth/current-user";
import { isDocumentError, type ChatMessage } from "@/lib/types/document";
import { log } from "@/lib/log";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

const MAX_INSTRUCTION_CHARS = 4000;

export async function POST(request: Request, ctx: Ctx): Promise<Response> {
  const { id } = await ctx.params;
  const cfg = getConfig();
  // BE-5.3.1: requestId cho toàn bộ lượt chat-edit này.
  const requestId = crypto.randomUUID();

  const userId = await getCurrentUserId();
  if (!userId) {
    return Response.json({ error: "Chưa đăng nhập" }, { status: 401 });
  }

  // Rate limit theo IP (mỗi lượt chat gọi AI).
  const limiter = getRateLimiter(cfg.rateLimitPerMinute);
  const ip = clientIp(request.headers);
  if (!limiter.take(ip)) {
    return Response.json(
      { error: "Vượt giới hạn tần suất. Vui lòng thử lại sau." },
      { status: 429 },
    );
  }

  const doc = await getDocument(id, userId);
  if (!doc) {
    return Response.json({ error: "Không tìm thấy tài liệu" }, { status: 404 });
  }
  if (!doc.latex || doc.latex.trim().length === 0) {
    return Response.json(
      { error: "Tài liệu chưa có mã LaTeX để chỉnh sửa." },
      { status: 400 },
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "JSON không hợp lệ" }, { status: 400 });
  }

  const instruction = (body as { instruction?: unknown })?.instruction;
  if (typeof instruction !== "string" || instruction.trim().length === 0) {
    return Response.json({ error: "Thiếu 'instruction'" }, { status: 400 });
  }
  if (instruction.length > MAX_INSTRUCTION_CHARS) {
    return Response.json(
      { error: `Yêu cầu quá dài (tối đa ${MAX_INSTRUCTION_CHARS} ký tự)` },
      { status: 400 },
    );
  }

  const userMsg: ChatMessage = newMessage("user", instruction.trim());

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
          const result = await runEdit(
            {
              currentLatex: doc.latex,
              instruction: instruction.trim(),
              docType: doc.docType,
              template: doc.template,
            },
            buildOrchestratorDeps(requestId),
            (chunk) => {
              enqueue("chunk", { text: chunk });
            },
            () => {
              enqueue("status", { status: "compiling" });
            }
          );

          const failed = isDocumentError(result);
          const assistantContent = failed
            ? `⚠️ Chưa áp dụng được thay đổi: ${result.error}`
            : `✅ Đã cập nhật tài liệu (số lần thử: ${result.attempts}).`;
          const assistantMsg = newMessage("assistant", assistantContent);

          const updated = await updateDocument(id, {
            // Khi lỗi: giữ nguyên latex cũ (không phá tài liệu đang có).
            latex: failed ? doc.latex : result.latex ?? doc.latex,
            pdfBase64: failed ? doc.pdfBase64 : result.pdfBase64,
            log: result.log,
            error: failed ? result.error : undefined,
            attempts: result.attempts,
            messages: [...doc.messages, userMsg, assistantMsg],
          }, userId);

          if (!updated) {
            enqueue("error", { message: "Không tìm thấy tài liệu" });
            controller.close();
            return;
          }
          log.info("document.chat_edit", {
            requestId,
            id,
            template: doc.template,
            attempts: result.attempts,
            ok: !failed,
          });
          enqueue("complete", { doc: updated });
          controller.close();
        } catch (e) {
          // Lỗi hạ tầng: vẫn lưu lượt user + một message lỗi để không mất lịch sử.
          const msg = e instanceof Error ? e.message : "Lỗi không xác định";
          const errText =
            e instanceof CompileServiceError
              ? `Compile service không phản hồi: ${e.message}`
              : `Lỗi xử lý: ${msg}`;
          await updateDocument(id, {
            messages: [...doc.messages, userMsg, newMessage("assistant", `⚠️ ${errText}`)],
          }, userId);
          enqueue("error", { message: errText });
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
    try {
      const result = await runEdit(
        {
          currentLatex: doc.latex,
          instruction: instruction.trim(),
          docType: doc.docType,
          template: doc.template,
        },
        buildOrchestratorDeps(requestId),
      );

      const failed = isDocumentError(result);
      const assistantContent = failed
        ? `⚠️ Chưa áp dụng được thay đổi: ${result.error}`
        : `✅ Đã cập nhật tài liệu (số lần thử: ${result.attempts}).`;
      const assistantMsg = newMessage("assistant", assistantContent);

      const updated = await updateDocument(id, {
        // Khi lỗi: giữ nguyên latex cũ (không phá tài liệu đang có).
        latex: failed ? doc.latex : result.latex ?? doc.latex,
        pdfBase64: failed ? doc.pdfBase64 : result.pdfBase64,
        log: result.log,
        error: failed ? result.error : undefined,
        attempts: result.attempts,
        messages: [...doc.messages, userMsg, assistantMsg],
      }, userId);

      if (!updated) {
        return Response.json({ error: "Không tìm thấy tài liệu" }, { status: 404 });
      }
      log.info("document.chat_edit", {
        requestId,
        id,
        template: doc.template,
        attempts: result.attempts,
        ok: !failed,
      });
      return Response.json(updated, { status: 200 });
    } catch (e) {
      // Lỗi hạ tầng: vẫn lưu lượt user + một message lỗi để không mất lịch sử.
      const msg = e instanceof Error ? e.message : "Lỗi không xác định";
      const errText =
        e instanceof CompileServiceError
          ? `Compile service không phản hồi: ${e.message}`
          : `Lỗi xử lý: ${msg}`;
      await updateDocument(id, {
        messages: [...doc.messages, userMsg, newMessage("assistant", `⚠️ ${errText}`)],
      }, userId);
      return Response.json({ error: errText }, { status: 502 });
    }
  }
}
