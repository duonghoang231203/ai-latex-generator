// BE-5.3.4 — postCompile() gọi opts.logger?() với latency + phân loại rõ 3 outcome: success (PDF
// trả về), compile_error (JSON {success:false,log} — lỗi NỘI DUNG LaTeX, không phải hạ tầng),
// infra_error (status bất thường HOẶC network/abort/timeout — 2 sub-case khác nhau, phân biệt
// bằng có/không có field status). opts.logger là optional — mọi test compile-client hiện có
// (tests/unit/compile-client-project.test.ts) không truyền field này và vẫn hoạt động đúng.
import { describe, it, expect, vi, afterEach } from "vitest";
import { compileLatex } from "@/lib/compile/client";
import type { LogFields } from "@/lib/log";

afterEach(() => vi.unstubAllGlobals());

function makeLoggerSpy() {
  const calls: { event: string; fields: LogFields }[] = [];
  const logger = vi.fn((event: string, fields: LogFields) => {
    calls.push({ event, fields });
  });
  return { logger, calls };
}

describe("compile client — opts.logger?() cho compile.request (BE-5.3.4)", () => {
  it("PDF trả về thành công → log outcome:success với latencyMs>=0 và status", async () => {
    vi.stubGlobal("fetch", async () =>
      new Response(new Uint8Array([0x25, 0x50, 0x44, 0x46]), {
        status: 200,
        headers: { "content-type": "application/pdf" },
      }),
    );
    const { logger, calls } = makeLoggerSpy();
    const r = await compileLatex("x", { serviceUrl: "http://compile", timeoutMs: 5000, logger });
    expect(r.success).toBe(true);
    expect(calls).toHaveLength(1);
    expect(calls[0].event).toBe("compile.request");
    expect(calls[0].fields.outcome).toBe("success");
    expect(calls[0].fields.status).toBe(200);
    expect(typeof calls[0].fields.latencyMs).toBe("number");
    expect(calls[0].fields.latencyMs as number).toBeGreaterThanOrEqual(0);
  });

  it("compile-service trả JSON {success:false,log} (lỗi LaTeX) → log outcome:compile_error, KHÔNG phải infra_error", async () => {
    vi.stubGlobal("fetch", async () =>
      new Response(JSON.stringify({ log: "! Undefined control sequence." }), {
        status: 400,
        headers: { "content-type": "application/json" },
      }),
    );
    const { logger, calls } = makeLoggerSpy();
    const r = await compileLatex("x", { serviceUrl: "http://compile", timeoutMs: 5000, logger });
    expect(r.success).toBe(false);
    expect(calls).toHaveLength(1);
    expect(calls[0].fields.outcome).toBe("compile_error");
    expect(calls[0].fields.status).toBe(400);
  });

  it("compile-service trả status bất thường không phải PDF/JSON → log outcome:infra_error CÓ status, rồi throw CompileServiceError", async () => {
    vi.stubGlobal("fetch", async () =>
      new Response("Internal Server Error", { status: 500 }),
    );
    const { logger, calls } = makeLoggerSpy();
    await expect(
      compileLatex("x", { serviceUrl: "http://compile", timeoutMs: 5000, logger }),
    ).rejects.toThrow();
    expect(calls).toHaveLength(1);
    expect(calls[0].fields.outcome).toBe("infra_error");
    expect(calls[0].fields.status).toBe(500);
  });

  it("fetch throw (network/abort) → log outcome:infra_error KHÔNG có status, có message", async () => {
    vi.stubGlobal("fetch", async () => {
      throw new Error("fetch failed: ECONNREFUSED");
    });
    const { logger, calls } = makeLoggerSpy();
    await expect(
      compileLatex("x", { serviceUrl: "http://compile", timeoutMs: 5000, logger }),
    ).rejects.toThrow();
    expect(calls).toHaveLength(1);
    expect(calls[0].fields.outcome).toBe("infra_error");
    expect(calls[0].fields.status).toBeUndefined();
    expect(calls[0].fields.message).toContain("ECONNREFUSED");
  });

  it("không truyền logger (optional) → vẫn hoạt động đúng, không throw", async () => {
    vi.stubGlobal("fetch", async () =>
      new Response(new Uint8Array([0x25, 0x50, 0x44, 0x46]), {
        status: 200,
        headers: { "content-type": "application/pdf" },
      }),
    );
    const r = await compileLatex("x", { serviceUrl: "http://compile", timeoutMs: 5000 });
    expect(r.success).toBe(true);
  });
});
