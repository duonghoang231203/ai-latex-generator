import { describe, it, expect, vi, afterEach } from "vitest";
import { GET } from "@/app/api/health/route";

function req(qs = ""): Request {
  return new Request(`http://localhost/api/health${qs}`);
}

afterEach(() => vi.unstubAllGlobals());

describe("/api/health", () => {
  it("liveness: trả 200 status ok", async () => {
    const res = await GET(req());
    expect(res.status).toBe(200);
    const data = (await res.json()) as { status: string; service: string };
    expect(data.status).toBe("ok");
    expect(data.service).toBe("next-app");
  });

  it("deep=1 khi compile-service ok → 200 ok", async () => {
    vi.stubGlobal("fetch", async () => new Response(null, { status: 200 }));
    const res = await GET(req("?deep=1"));
    expect(res.status).toBe(200);
    const data = (await res.json()) as { status: string; dependencies: { compileService: boolean } };
    expect(data.status).toBe("ok");
    expect(data.dependencies.compileService).toBe(true);
  });

  it("deep=1 khi compile-service lỗi → 503 degraded", async () => {
    vi.stubGlobal("fetch", async () => {
      throw new Error("down");
    });
    const res = await GET(req("?deep=1"));
    expect(res.status).toBe(503);
    const data = (await res.json()) as { status: string; dependencies: { compileService: boolean } };
    expect(data.status).toBe("degraded");
    expect(data.dependencies.compileService).toBe(false);
  });
});
