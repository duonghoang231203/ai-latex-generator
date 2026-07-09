// app/api/documents/route.ts
// CRUD tài liệu: GET (danh sách), POST (tạo mới = generate + lưu trữ).
import { getConfig } from "@/lib/config";
import { validateDocumentInput } from "@/lib/validation/input";
import { runDocument, runDocumentFromMarkdown } from "@/lib/orchestrator/document";
import { buildOrchestratorDeps, deriveTitle } from "@/lib/orchestrator/deps";
import { CompileServiceError } from "@/lib/compile/client";
import { getRateLimiter, clientIp } from "@/lib/ratelimit/tokenBucket";
import { createDocument, listDocuments } from "@/lib/store/documentStore";
import { isDocumentError, type DocumentRequest, type DocumentResult } from "@/lib/types/document";
import type { OrchestratorDeps } from "@/lib/orchestrator/document";
import { log } from "@/lib/log";

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
  const docs = await listDocuments();
  return Response.json({ documents: docs }, { status: 200 });
}

export async function POST(request: Request): Promise<Response> {
  const cfg = getConfig();

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
