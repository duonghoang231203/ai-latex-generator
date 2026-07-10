import { describe, it, expect } from "vitest";
import {
  isMultiFile,
  getRootFile,
  getProjectFiles,
  validateProject,
  getRootContent,
  DEFAULT_ROOT_FILE,
} from "@/lib/store/project-document";
import type { ProjectFile } from "@/lib/types/document";

describe("project-document bridge (E1)", () => {
  it("isMultiFile: chỉ true khi có files không rỗng", () => {
    expect(isMultiFile({ files: undefined })).toBe(false);
    expect(isMultiFile({ files: [] })).toBe(false);
    expect(isMultiFile({ files: [{ path: "main.tex", content: "x" }] })).toBe(true);
  });

  it("single-file: getProjectFiles tổng hợp main.tex từ latex; getRootFile = main.tex", () => {
    const doc = { latex: "\\documentclass{article}...", files: undefined };
    const files = getProjectFiles(doc);
    expect(files).toEqual([{ path: DEFAULT_ROOT_FILE, content: doc.latex }]);
    expect(getRootFile(doc)).toBe(DEFAULT_ROOT_FILE);
  });

  it("multi-file: getProjectFiles giữ nguyên; getRootFile theo rootFile", () => {
    const files: ProjectFile[] = [
      { path: "main.tex", content: "root" },
      { path: "ch/1.tex", content: "one" },
    ];
    const doc = { files, rootFile: "main.tex", latex: "root" };
    expect(getProjectFiles(doc)).toBe(files);
    expect(getRootFile(doc)).toBe("main.tex");
  });

  it("getRootFile: multi-file thiếu rootFile → file đầu tiên", () => {
    expect(getRootFile({ files: [{ path: "a.tex", content: "" }] })).toBe("a.tex");
  });

  it("getRootContent: lấy nội dung file gốc trong dự án", () => {
    const doc = {
      files: [
        { path: "main.tex", content: "ROOT-BODY" },
        { path: "x.tex", content: "other" },
      ],
      rootFile: "main.tex",
      latex: "stale",
    };
    expect(getRootContent(doc)).toBe("ROOT-BODY");
  });

  describe("validateProject", () => {
    it("hợp lệ → chuẩn hoá path + trả rootFile", () => {
      const r = validateProject(
        [
          { path: "./main.tex", content: "a" },
          { path: "sections\\intro.tex", content: "b" },
        ],
        "./main.tex",
      );
      expect(r.ok).toBe(true);
      if (r.ok) {
        expect(r.files.map((f) => f.path)).toEqual(["main.tex", "sections/intro.tex"]);
        expect(r.rootFile).toBe("main.tex");
      }
    });

    it("từ chối rỗng / path traversal / trùng lặp / root ngoài danh sách", () => {
      expect(validateProject([], "main.tex").ok).toBe(false);
      expect(validateProject([{ path: "../evil.tex" }], "../evil.tex").ok).toBe(false);
      expect(
        validateProject(
          [
            { path: "a.tex" },
            { path: "a.tex" },
          ],
          "a.tex",
        ).ok,
      ).toBe(false);
      expect(
        validateProject([{ path: "main.tex" }], "other.tex").ok,
      ).toBe(false);
    });
  });
});
