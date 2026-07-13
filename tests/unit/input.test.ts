import { describe, it, expect } from "vitest";
import { validateDocumentInput } from "@/lib/validation/input";

const limits = { maxInputChars: 20000, maxSourceFiles: 10, maxSourceChars: 1000 };

describe("validateDocumentInput với sources", () => {
  it("cho phép mô tả trống nếu có file nguồn", () => {
    const r = validateDocumentInput(
      { description: "", docType: "report", sources: [{ name: "a.md", content: "nội dung" }] },
      limits,
    );
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value.sources).toHaveLength(1);
  });

  it("từ chối khi vừa trống mô tả vừa không có nguồn", () => {
    const r = validateDocumentInput({ description: "  ", docType: "article" }, limits);
    expect(r.ok).toBe(false);
  });

  it("từ chối khi vượt số file nguồn", () => {
    const sources = Array.from({ length: 11 }, (_, i) => ({ name: `f${i}`, content: "x" }));
    const r = validateDocumentInput({ description: "x", sources }, limits);
    expect(r.ok).toBe(false);
  });

  it("từ chối khi tổng ký tự nguồn vượt giới hạn", () => {
    const r = validateDocumentInput(
      { description: "x", sources: [{ name: "big", content: "y".repeat(1001) }] },
      limits,
    );
    expect(r.ok).toBe(false);
  });

  it("từ chối source sai định dạng", () => {
    const r = validateDocumentInput(
      { description: "x", sources: [{ name: 123, content: "y" }] },
      limits,
    );
    expect(r.ok).toBe(false);
  });
});

describe("validateDocumentInput với template", () => {
  it("template hợp lệ → suy ra docType từ lớp nền (thesis→report)", () => {
    const r = validateDocumentInput({ description: "x", template: "thesis" }, limits);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.value.template).toBe("thesis");
      expect(r.value.docType).toBe("report");
    }
  });

  it("template hợp lệ dạng article (math→article)", () => {
    const r = validateDocumentInput({ description: "x", template: "math" }, limits);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.value.template).toBe("math");
      expect(r.value.docType).toBe("article");
    }
  });

  it("template không hợp lệ → lỗi", () => {
    const r = validateDocumentInput({ description: "x", template: "khong-co" }, limits);
    expect(r.ok).toBe(false);
  });

  it("không có template, chỉ docType → suy ra template mặc định (report→thesis)", () => {
    const r = validateDocumentInput({ description: "x", docType: "report" }, limits);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.value.docType).toBe("report");
      expect(r.value.template).toBe("thesis");
    }
  });

  it("không có template lẫn docType → mặc định article/academic", () => {
    const r = validateDocumentInput({ description: "x" }, limits);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.value.docType).toBe("article");
      expect(r.value.template).toBe("academic");
    }
  });
});
