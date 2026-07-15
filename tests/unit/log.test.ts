import { describe, it, expect, vi, afterEach } from "vitest";
import { buildLogRecord } from "@/lib/log";

describe("log.buildLogRecord", () => {
  it("có ts/level/event và giữ trường an toàn", () => {
    const r = buildLogRecord("info", "document.create", {
      id: "abc",
      attempts: 2,
      ok: true,
    });
    expect(r.level).toBe("info");
    expect(r.event).toBe("document.create");
    expect(r.id).toBe("abc");
    expect(r.attempts).toBe(2);
    expect(r.ok).toBe(true);
    expect(typeof r.ts).toBe("string");
  });

  it("che (redact) các trường nhạy cảm", () => {
    const r = buildLogRecord("info", "x", {
      apiKey: "sk-123",
      latex: "\\documentclass",
      description: "bí mật",
      content: "abc",
      id: "ok",
    });
    expect(r.apiKey).toBe("[redacted]");
    expect(r.latex).toBe("[redacted]");
    expect(r.description).toBe("[redacted]");
    expect(r.content).toBe("[redacted]");
    expect(r.id).toBe("ok");
  });

  it("bỏ qua trường undefined", () => {
    const r = buildLogRecord("warn", "x", { a: undefined, b: 1 });
    expect("a" in r).toBe(false);
    expect(r.b).toBe(1);
  });
});

describe("log.* — LOG_LEVEL filter (BE-5.3.5)", () => {
  const originalEnv = process.env.LOG_LEVEL;

  afterEach(() => {
    if (originalEnv === undefined) delete process.env.LOG_LEVEL;
    else process.env.LOG_LEVEL = originalEnv;
    vi.restoreAllMocks();
    vi.resetModules();
  });

  it("LOG_LEVEL=warn (mặc định info bị nâng ngưỡng) → log.info() KHÔNG ghi, log.warn()/log.error() vẫn ghi", async () => {
    process.env.LOG_LEVEL = "warn";
    vi.resetModules();
    const { log } = await import("@/lib/log");
    const spyLog = vi.spyOn(console, "log").mockImplementation(() => {});
    const spyWarn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const spyError = vi.spyOn(console, "error").mockImplementation(() => {});

    log.info("should.not.appear");
    log.warn("should.appear.warn");
    log.error("should.appear.error");

    expect(spyLog).not.toHaveBeenCalled();
    expect(spyWarn).toHaveBeenCalledTimes(1);
    expect(spyError).toHaveBeenCalledTimes(1);
  });

  it("LOG_LEVEL không đặt (mặc định) → log.info() vẫn ghi (hành vi hiện tại, không đổi)", async () => {
    delete process.env.LOG_LEVEL;
    vi.resetModules();
    const { log } = await import("@/lib/log");
    const spyLog = vi.spyOn(console, "log").mockImplementation(() => {});

    log.info("still.appears");

    expect(spyLog).toHaveBeenCalledTimes(1);
  });

  it("LOG_LEVEL=error → chỉ log.error() ghi, log.info()/log.warn() đều bị bỏ qua", async () => {
    process.env.LOG_LEVEL = "error";
    vi.resetModules();
    const { log } = await import("@/lib/log");
    const spyLog = vi.spyOn(console, "log").mockImplementation(() => {});
    const spyWarn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const spyError = vi.spyOn(console, "error").mockImplementation(() => {});

    log.info("skip");
    log.warn("skip");
    log.error("keep");

    expect(spyLog).not.toHaveBeenCalled();
    expect(spyWarn).not.toHaveBeenCalled();
    expect(spyError).toHaveBeenCalledTimes(1);
  });

  it("LOG_LEVEL giá trị không hợp lệ → fallback 'info' (ghi cả 3 mức, không throw)", async () => {
    process.env.LOG_LEVEL = "verbose"; // không hợp lệ
    vi.resetModules();
    const { log } = await import("@/lib/log");
    const spyLog = vi.spyOn(console, "log").mockImplementation(() => {});

    expect(() => log.info("still.works")).not.toThrow();
    expect(spyLog).toHaveBeenCalledTimes(1);
  });
});
