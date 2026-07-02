import { describe, it, expect } from "vitest";
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
