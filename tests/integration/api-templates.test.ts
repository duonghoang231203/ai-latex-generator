import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { promises as fs } from "node:fs";
import path from "node:path";
import os from "node:os";
import { randomUUID } from "node:crypto";
import { POST as createPOST, GET as listGET } from "@/app/api/documents/route";
import { resetRateLimiter } from "@/lib/ratelimit/tokenBucket";
import type { StoredDocument, DocumentSummary } from "@/lib/types/document";

vi.mock("@/lib/auth/current-user", () => ({
  getCurrentUser: async () => ({ id: "test-user", email: "test@example.com" }),
  getCurrentUserId: async () => "test-user",
}));

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
  it("academic: stores template=academic, docType=article, latex has abstract + biblio", async () => {
    const res = await createPOST(req({ description: "Research on AI", template: "academic" }));
    expect(res.status).toBe(201);
    const doc = (await res.json()) as StoredDocument;
    expect(doc.template).toBe("academic");
    expect(doc.docType).toBe("article");
    expect(doc.latex).toContain("\\begin{abstract}");
    expect(doc.latex).toContain("\\begin{thebibliography}");
    expect(doc.pdfBase64 && doc.pdfBase64.length).toBeGreaterThan(0);
  });

  it("math: latex has theorem environments + proof + equation", async () => {
    const res = await createPOST(req({ description: "Ghi chú toán", template: "math" }));
    const doc = (await res.json()) as StoredDocument;
    expect(doc.template).toBe("math");
    expect(doc.docType).toBe("article");
    expect(doc.latex).toContain("\\begin{proof}");
    expect(doc.latex).toContain("\\begin{equation}");
    expect(doc.latex).toContain("\\newtheorem{theorem}");
  });

  it("thesis: docType inferred = report, latex has tableofcontents + chapters", async () => {
    const res = await createPOST(req({ description: "Luận văn X", template: "thesis" }));
    const doc = (await res.json()) as StoredDocument;
    expect(doc.template).toBe("thesis");
    expect(doc.docType).toBe("report");
    expect(doc.latex).toContain("\\documentclass{report}");
    expect(doc.latex).toContain("\\tableofcontents");
    expect(doc.latex).toContain("\\chapter{");
  });

  it("slides (beamer): docType=article, latex has beamer class + frames + titlepage", async () => {
    const res = await createPOST(req({ description: "Bài thuyết trình", template: "slides" }));
    const doc = (await res.json()) as StoredDocument;
    expect(doc.template).toBe("slides");
    expect(doc.docType).toBe("article");
    expect(doc.latex).toContain("\\documentclass{beamer}");
    expect(doc.latex).toContain("\\begin{frame}");
    expect(doc.latex).toContain("\\titlepage");
  });

  it("removed template (physics) → 400", async () => {
    const res = await createPOST(req({ description: "x", template: "physics" }));
    expect(res.status).toBe(400);
  });

  it("removed template (general) → 400", async () => {
    const res = await createPOST(req({ description: "x", template: "general" }));
    expect(res.status).toBe(400);
  });

  it("invalid template string → 400", async () => {
    const res = await createPOST(req({ description: "x", template: "invalid-xyz" }));
    expect(res.status).toBe(400);
  });

  it("legacy doc:'report' (no template) → defaults to thesis, still creates successfully", async () => {
    const res = await createPOST(req({ description: "Báo cáo cũ", docType: "report" }));
    expect(res.status).toBe(201);
    const doc = (await res.json()) as StoredDocument;
    expect(doc.template).toBe("thesis");
    expect(doc.docType).toBe("report");
  });

  it("legacy doc:'article' (no template) → defaults to academic", async () => {
    const res = await createPOST(req({ description: "Bài viết cũ", docType: "article" }));
    expect(res.status).toBe(201);
    const doc = (await res.json()) as StoredDocument;
    expect(doc.template).toBe("academic");
    expect(doc.docType).toBe("article");
  });

  it("list returns stored template field", async () => {
    await createPOST(req({ description: "A", template: "math" }));
    const res = await listGET();
    const data = (await res.json()) as { documents: DocumentSummary[] };
    expect(data.documents[0].template).toBe("math");
  });
});
