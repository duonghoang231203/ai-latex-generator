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

  try {
    const result = await runDocument(
      {
        description: parsed.value.description,
        docType: parsed.value.docType,
        template: parsed.value.template,
        sources: parsed.value.sources,
      },
      buildOrchestratorDeps(),
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

    // Trả tài liệu đã lưu (kể cả thất bại nghiệp vụ) — client điều hướng tới workspace.
    return Response.json(doc, { status: 201 });
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
