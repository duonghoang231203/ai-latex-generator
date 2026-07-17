// tests/integration/api-documents-patch-project.test.ts
// E1a — PATCH /api/documents/[id] nhánh multi-file: convert-in-place, validate, compileProject,
// size/count guard, .tex extension guard, đồng bộ patch.latex = nội dung file gốc, isProject summary.
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { promises as fs } from "node:fs";
import path from "node:path";
import os from "node:os";
import { randomUUID } from "node:crypto";
import { GET as listGET, POST as createPOST } from "@/app/api/documents/route";
import { PATCH as patchPATCH } from "@/app/api/documents/[id]/route";
import { resetRateLimiter } from "@/lib/ratelimit/tokenBucket";
import type { StoredDocument, DocumentSummary } from "@/lib/types/document";

vi.mock("@/lib/auth/current-user", () => ({
  getCurrentUser: async () => ({ id: "test-user", email: "test@example.com" }),
  getCurrentUserId: async () => "test-user",
}));

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
  dir = path.join(os.tmpdir(), `latexgen-api-proj-${randomUUID()}`);
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
  delete process.env.MAX_PROJECT_BYTES;
  delete process.env.MAX_PROJECT_FILES;
});

async function createDoc(description = "Bài báo test"): Promise<StoredDocument> {
  const res = await createPOST(
    jsonReq("http://localhost/api/documents", { description, docType: "article" }),
  );
  expect(res.status).toBe(201);
  return (await res.json()) as StoredDocument;
}

