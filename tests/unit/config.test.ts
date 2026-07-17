// tests/unit/config.test.ts
// E1a: maxProjectBytes/maxProjectFiles — mirror mặc định của compile-service (MAX_PROJECT_BYTES=
// 5_000_000, MAX_PROJECT_FILES=100), đọc được qua env var override giống các giới hạn khác.
import { describe, it, expect, afterEach } from "vitest";
import { getConfig } from "@/lib/config";

afterEach(() => {
  delete process.env.MAX_PROJECT_BYTES;
  delete process.env.MAX_PROJECT_FILES;
});

describe("getConfig — multi-file project limits (E1a)", () => {
  it("mặc định khớp compile-service (5_000_000 bytes / 100 file)", () => {
    const cfg = getConfig();
    expect(cfg.maxProjectBytes).toBe(5_000_000);
    expect(cfg.maxProjectFiles).toBe(100);
  });

  it("đọc override từ env var", () => {
    process.env.MAX_PROJECT_BYTES = "123456";
    process.env.MAX_PROJECT_FILES = "7";
    const cfg = getConfig();
    expect(cfg.maxProjectBytes).toBe(123456);
    expect(cfg.maxProjectFiles).toBe(7);
  });

  it("giá trị không hợp lệ (NaN/<=0) → rơi về mặc định", () => {
    process.env.MAX_PROJECT_BYTES = "abc";
    process.env.MAX_PROJECT_FILES = "-1";
    const cfg = getConfig();
    expect(cfg.maxProjectBytes).toBe(5_000_000);
    expect(cfg.maxProjectFiles).toBe(100);
  });
});
