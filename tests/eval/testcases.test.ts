import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { runDocument } from "@/lib/orchestrator/document";
import { MockProvider } from "@/lib/ai/mock";
import { isDocumentError, type CompileResult, type DocType } from "@/lib/types/document";

interface TestCase {
  id: string;
  title: string;
  scope: "mvp" | "v1" | "v2";
  docType?: DocType;
  input: { kind: string; prompt?: string };
}

const data = JSON.parse(
  readFileSync(join(process.cwd(), "docs/testcases/testcases.json"), "utf8"),
) as { cases: TestCase[] };

const mvp = data.cases.filter((c) => c.scope === "mvp");
const fakePdf = new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d]);
const compileOk = async (): Promise<CompileResult> => ({ success: true, pdf: fakePdf });

describe("Evaluation test cases (scope=mvp)", () => {
  it("có đúng 3 ca MVP (TC-01, TC-02, TC-05)", () => {
    expect(mvp.map((c) => c.id).sort()).toEqual(["TC-01", "TC-02", "TC-05"]);
  });

  for (const tc of mvp) {
    it(`${tc.id} — ${tc.title}: pipeline cho ra PDF hợp lệ`, async () => {
      const docType = tc.docType ?? "article";
      const description = tc.input.prompt ?? tc.title;
      // TC-05 (sửa lỗi) → mô phỏng lỗi-rồi-đúng; còn lại → happy.
      const scenario = tc.id === "TC-05" ? "fail-then-succeed" : "happy";
      const r = await runDocument(
        { description, docType },
        { provider: new MockProvider(scenario), compile: compileOk, maxAttempts: 3 },
      );
      expect(isDocumentError(r)).toBe(false);
      if (!isDocumentError(r)) {
        expect(r.latex).toContain("\\documentclass");
        expect(r.pdfBase64.length).toBeGreaterThan(0);
        if (tc.id === "TC-05") expect(r.attempts).toBeGreaterThan(1);
      }
    });
  }
});
