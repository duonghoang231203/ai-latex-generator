import { describe, it, expect } from "vitest";
import { runDocument } from "@/lib/orchestrator/document";
import { MockProvider } from "@/lib/ai/mock";
import { isDocumentError, type CompileResult } from "@/lib/types/document";

const fakePdf = new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d]); // %PDF-
const compileOk = async (): Promise<CompileResult> => ({ success: true, pdf: fakePdf });
const compileFail = async (): Promise<CompileResult> => ({
  success: false,
  log: "! LaTeX Error: something\nl.10 ...",
});

describe("orchestrator runDocument", () => {
  it("happy path → attempts=1, có pdfBase64", async () => {
    const r = await runDocument(
      { description: "x", docType: "article" },
      { provider: new MockProvider("happy"), compile: compileOk, maxAttempts: 3 },
    );
    expect(isDocumentError(r)).toBe(false);
    if (!isDocumentError(r)) {
      expect(r.attempts).toBe(1);
      expect(r.pdfBase64.length).toBeGreaterThan(0);
      expect(r.metadata?.engine).toBe("xetex");
    }
  });

  it("AST-repair → sửa rồi thành công, attempts=2", async () => {
    const r = await runDocument(
      { description: "x", docType: "article" },
      {
        provider: new MockProvider("fail-then-succeed"),
        compile: compileOk,
        maxAttempts: 3,
      },
    );
    expect(isDocumentError(r)).toBe(false);
    if (!isDocumentError(r)) expect(r.attempts).toBe(2);
  });

  it("compile-repair → compile lỗi lần 1, đúng lần 2, attempts=2", async () => {
    let n = 0;
    const compile = async (): Promise<CompileResult> => {
      n += 1;
      return n === 1 ? compileFail() : compileOk();
    };
    const r = await runDocument(
      { description: "x", docType: "article" },
      { provider: new MockProvider("happy"), compile, maxAttempts: 3 },
    );
    expect(isDocumentError(r)).toBe(false);
    if (!isDocumentError(r)) expect(r.attempts).toBe(2);
  });

  it("luôn lỗi → DocumentError với attempts=maxAttempts", async () => {
    const r = await runDocument(
      { description: "x", docType: "article" },
      {
        provider: new MockProvider("always-invalid"),
        compile: compileOk,
        maxAttempts: 3,
      },
    );
    expect(isDocumentError(r)).toBe(true);
    if (isDocumentError(r)) {
      expect(r.attempts).toBe(3);
      expect(r.latex).toBeTruthy();
      expect(r.error).toBeTruthy();
    }
  });
});