describe("PATCH /api/documents/[id] — multi-file (E1a)", () => {
  it("convert-in-place: single-file → multi-file qua {files, rootFile}, compile cả dự án", async () => {
    const doc = await createDoc();
    const res = await patchPATCH(
      jsonReq(
        `http://localhost/api/documents/${doc.id}`,
        {
          files: [
            { path: "main.tex", content: doc.latex },
            { path: "section1.tex", content: "" },
          ],
          rootFile: "main.tex",
        },
        "PATCH",
      ),
      ctx(doc.id),
    );
    expect(res.status).toBe(200);
    const updated = (await res.json()) as StoredDocument;
    expect(updated.files).toHaveLength(2);
    expect(updated.rootFile).toBe("main.tex");
    expect(updated.pdfBase64 && updated.pdfBase64.length).toBeGreaterThan(0);
    // patch.latex đồng bộ = nội dung file gốc.
    expect(updated.latex).toBe(doc.latex);
  });

  it("đổi rootFile sang file khác → patch.latex đồng bộ theo file gốc mới", async () => {
    const doc = await createDoc();
    const res = await patchPATCH(
      jsonReq(
        `http://localhost/api/documents/${doc.id}`,
        {
          files: [
            { path: "main.tex", content: "main content" },
            { path: "thesis.tex", content: "thesis content" },
          ],
          rootFile: "thesis.tex",
        },
        "PATCH",
      ),
      ctx(doc.id),
    );
    const updated = (await res.json()) as StoredDocument;
    expect(updated.rootFile).toBe("thesis.tex");
    expect(updated.latex).toBe("thesis content");
  });

  it("file path không kết thúc .tex → 400, không gọi compile-service", async () => {
    const doc = await createDoc();
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);
    const res = await patchPATCH(
      jsonReq(
        `http://localhost/api/documents/${doc.id}`,
        { files: [{ path: "image.png", content: "x" }], rootFile: "image.png" },
        "PATCH",
      ),
      ctx(doc.id),
    );
    expect(res.status).toBe(400);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("path rỗng → 400", async () => {
    const doc = await createDoc();
    const res = await patchPATCH(
      jsonReq(
        `http://localhost/api/documents/${doc.id}`,
        { files: [{ path: "", content: "x" }], rootFile: "main.tex" },
        "PATCH",
      ),
      ctx(doc.id),
    );
    expect(res.status).toBe(400);
  });

  it("path traversal (../) trong files → 400 (validateProject chặn)", async () => {
    const doc = await createDoc();
    const res = await patchPATCH(
      jsonReq(
        `http://localhost/api/documents/${doc.id}`,
        { files: [{ path: "../etc/passwd.tex", content: "x" }], rootFile: "../etc/passwd.tex" },
        "PATCH",
      ),
      ctx(doc.id),
    );
    expect(res.status).toBe(400);
  });

  it("rootFile không nằm trong files → 400", async () => {
    const doc = await createDoc();
    const res = await patchPATCH(
      jsonReq(
        `http://localhost/api/documents/${doc.id}`,
        { files: [{ path: "main.tex", content: "x" }], rootFile: "khac.tex" },
        "PATCH",
      ),
      ctx(doc.id),
    );
    expect(res.status).toBe(400);
  });

  it("path trùng lặp → 400", async () => {
    const doc = await createDoc();
    const res = await patchPATCH(
      jsonReq(
        `http://localhost/api/documents/${doc.id}`,
        {
          files: [
            { path: "main.tex", content: "a" },
            { path: "main.tex", content: "b" },
          ],
          rootFile: "main.tex",
        },
        "PATCH",
      ),
      ctx(doc.id),
    );
    expect(res.status).toBe(400);
  });

  it("vượt MAX_PROJECT_FILES → 400, không gọi compile-service", async () => {
    process.env.MAX_PROJECT_FILES = "2";
    const doc = await createDoc();
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);
    const res = await patchPATCH(
      jsonReq(
        `http://localhost/api/documents/${doc.id}`,
        {
          files: [
            { path: "main.tex", content: "a" },
            { path: "s1.tex", content: "b" },
            { path: "s2.tex", content: "c" },
          ],
          rootFile: "main.tex",
        },
        "PATCH",
      ),
      ctx(doc.id),
    );
    expect(res.status).toBe(400);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("vượt MAX_PROJECT_BYTES → 400, không gọi compile-service", async () => {
    process.env.MAX_PROJECT_BYTES = "10";
    const doc = await createDoc();
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);
    const res = await patchPATCH(
      jsonReq(
        `http://localhost/api/documents/${doc.id}`,
        {
          files: [{ path: "main.tex", content: "nội dung dài hơn 10 bytes chắc chắn" }],
          rootFile: "main.tex",
        },
        "PATCH",
      ),
      ctx(doc.id),
    );
    expect(res.status).toBe(400);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("package không trong allowlist (template academic) → lỗi validate, không gọi compile-service", async () => {
    const doc = await createDoc(); // template mặc định "academic" (docType article)
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);
    const res = await patchPATCH(
      jsonReq(
        `http://localhost/api/documents/${doc.id}`,
        {
          files: [
            {
              path: "main.tex",
              content:
                "\\documentclass{article}\\usepackage{totallynotallowedpkg}\\begin{document}x\\end{document}",
            },
          ],
          rootFile: "main.tex",
        },
        "PATCH",
      ),
      ctx(doc.id),
    );
    expect(res.status).toBe(200);
    const updated = (await res.json()) as StoredDocument;
    expect(updated.error).toBeTruthy();
    expect(updated.log ?? "").toContain("totallynotallowedpkg");
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("compile lỗi (\"success:false\" từ compile-service) → lưu log/error, giữ files", async () => {
    vi.stubGlobal("fetch", async () =>
      Response.json({ success: false, log: "! Undefined control sequence." }),
    );
    const doc = await createDoc();
    const res = await patchPATCH(
      jsonReq(
        `http://localhost/api/documents/${doc.id}`,
        {
          files: [{ path: "main.tex", content: doc.latex }],
          rootFile: "main.tex",
        },
        "PATCH",
      ),
      ctx(doc.id),
    );
    expect(res.status).toBe(200);
    const updated = (await res.json()) as StoredDocument;
    expect(updated.error).toBeTruthy();
    expect(updated.log).toContain("Undefined control sequence");
    expect(updated.files).toHaveLength(1);
  });

  it("latex đồng thời với files → latex bị bỏ qua, files thắng", async () => {
    const doc = await createDoc();
    const res = await patchPATCH(
      jsonReq(
        `http://localhost/api/documents/${doc.id}`,
        {
          latex: "\\documentclass{article}\\begin{document}NÊN BỊ BỎ QUA\\end{document}",
          files: [{ path: "main.tex", content: "nội dung file thắng" }],
          rootFile: "main.tex",
        },
        "PATCH",
      ),
      ctx(doc.id),
    );
    const updated = (await res.json()) as StoredDocument;
    expect(updated.latex).toBe("nội dung file thắng");
    expect(updated.files?.[0]?.content).toBe("nội dung file thắng");
  });

  it("GET danh sách: isProject=true cho dự án multi-file, false cho single-file", async () => {
    const single = await createDoc("Đơn file");
    const willBeProject = await createDoc("Sẽ thành dự án");
    await patchPATCH(
      jsonReq(
        `http://localhost/api/documents/${willBeProject.id}`,
        {
          files: [{ path: "main.tex", content: willBeProject.latex }],
          rootFile: "main.tex",
        },
        "PATCH",
      ),
      ctx(willBeProject.id),
    );

    const res = await listGET();
    const data = (await res.json()) as { documents: DocumentSummary[] };
    expect(data.documents.find((d) => d.id === single.id)?.isProject).toBe(false);
    expect(data.documents.find((d) => d.id === willBeProject.id)?.isProject).toBe(true);
  });
});
