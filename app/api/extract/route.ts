// app/api/extract/route.ts
// Nhận 1 file (multipart/form-data, field "file") → trích xuất văn bản (text/pdf/docx/ảnh-OCR).
// Trả { name, content, kind, chars } để client đưa vào `sources` của /api/documents.
import { getConfig } from "@/lib/config";
import { extractText } from "@/lib/extract/extract";
import { realHandlers } from "@/lib/extract/handlers";
import { getRateLimiter, clientIp } from "@/lib/ratelimit/tokenBucket";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request): Promise<Response> {
  const cfg = getConfig();

  // Rate limit theo IP: trích xuất (đặc biệt OCR) tốn tài nguyên.
  const limiter = getRateLimiter(cfg.rateLimitPerMinute);
  const ip = clientIp(request.headers);
  if (!limiter.take(ip)) {
    return Response.json(
      { error: "Vượt giới hạn tần suất. Vui lòng thử lại sau." },
      { status: 429 },
    );
  }

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return Response.json({ error: "Yêu cầu không phải multipart/form-data hợp lệ" }, { status: 400 });
  }

  const file = form.get("file");
  if (!(file instanceof Blob)) {
    return Response.json({ error: "Thiếu trường 'file'" }, { status: 400 });
  }

  const name = (file as File).name || "upload";
  const mimeType = file.type || "";
  const bytes = new Uint8Array(await file.arrayBuffer());

  const result = await extractText(
    { name, mimeType, bytes },
    {
      maxUploadBytes: cfg.maxUploadBytes,
      ocrEnabled: cfg.ocrEnabled,
      ocrLangs: cfg.ocrLangs,
    },
    realHandlers,
  );

  if (!result.ok) {
    return Response.json({ error: result.error }, { status: 422 });
  }

  // Cắt bớt nếu vượt giới hạn nội dung 1 nguồn (bảo vệ prompt/đầu vào).
  let content = result.content;
  let truncated = false;
  if (content.length > cfg.maxSourceChars) {
    content = content.slice(0, cfg.maxSourceChars);
    truncated = true;
  }

  return Response.json(
    { name: result.name, kind: result.kind, content, chars: content.length, truncated },
    { status: 200 },
  );
}
