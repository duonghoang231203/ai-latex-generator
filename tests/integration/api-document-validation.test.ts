import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { POST } from "@/app/api/document/route";
import { resetRateLimiter } from "@/lib/ratelimit/tokenBucket";

function req(body: unknown, ip = "9.9.9.9"): Request {
  return new Request("http://localhost/api/document", {
    method: "POST",
    headers: { "content-type": "application/json", "x-forwarded-for": ip },
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  process.env.AI_PROVIDER = "mock";
  process.env.RATE_LIMIT_PER_MINUTE = "100";
  process.env.MAX_INPUT_CHARS = "5000";
  resetRateLimiter();
  vi.stubGlobal("fetch", async () =>
    new Response(new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d]), {
      status: 200,
      headers: { "content-type": "application/pdf" },
    }),
  );
});
afterEach(() => vi.unstubAllGlobals());

describe("/api/document validation & errors", () => {
  it("mô tả rỗng → 400", async () => {
    const res = await POST(req({ description: "   ", docType: "article" }));
    expect(res.status).toBe(400);
  });

  it("mô tả quá dài → 400", async () => {
    const res = await POST(
      req({ description: "x".repeat(5001), docType: "article" }),
    );
    expect(res.status).toBe(400);
  });

  it("docType sai → 400", async () => {
    const res = await POST(req({ description: "ok", docType: "slides" }));
    expect(res.status).toBe(400);
  });

  it("vượt rate limit → 429", async () => {
    process.env.RATE_LIMIT_PER_MINUTE = "2";
    resetRateLimiter();
    const ip = "5.5.5.5";
    const ok1 = await POST(req({ description: "a", docType: "article" }, ip));
    const ok2 = await POST(req({ description: "b", docType: "article" }, ip));
    const blocked = await POST(req({ description: "c", docType: "article" }, ip));
    expect(ok1.status).toBe(200);
    expect(ok2.status).toBe(200);
    expect(blocked.status).toBe(429);
  });

  it("provider không hợp lệ → 502", async () => {
    process.env.AI_PROVIDER = "banana";
    const res = await POST(req({ description: "ok", docType: "article" }));
    expect(res.status).toBe(502);
  });
});
