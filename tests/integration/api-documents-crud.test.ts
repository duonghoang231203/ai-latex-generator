import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { promises as fs } from "node:fs";
import path from "node:path";
import os from "node:os";
import { randomUUID } from "node:crypto";
import { GET as listGET, POST as createPOST } from "@/app/api/documents/route";
import {
  GET as getGET,
  PATCH as patchPATCH,
  DELETE as delDELETE,
} from "@/app/api/documents/[id]/route";
import { POST as chatPOST } from "@/app/api/documents/[id]/chat/route";
import { resetRateLimiter } from "@/lib/ratelimit/tokenBucket";
import type { StoredDocument, DocumentSummary } from "@/lib/types/document";

let dir: string;

function ctx(id: string) {
  return { params: Promise.resolve({ id }) };
}

function jsonReq(url: string, body: unknown, method = "POST"): Request {
  return new Request(url, {
    method,
    headers: { "content-type": "application/json", "x-forwarded-for": "9.9.9.9" },
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  dir = path.join(os.tmpdir(), `latexgen-api-${randomUUID()}`);
  process.env.DATA_DIR = dir;
  process.env.AI_PROVIDER = "mock";
  process.env.RATE_LIMIT_PER_MINUTE = "1000";
  resetRateLimiter();
  // compile-service luôn trả PDF hợp lệ.
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
});

async function createDoc(description = "Bài báo test"): Promise<StoredDocument> {
  const res = await createPOST(
    jsonReq("http://localhost/api/documents", { description, docType: "article" }),
  );
  expect(res.status).toBe(201);
  return (await res.json()) as StoredDocument;
}

describe("/api/documents CRUD + chat", () => {
  it("POST tạo tài liệu, lưu trữ với pdf + id", async () => {
    const doc = await createDoc();
    expect(doc.id).toBeTruthy();
    expect(doc.pdfBase64 && doc.pdfBase64.length).toBeGreaterThan(0);
    expect(doc.attempts).toBe(1);
    expect(doc.messages).toEqual([]);
  });

  it("GET danh sách trả tài liệu vừa tạo", async () => {
    const doc = await createDoc("Tiêu đề danh sách");
    const res = await listGET();
    const data = (await res.json()) as { documents: DocumentSummary[] };
    expect(data.documents.some((d) => d.id === doc.id)).toBe(true);
    expect(data.documents.find((d) => d.id === doc.id)?.title).toBe(
      "Tiêu đề danh sách",
    );
  });

  it("GET theo id trả 200; id không tồn tại trả 404", async () => {
    const doc = await createDoc();
    const ok = await getGET(new Request("http://localhost"), ctx(doc.id));
    expect(ok.status).toBe(200);
    const nf = await getGET(new Request("http://localhost"), ctx("khong-ton-tai"));
    expect(nf.status).toBe(404);
  });

  it("PATCH sửa mã nguồn → recompile, cập nhật pdf", async () => {
    const doc = await createDoc();
    const newLatex =
      "\\documentclass{article}\\begin{document}Nội dung mới\\end{document}";
    const res = await patchPATCH(
      jsonReq(`http://localhost/api/documents/${doc.id}`, { latex: newLatex }, "PATCH"),
      ctx(doc.id),
    );
    expect(res.status).toBe(200);
    const updated = (await res.json()) as StoredDocument;
    expect(updated.latex).toContain("Nội dung mới");
    expect(updated.pdfBase64 && updated.pdfBase64.length).toBeGreaterThan(0);
    expect(updated.error).toBeUndefined();
  });

  it("PATCH sửa tiêu đề", async () => {
    const doc = await createDoc();
    const res = await patchPATCH(
      jsonReq(`http://localhost/api/documents/${doc.id}`, { title: "Tên mới" }, "PATCH"),
      ctx(doc.id),
    );
    const updated = (await res.json()) as StoredDocument;
    expect(updated.title).toBe("Tên mới");
  });

  it("POST chat áp dụng chỉ thị → latex mới + lịch sử chat", async () => {
    const doc = await createDoc();
    const res = await chatPOST(
      jsonReq(`http://localhost/api/documents/${doc.id}/chat`, {
        instruction: "Thêm phần Phụ lục XYZ",
      }),
      ctx(doc.id),
    );
    expect(res.status).toBe(200);
    const updated = (await res.json()) as StoredDocument;
    expect(updated.latex).toContain("Thêm phần Phụ lục XYZ");
    expect(updated.messages.length).toBe(2);
    expect(updated.messages[0].role).toBe("user");
    expect(updated.messages[1].role).toBe("assistant");
  });

  it("POST chat thiếu instruction → 400", async () => {
    const doc = await createDoc();
    const res = await chatPOST(
      jsonReq(`http://localhost/api/documents/${doc.id}/chat`, {}),
      ctx(doc.id),
    );
    expect(res.status).toBe(400);
  });

  it("DELETE xoá tài liệu; gọi lại trả 404", async () => {
    const doc = await createDoc();
    const del = await delDELETE(new Request("http://localhost"), ctx(doc.id));
    expect(del.status).toBe(200);
    const again = await delDELETE(new Request("http://localhost"), ctx(doc.id));
    expect(again.status).toBe(404);
  });
});
