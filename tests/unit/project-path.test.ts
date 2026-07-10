import { describe, it, expect } from "vitest";
import { sanitizeProjectPath, isSafeProjectPath } from "@/lib/compile/project-path";

describe("sanitizeProjectPath (E1 path-guard)", () => {
  it("chấp nhận đường dẫn tương đối sạch (kể cả thư mục con)", () => {
    expect(sanitizeProjectPath("main.tex")).toBe("main.tex");
    expect(sanitizeProjectPath("sections/intro.tex")).toBe("sections/intro.tex");
    expect(sanitizeProjectPath("a/b/c.tex")).toBe("a/b/c.tex");
  });

  it("bỏ qua segment '.' và backslash Windows → chuẩn hoá POSIX", () => {
    expect(sanitizeProjectPath("./main.tex")).toBe("main.tex");
    expect(sanitizeProjectPath("sections\\intro.tex")).toBe("sections/intro.tex");
    expect(sanitizeProjectPath("a/./b.tex")).toBe("a/b.tex");
  });

  it("từ chối traversal / tuyệt đối / ổ đĩa / null-byte / rỗng / non-string", () => {
    for (const bad of [
      "",
      "/etc/passwd",
      "../secret.tex",
      "a/../../b.tex",
      "..",
      "C:/Windows/x.tex",
      "sections/../../x.tex",
      "file\0.tex",
      undefined,
      null,
      42,
    ]) {
      expect(sanitizeProjectPath(bad as unknown)).toBeNull();
    }
  });

  it("isSafeProjectPath phản ánh sanitize", () => {
    expect(isSafeProjectPath("main.tex")).toBe(true);
    expect(isSafeProjectPath("../x")).toBe(false);
  });
});
