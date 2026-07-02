// app/api/documents/route.ts
// CRUD tài liệu: GET (danh sách), POST (tạo mới = generate + lưu trữ).
import { getConfig } from "@/lib/config";
import { validateDocumentInput } from "@/lib/validation/input";
import { runDocument } from "@/lib/orchestrator/document";
import { buildOrchestratorDeps, deriveTitle } from "@/lib/orchestrator/deps";
import { CompileServiceError } from "@/lib/compile/client";
import { getRateLimiter, clientIp } from "@/lib/ratelimit/tokenBucket";
import { createDocument, listDocuments } from "@/lib/store/documentStore";
import { isDocumentError } from "@/lib/types/document";
import { log } from "@/lib/log";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

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

  const stream = new ReadableStream({
    async start(controller) {
      const encoder = new TextEncoder();
      const enqueue = (event: string, data: any) => {
        const jsonString = JSON.stringify(data);
        const lines = jsonString.split("\n");
        for (const line of lines) {
          controller.enqueue(
            encoder.encode(`event: ${event}\ndata: ${line}\n\n`),
          );
        }
      };

      try {
        const result = await runDocument(
          {
            description: parsed.value.description,
            docType: parsed.value.docType,
            template: parsed.value.template,
            sources: parsed.value.sources,
          },
          buildOrchestratorDeps(),
          (chunk) => {
            enqueue("chunk", { text: chunk });
          },
        );

        const failed = isDocumentError(result);
        const doc = await createDocument({
          title: deriveTitle(parsed.value.description, parsed.value.sources),
          docType: parsed.value.docType,
          template: parsed.value.template,
          description: parsed.value.description,
          latex: result.latex ?? "",
          pdfBase64: failed ? undefined : result.pdfBase64,
          log: result.log,
          error: failed ? result.error : undefined,
          attempts: result.attempts,
        });

        log.info("document.create", {
          id: doc.id,
          template: parsed.value.template,
          docType: parsed.value.docType,
          attempts: result.attempts,
          ok: !failed,
          sources: parsed.value.sources.length,
        });

        enqueue("complete", { doc });
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
}
