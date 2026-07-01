// app/api/document/route.ts
import { getConfig } from "@/lib/config";
import { getProvider } from "@/lib/ai/factory";
import { validateDocumentInput } from "@/lib/validation/input";
import { runDocument } from "@/lib/orchestrator/document";
import { compileLatex, CompileServiceError } from "@/lib/compile/client";
import { getRateLimiter, clientIp } from "@/lib/ratelimit/tokenBucket";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request): Promise<Response> {
  const cfg = getConfig();

  // Rate limit theo IP (10/phút mặc định).
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
    const provider = getProvider();
    const result = await runDocument(
      {
        description: parsed.value.description,
        docType: parsed.value.docType,
        template: parsed.value.template,
        sources: parsed.value.sources,
      },
      {
        provider,
        maxAttempts: cfg.maxRepairAttempts,
        compile: (latex) =>
          compileLatex(latex, {
            serviceUrl: cfg.compileServiceUrl,
            timeoutMs: cfg.requestTimeoutMs,
          }),
      },
    );
    // Thành công hoặc thất bại nghiệp vụ đều trả 200 (phân biệt bằng trường 'error').
    return Response.json(result, { status: 200 });
  } catch (e) {
    if (e instanceof CompileServiceError) {
      return Response.json(
        { error: `Compile service không phản hồi: ${e.message}` },
        { status: 502 },
      );
    }
    // Lỗi provider AI hoặc khác.
    const msg = e instanceof Error ? e.message : "Lỗi không xác định";
    return Response.json({ error: `Lỗi xử lý: ${msg}` }, { status: 502 });
  }
}
