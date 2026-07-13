import { describe, it, expect } from "vitest";
import { validateDocumentInput } from "@/lib/validation/input";

const limits = { maxInputChars: 1000, maxSourceFiles: 5, maxSourceChars: 5000 };

describe("validateDocumentInput — inputFormat/markdown (E5)", () => {
  it("mặc định inputFormat = 'natural' khi không truyền", () => {
    const r = validateDocumentInput({ description: "xin chào", template: "academic" }, limits);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.value.inputFormat).toBe("natural");
      expect(r.value.markdown).toBeUndefined();
    }
  });

  it("markdown hợp lệ: cho phép mô tả trống, trả về markdown", () => {
    const r = validateDocumentInput(
      { inputFormat: "markdown", markdown: "# Tiêu đề\n\nnội dung", template: "academic" },
      limits,
    );
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.value.inputFormat).toBe("markdown");
      expect(r.value.markdown).toContain("# Tiêu đề");
    }
  });

  it("markdown rỗng → lỗi", () => {
    const r = validateDocumentInput({ inputFormat: "markdown", markdown: "   " }, limits);
    expect(r.ok).toBe(false);
  });

  it("markdown vượt maxInputChars → lỗi", () => {
    const r = validateDocumentInput(
      { inputFormat: "markdown", markdown: "x".repeat(1001) },
      limits,
    );
    expect(r.ok).toBe(false);
  });

  it("inputFormat sai → lỗi", () => {
    const r = validateDocumentInput(
      { inputFormat: "yaml", description: "x" },
      limits,
    );
    expect(r.ok).toBe(false);
  });
});
