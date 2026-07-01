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

describe("/api/compile", () => {
  it("thiếu latex → 400", async () => {
    const res = await POST(req({}));
    expect(res.status).toBe(400);
  });

  it("compile service trả PDF → 200 application/pdf", async () => {
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

  it("compile lỗi → 200 JSON {success:false,log}", async () => {
    vi.stubGlobal("fetch", async () =>
      Response.json({ success: false, log: "! LaTeX Error" }, { status: 200 }),
    );
    const res = await POST(req({ latex: "bad" }));
    expect(res.status).toBe(200);
    const data = (await res.json()) as { success: boolean; log: string };
    expect(data.success).toBe(false);
    expect(data.log).toContain("LaTeX Error");
  });

  it("service chết → 502", async () => {
    vi.stubGlobal("fetch", async () => {
      throw new Error("ECONNREFUSED");
    });
    const res = await POST(req({ latex: "x" }));
    expect(res.status).toBe(502);
  });
});
