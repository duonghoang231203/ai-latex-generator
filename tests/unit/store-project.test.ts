import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { promises as fs } from "node:fs";
import path from "node:path";
import os from "node:os";
import { randomUUID } from "node:crypto";
import {
  createDocument,
  getDocument,
  updateDocument,
} from "@/lib/store/documentStore";
import type { ProjectFile } from "@/lib/types/document";

let dir: string;

beforeEach(() => {
  dir = path.join(os.tmpdir(), `latexgen-store-proj-${randomUUID()}`);
  process.env.DATA_DIR = dir;
});
afterEach(async () => {
  await fs.rm(dir, { recursive: true, force: true });
  delete process.env.DATA_DIR;
});

const files: ProjectFile[] = [
  { path: "main.tex", content: "\\documentclass{report}...\\input{ch1}" },
  { path: "ch1.tex", content: "\\chapter{Một}" },
];

function projectInput() {
  return {
    title: "Dự án multi-file",
    docType: "report" as const,
    template: "thesis" as const,
    description: "mô tả",
    latex: files[0].content, // quy ước: latex = nội dung file gốc
    attempts: 1,
    files,
    rootFile: "main.tex",
  };
}

describe("documentStore — multi-file (E1)", () => {
  it("create → get: giữ nguyên files + rootFile", async () => {
    const doc = await createDocument(projectInput());
    const got = await getDocument(doc.id);
    expect(got?.files).toHaveLength(2);
    expect(got?.files?.map((f) => f.path)).toEqual(["main.tex", "ch1.tex"]);
    expect(got?.rootFile).toBe("main.tex");
  });

  it("readDoc migration: files có nhưng thiếu rootFile → mặc định file đầu", async () => {
    const doc = await createDocument(projectInput());
    // Ghi đè file JSON, xoá rootFile để mô phỏng dữ liệu cũ.
    const file = path.join(dir, "documents", `${doc.id}.json`);
    const raw = JSON.parse(await fs.readFile(file, "utf8"));
    delete raw.rootFile;
    await fs.writeFile(file, JSON.stringify(raw), "utf8");

    const got = await getDocument(doc.id);
    expect(got?.rootFile).toBe("main.tex"); // = files[0].path
  });

  it("update: có thể cập nhật files/rootFile", async () => {
    const doc = await createDocument(projectInput());
    const newFiles: ProjectFile[] = [
      { path: "main.tex", content: "\\documentclass{report}...\\input{ch1}\\input{ch2}" },
      { path: "ch1.tex", content: "\\chapter{Một}" },
      { path: "ch2.tex", content: "\\chapter{Hai}" },
    ];
    const updated = await updateDocument(doc.id, { files: newFiles });
    expect(updated?.files).toHaveLength(3);
    const got = await getDocument(doc.id);
    expect(got?.files?.map((f) => f.path)).toContain("ch2.tex");
  });

  it("tài liệu single-file (không files) đọc lại: files undefined", async () => {
    const doc = await createDocument({
      title: "single",
      docType: "article" as const,
      template: "general" as const,
      description: "x",
      latex: "\\documentclass{article}\\begin{document}x\\end{document}",
      attempts: 1,
    });
    const got = await getDocument(doc.id);
    expect(got?.files).toBeUndefined();
    expect(got?.latex).toContain("documentclass");
  });
});
