// app/api/generate/route.ts
import { getProvider } from "@/lib/ai/factory";
import { getConfig } from "@/lib/config";
import { validateDocumentInput } from "@/lib/validation/input";

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
    const { latex } = await provider.generate({
      description: parsed.value.description,
      docType: parsed.value.docType,
      template: parsed.value.template,
      sources: parsed.value.sources,
    });
    return Response.json({ latex });
  } catch (e) {
    // Không lộ chi tiết secret; thông điệp gọn.
    const msg = e instanceof Error ? e.message : "Lỗi sinh LaTeX";
    return Response.json({ error: `Lỗi nhà cung cấp AI: ${msg}` }, { status: 502 });
  }
}
