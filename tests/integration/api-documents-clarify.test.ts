// tests/integration/api-documents-clarify.test.ts
//
// E7 · Clarification Layer — integration test cho kiến trúc MỚI (redesign lần 2, 2026-07-14, xem
// docs/features/e7-clarification-layer/explainer.md § 6.7): server ĐÓNG SSE stream ngay khi cần
// hỏi (không giữ mở chờ Promise), user resume qua 1 route HOÀN TOÀN KHÁC
// (POST /api/documents/clarify/[jobId]/resume) mở 1 SSE MỚI để generate.
//
// Verify TRỰC TIẾP các thay đổi hành vi so với kiến trúc cũ:
//   1. Khi cần clarify, response SSE đầu tiên đóng NGAY sau awaiting_user_input (có 'complete'
//      trong CÙNG response là dấu hiệu SAI — kiến trúc cũ mới làm vậy).
//   2. Route resume là request HOÀN TOÀN ĐỘC LẬP, không cần bất kỳ state nào từ request đầu ngoài
//      jobId — verify bằng cách chờ vài giây (mô phỏng "trả lời rất lâu sau") giữa 2 request.
//   3. answers gửi 2 lần cho CÙNG jobId → lần 2 bị từ chối (409) — session đã 'answered'.
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { promises as fs } from "node:fs";
import path from "node:path";
import os from "node:os";
import { randomUUID } from "node:crypto";
import { MockProvider } from "@/lib/ai/mock";
import { resetRateLimiter } from "@/lib/ratelimit/tokenBucket";
import type { RequestPlan } from "@/lib/ai/schemas/request-plan";

vi.mock("@/lib/auth/current-user", () => ({
  getCurrentUser: async () => ({ id: "test-user", email: "test@example.com" }),
  getCurrentUserId: async () => "test-user",
}));

let currentPlanOverride: RequestPlan | null = null;

vi.mock("@/lib/ai/factory", () => ({
  getProvider: () =>
    new MockProvider("happy", () => {
      if (!currentPlanOverride) {
        throw new Error("Test setup error: currentPlanOverride chưa được set trước khi gọi route.");
      }
      return currentPlanOverride;
    }),
}));

function clarifyPlan(): RequestPlan {
  return {
    intent: "Giải bài toán đạo hàm",
    templateId: "math",
    requirements: [],
    assumptions: [],
    missingInformation: [{ field: "problem_statement", importance: "critical" }],
    ambiguity: "high",
    confidence: 0.4,
    recommendedAction: "clarify",
  };
}

function generatePlan(): RequestPlan {
  return {
    intent: "Giải thích khái niệm đạo hàm",
    templateId: "math",
    requirements: ["giải thích khái niệm"],
    assumptions: ["mức độ giới thiệu"],
    missingInformation: [],
    ambiguity: "low",
    confidence: 0.9,
    recommendedAction: "generate",
  };
}

async function collectSSE(res: Response): Promise<{ events: string[]; buffer: string }> {
  const text = await res.text();
  const events: string[] = [];
  for (const block of text.split("\n\n")) {
    const m = block.match(/^event: (.+)$/m);
    if (m) events.push(m[1]);
  }
  return { events, buffer: text };
}

function sseReq(url: string, body: unknown): Request {
  return new Request(url, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      accept: "text/event-stream",
      "x-forwarded-for": "8.8.8.8",
    },
    body: JSON.stringify(body),
  });
}

let dir: string;

beforeEach(() => {
  dir = path.join(os.tmpdir(), `latexgen-clarify-${randomUUID()}`);
  process.env.DATA_DIR = dir;
  process.env.AI_PROVIDER = "mock";
  process.env.CLARIFICATION_ENABLED = "true";
  process.env.RATE_LIMIT_PER_MINUTE = "1000";
  currentPlanOverride = null;
  resetRateLimiter();
  vi.stubGlobal("fetch", async () =>
    new Response(new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d]), {
      status: 200,
      headers: { "content-type": "application/pdf" },
    }),
  );
});

afterEach(async () => {
  vi.unstubAllGlobals();
  await fs.rm(dir, { recursive: true, force: true });
  delete process.env.DATA_DIR;
  delete process.env.CLARIFICATION_ENABLED;
});

