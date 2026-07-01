import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { POST } from "@/app/api/document/route";
import { resetRateLimiter } from "@/lib/ratelimit/tokenBucket";

function req(body: unknown, ip = "1.2.3.4"): Request {
  return new Request("http://localhost/api/document", {
    method: "POST",
    headers: { "content-type": "application/json", "x-forwarded-for": ip },
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  process.env.AI_PROVIDER = "mock";
  process.env.RATE_LIMIT_PER_MINUTE = "100";
  resetRateLimiter();
  // Compile service trả PDF.
  vi.stubGlobal("fetch", async () =>
    new Response(new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d]), {
      status: 200,
      headers: { "content-type": "application/pdf" },
    }),
  );
});
afterEach(() => vi.unstubAllGlobals());

describe("/api/document happy path", () => {
  it("trả DocumentResponse với attempts=1 và pdfBase64", async () => {
    const res = await POST(req({ description: "Bài báo test", docType: "article" }));
    expect(res.status).toBe(200);
    const data = (await res.json()) as {
      pdfBase64?: string;
      attempts?: number;
      metadata?: { template: string };
      error?: string;
    };
    expect(data.error).toBeUndefined();
    expect(data.attempts).toBe(1);
    expect(data.pdfBase64 && data.pdfBase64.length).toBeGreaterThan(0);
    expect(data.metadata?.template).toBe("article");
  });
});
