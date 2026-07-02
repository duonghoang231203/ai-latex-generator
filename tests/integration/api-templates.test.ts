import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { promises as fs } from "node:fs";
import path from "node:path";
import os from "node:os";
import { randomUUID } from "node:crypto";
import { POST as createPOST, GET as listGET } from "@/app/api/documents/route";
import { resetRateLimiter } from "@/lib/ratelimit/tokenBucket";
import type { StoredDocument, DocumentSummary } from "@/lib/types/document";

let dir: string;

function req(body: unknown): Request {
  return new Request("http://localhost/api/documents", {
    method: "POST",
    headers: { "content-type": "application/json", "x-forwarded-for": "3.3.3.3" },
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  dir = path.join(os.tmpdir(), `latexgen-tpl-${randomUUID()}`);
  process.env.DATA_DIR = dir;
  process.env.AI_PROVIDER = "mock";
  process.env.RATE_LIMIT_PER_MINUTE = "1000";
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
  delete process.env.RATE_LIMIT_PER_MINUTE;
});

describe("tạo tài liệu theo template", () => {
  it("physics: lưu template=physics, docType=article, latex có tikz + PDF", async () => {
    const res = await createPOST(req({ description: "Báo cáo vật lý", template: "physics" }));
    expect(res.status).toBe(201);
    const doc = (await res.json()) as StoredDocument;
    expect(doc.template).toBe("physics");
    expect(doc.docType).toBe("article");
    expect(doc.latex).toContain("tikzpicture");
    expect(doc.latex).toContain("Báo cáo vật lý");
    expect(doc.pdfBase64 && doc.pdfBase64.length).toBeGreaterThan(0);
  });

  it("thesis: docType suy ra = report, latex có tableofcontents + chapter", async () => {
    const res = await createPOST(req({ description: "Luận văn X", template: "thesis" }));
    const doc = (await res.json()) as StoredDocument;
    expect(doc.template).toBe("thesis");
    expect(doc.docType).toBe("report");
    expect(doc.latex).toContain("\\documentclass{report}");
    expect(doc.latex).toContain("\\tableofcontents");
    expect(doc.latex).toContain("\\chapter{");
  });

  it("math: latex có môi trường proof + equation", async () => {
    const res = await createPOST(req({ description: "Ghi chú toán", template: "math" }));
    const doc = (await res.json()) as StoredDocument;
    expect(doc.template).toBe("math");
    expect(doc.latex).toContain("\\begin{proof}");
    expect(doc.latex).toContain("\\begin{equation}");
  });

  it("template không hợp lệ → 400", async () => {
    const res = await createPOST(req({ description: "x", template: "invalid-xyz" }));
    expect(res.status).toBe(400);
  });

  it("legacy doc:'report' (không template) → template mặc định thesis, vẫn tạo được", async () => {
    const res = await createPOST(req({ description: "Báo cáo cũ", docType: "report" }));
    expect(res.status).toBe(201);
    const doc = (await res.json()) as StoredDocument;
    expect(doc.template).toBe("thesis");
    expect(doc.docType).toBe("report");
  });

  it("danh sách trả kèm template", async () => {
    await createPOST(req({ description: "A", template: "academic" }));
    const res = await listGET();
    const data = (await res.json()) as { documents: DocumentSummary[] };
    expect(data.documents[0].template).toBe("academic");
  });

  it("slides (beamer): docType=article, latex có documentclass beamer + frame", async () => {
    const res = await createPOST(req({ description: "Bài thuyết trình", template: "slides" }));
    const doc = (await res.json()) as StoredDocument;
    expect(doc.template).toBe("slides");
    expect(doc.docType).toBe("article");
    expect(doc.latex).toContain("\\documentclass{beamer}");
    expect(doc.latex).toContain("\\begin{frame}");
  });

  it("exam: latex dùng class exam + questions", async () => {
    const res = await createPOST(req({ description: "Đề kiểm tra", template: "exam" }));
    const doc = (await res.json()) as StoredDocument;
    expect(doc.latex).toContain("\\documentclass{exam}");
    expect(doc.latex).toContain("\\begin{questions}");
  });

  it("letter: class letter, có begin{letter}, không maketitle", async () => {
    const res = await createPOST(req({ description: "Thư mời", template: "letter" }));
    const doc = (await res.json()) as StoredDocument;
    expect(doc.docType).toBe("article");
    expect(doc.latex).toContain("\\documentclass{letter}");
    expect(doc.latex).toContain("\\begin{letter}");
    expect(doc.latex).not.toContain("\\maketitle");
  });

  it("chemistry: latex dùng mhchem \\ce", async () => {
    const res = await createPOST(req({ description: "Phản ứng oxi hoá", template: "chemistry" }));
    const doc = (await res.json()) as StoredDocument;
    expect(doc.latex).toContain("\\ce{");
  });
});