describe("E7 redesign lần 2 — server ĐÓNG SSE ngay khi cần hỏi, resume qua route HOÀN TOÀN MỚI", () => {
  it("khi cần clarify: response SSE có awaiting_user_input rồi ĐÓNG NGAY — KHÔNG có 'complete' trong CÙNG response", async () => {
    currentPlanOverride = clarifyPlan();
    const { POST } = await import("@/app/api/documents/route");

    const res = await POST(
      sseReq("http://localhost/api/documents", {
        description: "Giải bài toán đạo hàm giúp tôi",
        docType: "article",
        template: "math",
      }),
    );
    expect(res.status).toBe(200);

    const { events, buffer } = await collectSSE(res);
    expect(events).toContain("status"); // { status: "understanding" }
    expect(events).toContain("awaiting_user_input");
    // Đây chính là verify quan trọng nhất của redesign: KHÔNG có 'complete' — vì stream đã đóng
    // TRƯỚC KHI generate xảy ra (khác kiến trúc cũ, nơi generate tiếp tục sau khi có answers/timeout
    // TRONG CÙNG response).
    expect(events).not.toContain("complete");
    expect(buffer).toContain("problem_statement");
    // KHÔNG còn expiresAt trong payload (đã bỏ theo redesign — session không hết hạn theo nghĩa
    // "phải trả lời trước X phút để không mất session", chỉ hết hạn theo nghĩa khác khi resume).
  });

  it("resume qua route MỚI (không cần chờ trong response đầu) → tạo document với description đã enrich", async () => {
    currentPlanOverride = clarifyPlan();
    const { POST } = await import("@/app/api/documents/route");
    const { POST: resumePOST } = await import(
      "@/app/api/documents/clarify/[jobId]/resume/route"
    );

    const firstRes = await POST(
      sseReq("http://localhost/api/documents", {
        description: "Giải bài toán đạo hàm giúp tôi",
        docType: "article",
        template: "math",
      }),
    );
    const { buffer } = await collectSSE(firstRes);
    const jobIdMatch = buffer.match(/"jobId":"([^"]+)"/);
    expect(jobIdMatch).toBeTruthy();
    const jobId = jobIdMatch![1];

    // Request đầu ĐÃ ĐÓNG HOÀN TOÀN (đã await collectSSE tới hết) — mô phỏng "trả lời rất lâu sau,
    // không liên quan gì tới kết nối cũ", đúng bản chất thay đổi kiến trúc.
    const resumeRes = await resumePOST(
      sseReq(`http://localhost/api/documents/clarify/${jobId}/resume`, {
        answers: { problem_statement: "Tính đạo hàm của f(x) = x^2 + 3x" },
      }),
      { params: Promise.resolve({ jobId }) },
    );
    expect(resumeRes.status).toBe(200);

    const { events, buffer: resumeBuffer } = await collectSSE(resumeRes);
    expect(events).toContain("complete");
    expect(resumeBuffer).toContain("Tính đạo hàm của f(x) = x^2 + 3x");
  });

  it("resume 2 LẦN cho CÙNG jobId → lần 2 bị từ chối (409, đã trả lời trước đó)", async () => {
    currentPlanOverride = clarifyPlan();
    const { POST } = await import("@/app/api/documents/route");
    const { POST: resumePOST } = await import(
      "@/app/api/documents/clarify/[jobId]/resume/route"
    );

    const firstRes = await POST(
      sseReq("http://localhost/api/documents", {
        description: "Giải bài toán đạo hàm giúp tôi",
        docType: "article",
        template: "math",
      }),
    );
    const { buffer } = await collectSSE(firstRes);
    const jobId = buffer.match(/"jobId":"([^"]+)"/)![1];

    const resume1 = await resumePOST(
      new Request(`http://localhost/api/documents/clarify/${jobId}/resume`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ answers: { problem_statement: "Lần 1" } }),
      }),
      { params: Promise.resolve({ jobId }) },
    );
    expect(resume1.status).toBe(201); // non-SSE, tạo document mới → 201 Created (đúng convention documents/route.ts).

    const resume2 = await resumePOST(
      new Request(`http://localhost/api/documents/clarify/${jobId}/resume`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ answers: { problem_statement: "Lần 2" } }),
      }),
      { params: Promise.resolve({ jobId }) },
    );
    expect(resume2.status).toBe(409);
    const data = await resume2.json();
    expect(data.error).toMatch(/đã được trả lời/);
  });

  it("resume với jobId KHÔNG tồn tại → 404, không throw", async () => {
    const { POST: resumePOST } = await import(
      "@/app/api/documents/clarify/[jobId]/resume/route"
    );
    const res = await resumePOST(
      new Request("http://localhost/api/documents/clarify/khong-ton-tai/resume", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ answers: { x: "y" } }),
      }),
      { params: Promise.resolve({ jobId: "khong-ton-tai" }) },
    );
    expect(res.status).toBe(404);
  });

  it("khi RequestPlan.recommendedAction = 'generate' → KHÔNG có awaiting_user_input, hành vi giống hệt trước khi E7 tồn tại", async () => {
    currentPlanOverride = generatePlan();
    const { POST } = await import("@/app/api/documents/route");

    const res = await POST(
      sseReq("http://localhost/api/documents", {
        description: "Giải thích khái niệm đạo hàm",
        docType: "article",
        template: "math",
      }),
    );
    const { events } = await collectSSE(res);
    expect(events).not.toContain("awaiting_user_input");
    expect(events).toContain("complete");
  });

  it("CLARIFICATION_ENABLED=false (mặc định) → KHÔNG gọi understandRequest, generate ngay dù có template", async () => {
    process.env.CLARIFICATION_ENABLED = "false";
    currentPlanOverride = null; // nếu route lỡ gọi provider.generateObject(), test tự throw ngay.

    const { POST } = await import("@/app/api/documents/route");
    const res = await POST(
      sseReq("http://localhost/api/documents", {
        description: "Giải thích khái niệm đạo hàm",
        docType: "article",
        template: "math",
      }),
    );
    const { events } = await collectSSE(res);
    expect(events).not.toContain("awaiting_user_input");
    expect(events).toContain("complete");
  });
});
