import { describe, it, expect, vi, afterEach } from "vitest";
import { compileProject } from "@/lib/compile/client";
import type { ProjectFile } from "@/lib/types/document";

const opts = { serviceUrl: "http://compile", timeoutMs: 5000 };

afterEach(() => vi.unstubAllGlobals());

describe("compileProject client (E1)", () => {
  it("từ chối file traversal TRƯỚC khi gọi service (không fetch)", async () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);
    const r = await compileProject(
      [{ path: "../evil.tex", content: "x" }],
      "../evil.tex",
      opts,
    );
    expect(r.success).toBe(false);
    if (!r.success) expect(r.log).toMatch(/không hợp lệ/i);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("rootFile không nằm trong danh sách → success:false (không fetch)", async () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);
    const r = await compileProject([{ path: "main.tex", content: "x" }], "other.tex", opts);
    expect(r.success).toBe(false);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("dự án hợp lệ → POST {files,rootFile} và trả PDF", async () => {
    let sentBody: unknown = null;
    vi.stubGlobal("fetch", async (_url: string, init: RequestInit) => {
      sentBody = JSON.parse(init.body as string);
      return new Response(new Uint8Array([0x25, 0x50, 0x44, 0x46]), {
        status: 200,
        headers: { "content-type": "application/pdf" },
      });
    });
    const files: ProjectFile[] = [
      { path: "./main.tex", content: "\\documentclass{article}\\begin{document}x\\end{document}" },
      { path: "sections/a.tex", content: "y" },
    ];
    const r = await compileProject(files, "./main.tex", opts);
    expect(r.success).toBe(true);
    // path đã chuẩn hoá ('./main.tex' → 'main.tex') trước khi gửi
    const body = sentBody as { rootFile: string; files: ProjectFile[] };
    expect(body.rootFile).toBe("main.tex");
    expect(body.files.map((f) => f.path)).toEqual(["main.tex", "sections/a.tex"]);
  });
});
