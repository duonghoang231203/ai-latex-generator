// @vitest-environment node
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { POST } from "@/app/api/extract/route";
import { resetRateLimiter } from "@/lib/ratelimit/tokenBucket";

function post(form: FormData, ip = "8.8.8.8"): Request {
  return new Request("http://localhost/api/extract", {
    method: "POST",
    headers: { "x-forwarded-for": ip },
    body: form,
  });
}

beforeEach(() => {
  process.env.RATE_LIMIT_PER_MINUTE = "1000";
  process.env.OCR_ENABLED = "true";
  resetRateLimiter();
});
afterEach(() => {
  delete process.env.RATE_LIMIT_PER_MINUTE;
  delete process.env.OCR_ENABLED;
  vi.unstubAllGlobals();
});

describe("/api/extract", () => {
  it("text file: trả content đã giải mã UTF-8", async () => {
    const form = new FormData();
    form.append("file", new File(["Xin chào thế giới"], "note.md", { type: "text/markdown" }));
    const res = await POST(post(form));
    expect(res.status).toBe(200);
    const data = (await res.json()) as { content: string; kind: string; chars: number };
    expect(data.kind).toBe("text");
    expect(data.content).toBe("Xin chào thế giới");
    expect(data.chars).toBeGreaterThan(0);
  });

  it("thiếu file → 400", async () => {
    const res = await POST(post(new FormData()));
    expect(res.status).toBe(400);
  });

  it("định dạng không hỗ trợ (.zip) → 422", async () => {
    const form = new FormData();
    form.append("file", new File(["x"], "a.zip", { type: "application/zip" }));
    const res = await POST(post(form));
    expect(res.status).toBe(422);
  });

  it("ảnh khi OCR tắt → 422 với thông báo rõ", async () => {
    process.env.OCR_ENABLED = "false";
    const form = new FormData();
    form.append("file", new File([new Uint8Array([1, 2, 3])], "a.png", { type: "image/png" }));
    const res = await POST(post(form));
    expect(res.status).toBe(422);
    const data = (await res.json()) as { error: string };
    expect(data.error).toContain("OCR");
  });

  it("vượt rate limit → 429", async () => {
    process.env.RATE_LIMIT_PER_MINUTE = "1";
    resetRateLimiter();
    const mk = () => {
      const form = new FormData();
      form.append("file", new File(["hi"], "n.txt", { type: "text/plain" }));
      return post(form, "9.9.9.1");
    };
    expect((await POST(mk())).status).toBe(200);
    expect((await POST(mk())).status).toBe(429);
  });
});
