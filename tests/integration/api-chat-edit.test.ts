import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { promises as fs } from "node:fs";
import path from "node:path";
import os from "node:os";
import { randomUUID } from "node:crypto";
import { POST as createPOST } from "@/app/api/documents/route";
import { GET as getGET } from "@/app/api/documents/[id]/route";
import { POST as chatPOST } from "@/app/api/documents/[id]/chat/route";
import { resetRateLimiter } from "@/lib/ratelimit/tokenBucket";
import { createDocument } from "@/lib/store/documentStore";
import type { StoredDocument } from "@/lib/types/document";

let dir: string;

function ctx(id: string) {
  return { params: Promise.resolve({ id }) };
}

function chatReq(id: string, body: unknown, ip = "5.5.5.5"): Request {
  return new Request(`http://localhost/api/documents/${id}/chat`, {
    method: "POST",
    headers: { "content-type": "application/json", "x-forwarded-for": ip },
    body: JSON.stringify(body),
  });
}

/** Stub compile-service trả PDF hợp lệ. */
function stubPdf() {
  vi.stubGlobal("fetch", async () =>
    new Response(new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d]), {
      status: 200,
      headers: { "content-type": "application/pdf" },
    }),
  );
}
/** Stub compile-service trả LỖI compile (JSON) — luôn thất bại. */
function stubCompileFail() {
  vi.stubGlobal("fetch", async () =>
    new Response(JSON.stringify({ success: false, log: "! LaTeX Error: boom\nl.5 ..." }), {
      status: 200,
      headers: { "content-type": "application/json" },
    }),
  );
}
/** Stub compile-service KHÔNG phản hồi (network error). */
function stubNetworkError() {
  vi.stubGlobal("fetch", async () => {
    throw new Error("ECONNREFUSED");
  });
}

beforeEach(() => {
  dir = path.join(os.tmpdir(), `latexgen-chat-${randomUUID()}`);
  process.env.DATA_DIR = dir;
  process.env.AI_PROVIDER = "mock";
  process.env.RATE_LIMIT_PER_MINUTE = "1000";
  resetRateLimiter();
  stubPdf();
});
afterEach(async () => {
  vi.unstubAllGlobals();
  await fs.rm(dir, { recursive: true, force: true });
  delete process.env.DATA_DIR;
  delete process.env.RATE_LIMIT_PER_MINUTE;
});

async function createDoc(): Promise<StoredDocument> {
  const res = await createPOST(
    new Request("http://localhost/api/documents", {
      method: "POST",
      headers: { "content-type": "application/json", "x-forwarded-for": "1.1.1.1" },
      body: JSON.stringify({ description: "Tài liệu gốc", docType: "article" }),
    }),
  );
  return (await res.json()) as StoredDocument;
}

