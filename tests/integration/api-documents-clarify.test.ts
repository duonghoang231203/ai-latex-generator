// tests/integration/api-documents-clarify.test.ts
//
// E7 · Clarification Layer — integration test TRẢ LỜI TRỰC TIẾP câu hỏi: "chạy thật với template
// thì hệ thống có hỏi lại user không?" bằng cách gọi ĐÚNG route SSE thật (app/api/documents/
// route.ts POST với Accept: text/event-stream), với CLARIFICATION_ENABLED=true, và verify:
//   1. Khi AI (RequestPlan) quyết định "clarify" → route gửi event `awaiting_user_input` chứa
//      đúng câu hỏi, và generation THỰC SỰ DỪNG LẠI (không compile/tạo document ngay).
//   2. Sau khi PATCH .../clarify/[jobId] với câu trả lời → generation TIẾP TỤC, document được tạo
//      với description đã được enrich bằng câu trả lời.
//   3. Khi RequestPlan quyết định "generate" → KHÔNG có event awaiting_user_input, hành vi giống
//      hệt trước khi E7 tồn tại.
//
// `getProvider()` (lib/ai/factory.ts) hardcode `new MockProvider("happy")` — không có
// generateObjectOverride. vi.mock() toàn bộ module factory để trả về 1 MockProvider CÓ override,
// điều khiển được recommendedAction cho từng test case cụ thể.
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { promises as fs } from "node:fs";
import path from "node:path";
import os from "node:os";
import { randomUUID } from "node:crypto";
import { MockProvider } from "@/lib/ai/mock";
import { resetRateLimiter } from "@/lib/ratelimit/tokenBucket";
import { __resetSessionsForTest } from "@/lib/clarification/session";
import type { RequestPlan } from "@/lib/ai/schemas/request-plan";

vi.mock("@/lib/auth/current-user", () => ({
  getCurrentUser: async () => ({ id: "test-user", email: "test@example.com" }),
  getCurrentUserId: async () => "test-user",
}));

/** Override generateObject cho MockProvider — set qua module-level ref, đọc lại trong vi.mock factory bên dưới. */
let currentPlanOverride: RequestPlan | null = null;

vi.mock("@/lib/ai/factory", () => ({
  getProvider: () =>
    new MockProvider("happy", (_schema, _prompt) => {
      if (!currentPlanOverride) {
        throw new Error("Test setup error: currentPlanOverride chưa được set trước khi gọi route.");
      }
      return currentPlanOverride;
    }),
}));

