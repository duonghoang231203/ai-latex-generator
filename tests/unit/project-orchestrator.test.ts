import { describe, it, expect, vi } from "vitest";
import { runProject, type OrchestratorDeps } from "@/lib/orchestrator/document";
import { MockProvider } from "@/lib/ai/mock";
import { isDocumentError, type CompileResult, type ProjectFile } from "@/lib/types/document";

const fakePdf = new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d]); // %PDF-

const files: ProjectFile[] = [
  {
    path: "main.tex",
    content: "\\documentclass{article}\\begin{document}\\input{ch1}\\end{document}",
  },
  { path: "ch1.tex", content: "Nội dung chương một." },
];

describe("runProject (E1 orchestrator wiring)", () => {
  it("happy: compileProject thành công → attempts=1, có PDF, gửi đúng rootFile", async () => {
    const compileProject = vi.fn(async (): Promise<CompileResult> => ({
      success: true,
      pdf: fakePdf,
    }));
    const deps: OrchestratorDeps = {
      provider: new MockProvider("happy"),
      compile: async () => ({ success: false, log: "không nên gọi" }),
      compileProject,
      maxAttempts: 3,
    };
    const r = await runProject(
      { files, rootFile: "main.tex", docType: "article" },
      deps,
    );
    expect(isDocumentError(r)).toBe(false);
    if (!isDocumentError(r)) {
      expect(r.attempts).toBe(1);
      expect(r.pdfBase64.length).toBeGreaterThan(0);
    }
    // gọi compileProject với rootFile = main.tex và đủ 2 file
    expect(compileProject).toHaveBeenCalledTimes(1);
    const args = compileProject.mock.calls[0] as unknown as [ProjectFile[], string];
    const [sentFiles, sentRoot] = args;
    expect(sentRoot).toBe("main.tex");
    expect(sentFiles.map((f) => f.path)).toEqual(["main.tex", "ch1.tex"]);
  });

  it("repair: lỗi lần 1 → AI sửa file gốc → lần 2 thành công (attempts=2)", async () => {
    let calls = 0;
    const compileProject = vi.fn(async (f: ProjectFile[]): Promise<CompileResult> => {
      calls += 1;
      if (calls === 1) return { success: false, log: "! Undefined control sequence" };
      // lần 2: nội dung file gốc đã được thay bằng bản AI sửa
      const root = f.find((x) => x.path === "main.tex");
      expect(root?.content).toContain("\\end{document}"); // bản sửa hợp lệ
      return { success: true, pdf: fakePdf };
    });
    const provider = new MockProvider("happy");
    const genSpy = vi.spyOn(provider, "generate");
    const deps: OrchestratorDeps = {
      provider,
      compile: async () => ({ success: false, log: "không nên gọi" }),
      compileProject,
      maxAttempts: 3,
    };
    const r = await runProject(
      { files, rootFile: "main.tex", docType: "article" },
      deps,
    );
    expect(isDocumentError(r)).toBe(false);
    if (!isDocumentError(r)) expect(r.attempts).toBe(2);
    expect(genSpy).toHaveBeenCalledTimes(1); // đúng 1 lượt sửa
    expect(compileProject).toHaveBeenCalledTimes(2);
  });

  it("dự án không hợp lệ (path traversal) → DocumentError, KHÔNG compile", async () => {
    const compileProject = vi.fn();
    const deps: OrchestratorDeps = {
      provider: new MockProvider("happy"),
      compile: async () => ({ success: false, log: "x" }),
      compileProject,
      maxAttempts: 3,
    };
    const r = await runProject(
      { files: [{ path: "../evil.tex", content: "x" }], rootFile: "../evil.tex", docType: "article" },
      deps,
    );
    expect(isDocumentError(r)).toBe(true);
    expect(compileProject).not.toHaveBeenCalled();
  });

  it("thiếu deps.compileProject → ném lỗi rõ ràng", async () => {
    const deps: OrchestratorDeps = {
      provider: new MockProvider("happy"),
      compile: async () => ({ success: true, pdf: fakePdf }),
      maxAttempts: 3,
    };
    await expect(
      runProject({ files, rootFile: "main.tex", docType: "article" }, deps),
    ).rejects.toThrow(/compileProject/);
  });
});
