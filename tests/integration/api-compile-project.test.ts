import { describe, it, expect, vi, afterEach } from "vitest";
import { POST } from "@/app/api/compile/route";

function req(body: unknown): Request {
  return new Request("http://localhost/api/compile", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

afterEach(() => vi.unstubAllGlobals());

const files = [
  { path: "main.tex", content: "\\documentclass{article}\\begin{document}\\input{ch1}\\end{document}" },
  { path: "ch1.tex", content: "x" },
];

describe("/api/compile — multi-file (E1)", () => {
  it("dự án hợp lệ → 200 application/pdf (gửi files+rootFile tới service)", async () => {
    let sent: unknown = null;
    vi.stubGlobal("fetch", async (_url: string, init: RequestInit) => {
      sent = JSON.parse(init.body as string);
      return new Response(new Uint8Array([0x25, 0x50, 0x44, 0x46]), {
        status: 200,
        headers: { "content-type": "application/pdf" },
      });
    });
    const res = await POST(req({ files, rootFile: "main.tex" }));
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("application/pdf");
    const body = sent as { rootFile: string; files: { path: string }[] };
    expect(body.rootFile).toBe("main.tex");
    expect(body.files.map((f) => f.path)).toEqual(["main.tex", "ch1.tex"]);
  });

  it("thiếu rootFile → 400", async () => {
    const res = await POST(req({ files }));
    expect(res.status).toBe(400);
  });

  it("rootFile không nằm trong files → 200 {success:false} (không gọi service)", async () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);
    const res = await POST(req({ files, rootFile: "khong-co.tex" }));
    expect(res.status).toBe(200);
    const data = (await res.json()) as { success: boolean };
    expect(data.success).toBe(false);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("single-file {latex} vẫn hoạt động (tương thích ngược)", async () => {
    vi.stubGlobal("fetch", async () =>
      new Response(new Uint8Array([0x25, 0x50, 0x44, 0x46]), {
        status: 200,
        headers: { "content-type": "application/pdf" },
      }),
    );
    const res = await POST(req({ latex: "\\documentclass{article}..." }));
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("application/pdf");
  });
});
