import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { promises as fs } from "node:fs";
import path from "node:path";
import os from "node:os";
import { randomUUID } from "node:crypto";
import {
  createDocument,
  getDocument,
  listDocuments,
  updateDocument,
  appendMessages,
  deleteDocument,
  isValidId,
  newMessage,
} from "@/lib/store/documentStore";

let dir: string;

beforeEach(async () => {
  dir = path.join(os.tmpdir(), `latexgen-store-${randomUUID()}`);
  process.env.DATA_DIR = dir;
});
afterEach(async () => {
  await fs.rm(dir, { recursive: true, force: true });
  delete process.env.DATA_DIR;
});

function baseInput() {
  return {
    title: "Tài liệu test",
    docType: "article" as const,
    template: "academic" as const,
    description: "mô tả",
    latex: "\\documentclass{article}\\begin{document}x\\end{document}",
    pdfBase64: "UERG",
    attempts: 1,
  };
}

describe("documentStore", () => {
  it("isValidId chặn path traversal", () => {
    expect(isValidId("abc-123_XYZ")).toBe(true);
    expect(isValidId("../etc/passwd")).toBe(false);
    expect(isValidId("a/b")).toBe(false);
    expect(isValidId("")).toBe(false);
  });

  it("create → get trả đúng nội dung, có id/timestamps/messages", async () => {
    const doc = await createDocument(baseInput());
    expect(isValidId(doc.id)).toBe(true);
    expect(doc.messages).toEqual([]);
    expect(doc.createdAt).toBeTruthy();
    const got = await getDocument(doc.id);
    expect(got?.title).toBe("Tài liệu test");
    expect(got?.latex).toContain("documentclass");
  });

  it("get id không hợp lệ / không tồn tại → null", async () => {
    expect(await getDocument("../secret")).toBeNull();
    expect(await getDocument("khongton-tai")).toBeNull();
  });

  it("list trả summary (không kèm latex), sắp xếp updatedAt giảm dần", async () => {
    const a = await createDocument({ ...baseInput(), title: "A" });
    await new Promise((r) => setTimeout(r, 5));
    const b = await createDocument({ ...baseInput(), title: "B" });
    const list = await listDocuments();
    expect(list.length).toBe(2);
    expect(list[0].id).toBe(b.id); // mới cập nhật gần nhất lên đầu
    expect((list[0] as unknown as { latex?: string }).latex).toBeUndefined();
    expect(list.map((d) => d.id).sort()).toEqual([a.id, b.id].sort());
    expect(list.find((d) => d.id === a.id)?.hasPdf).toBe(true);
  });

  it("list: isProject=false cho tài liệu single-file, true khi có files[] không rỗng", async () => {
    const single = await createDocument(baseInput());
    const project = await createDocument({
      ...baseInput(),
      files: [{ path: "main.tex", content: baseInput().latex }],
      rootFile: "main.tex",
    });
    const list = await listDocuments();
    expect(list.find((d) => d.id === single.id)?.isProject).toBe(false);
    expect(list.find((d) => d.id === project.id)?.isProject).toBe(true);
  });

  it("update merge trường & đổi updatedAt, giữ createdAt", async () => {
    const doc = await createDocument(baseInput());
    await new Promise((r) => setTimeout(r, 5));
    const updated = await updateDocument(doc.id, { title: "Đã đổi" });
    expect(updated?.title).toBe("Đã đổi");
    expect(updated?.createdAt).toBe(doc.createdAt);
    expect(updated?.updatedAt).not.toBe(doc.createdAt);
  });

  it("update id không tồn tại → null", async () => {
    expect(await updateDocument("khong-ton-tai", { title: "x" })).toBeNull();
  });

  it("appendMessages nối lịch sử chat", async () => {
    const doc = await createDocument(baseInput());
    const m1 = newMessage("user", "thêm mục kết luận");
    const m2 = newMessage("assistant", "đã cập nhật");
    const updated = await appendMessages(doc.id, [m1, m2]);
    expect(updated?.messages.map((m) => m.content)).toEqual([
      "thêm mục kết luận",
      "đã cập nhật",
    ]);
  });

  it("delete xoá file & trả boolean", async () => {
    const doc = await createDocument(baseInput());
    expect(await deleteDocument(doc.id)).toBe(true);
    expect(await getDocument(doc.id)).toBeNull();
    expect(await deleteDocument(doc.id)).toBe(false);
    expect(await deleteDocument("../x")).toBe(false);
  });
});
