// app/api/compile/route.ts
import { getConfig } from "@/lib/config";
import { compileLatex, CompileServiceError } from "@/lib/compile/client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request): Promise<Response> {
  const cfg = getConfig();
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "JSON không hợp lệ" }, { status: 400 });
  }
  const latex = (body as { latex?: unknown })?.latex;
  if (typeof latex !== "string" || latex.trim().length === 0) {
    return Response.json({ error: "Thiếu 'latex'" }, { status: 400 });
  }

  try {
    const result = await compileLatex(latex, {
      serviceUrl: cfg.compileServiceUrl,
      timeoutMs: cfg.requestTimeoutMs,
    });
    if (result.success) {
      return new Response(new Uint8Array(result.pdf), {
        status: 200,
        headers: { "content-type": "application/pdf" },
      });
    }
    return Response.json({ success: false, log: result.log }, { status: 200 });
  } catch (e) {
    if (e instanceof CompileServiceError) {
      return Response.json(
        { error: `Compile service lỗi: ${e.message}` },
        { status: 502 },
      );
    }
    return Response.json({ error: "Lỗi không xác định" }, { status: 500 });
  }
}