describe("chat-edit API — các trường hợp", () => {
  it("thành công: áp dụng chỉ thị → latex mới + PDF + 2 message", async () => {
    const doc = await createDoc();
    const before = doc.latex;
    const res = await chatPOST(chatReq(doc.id, { instruction: "Thêm mục Kết luận NEW" }), ctx(doc.id));
    expect(res.status).toBe(200);
    const updated = (await res.json()) as StoredDocument;
    expect(updated.latex).toContain("Thêm mục Kết luận NEW");
    expect(updated.latex).not.toBe(before);
    expect(updated.pdfBase64 && updated.pdfBase64.length).toBeGreaterThan(0);
    expect(updated.error).toBeUndefined();
    expect(updated.messages).toHaveLength(2);
    expect(updated.messages[0]).toMatchObject({ role: "user", content: "Thêm mục Kết luận NEW" });
    expect(updated.messages[1].role).toBe("assistant");
    expect(updated.messages[1].content).toContain("✅");
  });

  it("lịch sử chat tích luỹ qua nhiều lượt", async () => {
    const doc = await createDoc();
    await chatPOST(chatReq(doc.id, { instruction: "Lần 1" }), ctx(doc.id));
    const res2 = await chatPOST(chatReq(doc.id, { instruction: "Lần 2" }), ctx(doc.id));
    const updated = (await res2.json()) as StoredDocument;
    expect(updated.messages).toHaveLength(4);
    expect(updated.messages.map((m) => m.role)).toEqual([
      "user",
      "assistant",
      "user",
      "assistant",
    ]);
    expect(updated.messages[2].content).toBe("Lần 2");
  });

  it("thiếu instruction → 400", async () => {
    const doc = await createDoc();
    const res = await chatPOST(chatReq(doc.id, {}), ctx(doc.id));
    expect(res.status).toBe(400);
  });

  it("instruction rỗng/toàn khoảng trắng → 400", async () => {
    const doc = await createDoc();
    const res = await chatPOST(chatReq(doc.id, { instruction: "   " }), ctx(doc.id));
    expect(res.status).toBe(400);
  });

  it("instruction quá dài (>4000 ký tự) → 400", async () => {
    const doc = await createDoc();
    const res = await chatPOST(chatReq(doc.id, { instruction: "x".repeat(4001) }), ctx(doc.id));
    expect(res.status).toBe(400);
  });

  it("JSON không hợp lệ → 400", async () => {
    const doc = await createDoc();
    const bad = new Request(`http://localhost/api/documents/${doc.id}/chat`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-forwarded-for": "5.5.5.5" },
      body: "{not json",
    });
    const res = await chatPOST(bad, ctx(doc.id));
    expect(res.status).toBe(400);
  });

  it("tài liệu không tồn tại → 404", async () => {
    const res = await chatPOST(chatReq("khong-ton-tai", { instruction: "x" }), ctx("khong-ton-tai"));
    expect(res.status).toBe(404);
  });

  it("id không hợp lệ (path traversal) → 404", async () => {
    const res = await chatPOST(chatReq("..%2Fx", { instruction: "x" }), ctx("../x"));
    expect(res.status).toBe(404);
  });

  it("tài liệu chưa có latex → 400", async () => {
    const empty = await createDocument({
      title: "Rỗng",
      docType: "article",
      template: "general",
      description: "",
      latex: "",
      attempts: 1,
    });
    const res = await chatPOST(chatReq(empty.id, { instruction: "x" }), ctx(empty.id));
    expect(res.status).toBe(400);
  });

  it("edit fail (compile luôn lỗi) → giữ latex cũ, set error, 200 + message cảnh báo", async () => {
    const doc = await createDoc();
    const before = doc.latex;
    const beforePdf = doc.pdfBase64;
    stubCompileFail();
    const res = await chatPOST(chatReq(doc.id, { instruction: "Sửa gì đó" }), ctx(doc.id));
    expect(res.status).toBe(200);
    const updated = (await res.json()) as StoredDocument;
    // Không phá tài liệu đang có.
    expect(updated.latex).toBe(before);
    expect(updated.pdfBase64).toBe(beforePdf);
    expect(updated.error).toBeTruthy();
    expect(updated.messages).toHaveLength(2);
    expect(updated.messages[1].content).toContain("⚠️");
  });

  it("compile service không phản hồi → 502 nhưng vẫn lưu lịch sử chat", async () => {
    const doc = await createDoc();
    stubNetworkError();
    const res = await chatPOST(chatReq(doc.id, { instruction: "Sửa nữa" }), ctx(doc.id));
    expect(res.status).toBe(502);
    const body = (await res.json()) as { error: string };
    expect(body.error).toBeTruthy();
    // Khôi phục stub PDF để đọc lại tài liệu và kiểm tra lịch sử đã lưu.
    stubPdf();
    const getRes = await getGET(new Request("http://localhost"), ctx(doc.id));
    const saved = (await getRes.json()) as StoredDocument;
    expect(saved.messages).toHaveLength(2);
    expect(saved.messages[0]).toMatchObject({ role: "user", content: "Sửa nữa" });
    expect(saved.messages[1].content).toContain("⚠️");
  });

  it("vượt rate limit → 429", async () => {
    const doc = await createDoc();
    process.env.RATE_LIMIT_PER_MINUTE = "1";
    resetRateLimiter();
    const ok = await chatPOST(chatReq(doc.id, { instruction: "Lần đầu" }, "7.7.7.7"), ctx(doc.id));
    expect(ok.status).toBe(200);
    const limited = await chatPOST(chatReq(doc.id, { instruction: "Lần hai" }, "7.7.7.7"), ctx(doc.id));
    expect(limited.status).toBe(429);
  });
});