function clarifyPlan(overrides: Partial<RequestPlan> = {}): RequestPlan {
  return {
    intent: "Giải bài toán đạo hàm",
    templateId: "math",
    requirements: [],
    assumptions: [],
    missingInformation: [{ field: "problem_statement", importance: "critical" }],
    ambiguity: "high",
    confidence: 0.4,
    recommendedAction: "clarify",
    ...overrides,
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

/** Parse toàn bộ SSE stream thành danh sách { event, data } theo đúng thứ tự enqueue. */
async function collectSSE(res: Response): Promise<Array<{ event: string; data: unknown }>> {
  const text = await res.text();
  const events: Array<{ event: string; data: unknown }> = [];
  const blocks = text.split("\n\n").filter((b) => b.trim().length > 0);
  for (const block of blocks) {
    const eventLine = block.split("\n").find((l) => l.startsWith("event: "));
    const dataLines = block
      .split("\n")
      .filter((l) => l.startsWith("data: "))
      .map((l) => l.slice("data: ".length));
    if (!eventLine) continue;
    const event = eventLine.slice("event: ".length);
    events.push({ event, data: JSON.parse(dataLines.join("\n")) });
  }
  return events;
}

function sseReq(body: unknown): Request {
  return new Request("http://localhost/api/documents", {
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
  __resetSessionsForTest();
  vi.stubGlobal("fetch", async () =>
    new Response(new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d]), {
      status: 200,
      headers: { "content-type": "application/pdf" },
    }),
  );
});

afterEach(async () => {
  vi.unstubAllGlobals();
  __resetSessionsForTest();
  await fs.rm(dir, { recursive: true, force: true });
  delete process.env.DATA_DIR;
  delete process.env.CLARIFICATION_ENABLED;
});

describe("E7 end-to-end: hệ thống CÓ hỏi lại user khi RequestPlan.recommendedAction = 'clarify'", () => {
  it("route SSE gửi event 'understanding' rồi 'awaiting_user_input' — generation THỰC SỰ DỪNG, chưa có 'complete'", async () => {
    currentPlanOverride = clarifyPlan();

    // Route sẽ AWAIT session.wait vô thời hạn (TTL 5 phút) — không resolve trong test này, nên
    // KHÔNG await response.text() (sẽ treo tới khi timeout). Đọc trực tiếp qua stream reader với
    // timeout ngắn để verify 2 event đầu rồi hủy, thay vì chờ hết toàn bộ response.
    const { POST } = await import("@/app/api/documents/route");
    const res = await POST(
      sseReq({ description: "Giải bài toán đạo hàm giúp tôi", docType: "article", template: "math" }),
    );
    expect(res.status).toBe(200);

    const reader = res.body!.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    const events: string[] = [];

    // Đọc tới khi thấy đủ 2 event mong đợi hoặc hết 2s (tránh treo test nếu logic sai).
    const deadline = Date.now() + 2000;
    while (Date.now() < deadline && !buffer.includes("awaiting_user_input")) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
    }
    await reader.cancel();

    for (const block of buffer.split("\n\n")) {
      const m = block.match(/^event: (.+)$/m);
      if (m) events.push(m[1]);
    }

    // Route gửi event TÊN "status" với data { status: "understanding" } (đồng bộ với event
    // "status" đã có sẵn cho { status: "compiling" }, không tạo tên event mới) — kiểm tra qua data
    // thô, không qua tên event.
    expect(events).toContain("status");
    expect(buffer).toContain('"status":"understanding"');
    expect(events).toContain("awaiting_user_input");
    // KHÔNG được có 'complete' — generation phải dừng chờ, không tự ý tiếp tục.
    expect(events).not.toContain("complete");
    expect(buffer).toContain("problem_statement");
    expect(buffer).toContain("Bạn gửi giúp mình nội dung bài toán cần giải");
    // Payload PHẢI có expiresAt (ISO string) — client dùng để hiển thị đếm ngược/tự disable khi
    // hết hạn (thêm 2026-07-14 sau khi phát hiện qua debug thật: user rời tab quá 5 phút quay lại
    // bấm gửi luôn gặp lỗi 404 khó hiểu vì không có cách nào biết session đã hết hạn TRƯỚC khi gửi).
    const expiresAtMatch = buffer.match(/"expiresAt":"([^"]+)"/);
    expect(expiresAtMatch).toBeTruthy();
    expect(new Date(expiresAtMatch![1]).getTime()).toBeGreaterThan(Date.now());
  });

  it("sau khi PATCH câu trả lời vào /clarify/[jobId] → generation TIẾP TỤC, document được tạo với mô tả đã enrich", async () => {
    currentPlanOverride = clarifyPlan();

    const { POST } = await import("@/app/api/documents/route");
    const { PATCH } = await import("@/app/api/documents/clarify/[jobId]/route");

    const responsePromise = POST(
      sseReq({ description: "Giải bài toán đạo hàm giúp tôi", docType: "article", template: "math" }),
    );

    // Chờ tới khi có jobId xuất hiện trong stream, rồi PATCH câu trả lời NGAY (không chờ response
    // đóng — vì nó sẽ không đóng cho tới khi được resolve, đúng bằng chứng của thiết kế "giữ stream mở").
    const res = await responsePromise;
    const reader = res.body!.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    let jobId: string | undefined;
    const deadline = Date.now() + 2000;
    while (Date.now() < deadline && !jobId) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const m = buffer.match(/"jobId":"([^"]+)"/);
      if (m) jobId = m[1];
    }
    expect(jobId).toBeTruthy();

    const patchRes = await PATCH(
      new Request(`http://localhost/api/documents/clarify/${jobId}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ answers: { problem_statement: "Tính đạo hàm của f(x) = x^2 + 3x" } }),
      }),
      { params: Promise.resolve({ jobId: jobId! }) },
    );
    expect(patchRes.status).toBe(200);

    // Sau resolve, generation tiếp tục trong CÙNG stream — đọc tiếp tới khi có 'complete'.
    const completeDeadline = Date.now() + 5000;
    while (Date.now() < completeDeadline && !buffer.includes('"event: complete"') && !buffer.includes("event: complete")) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
    }

    expect(buffer).toContain("event: complete");
    expect(buffer).toContain("Tính đạo hàm của f(x) = x^2 + 3x");
  });

  it("khi RequestPlan.recommendedAction = 'generate' → KHÔNG có awaiting_user_input, hành vi giống hệt trước khi E7 tồn tại", async () => {
    currentPlanOverride = generatePlan();

    const { POST } = await import("@/app/api/documents/route");
    const res = await POST(
      sseReq({ description: "Giải thích khái niệm đạo hàm", docType: "article", template: "math" }),
    );
    const events = await collectSSE(res);
    const eventNames = events.map((e) => e.event);

    expect(eventNames).not.toContain("awaiting_user_input");
    expect(eventNames).toContain("complete");
  });

  it("CLARIFICATION_ENABLED=false (mặc định) → KHÔNG gọi understandRequest, generate ngay dù có template", async () => {
    process.env.CLARIFICATION_ENABLED = "false";
    // Không set currentPlanOverride — nếu route LỠ gọi provider.generateObject(), test này sẽ
    // throw ngay ("Test setup error"), tự động phát hiện regression nếu ai vô tình bỏ feature flag.
    currentPlanOverride = null;

    const { POST } = await import("@/app/api/documents/route");
    const res = await POST(
      sseReq({ description: "Giải thích khái niệm đạo hàm", docType: "article", template: "math" }),
    );
    const events = await collectSSE(res);
    const eventNames = events.map((e) => e.event);

    expect(eventNames).not.toContain("understanding");
    expect(eventNames).not.toContain("awaiting_user_input");
    expect(eventNames).toContain("complete");
  });
});
