import { describe, it, expect, vi } from "vitest";
import { classify, extractText, type ExtractHandlers } from "@/lib/extract/extract";

const opts = { maxUploadBytes: 1000, ocrEnabled: true, ocrLangs: "vie+eng" };

function bytes(s: string): Uint8Array {
  return new TextEncoder().encode(s);
}

function fakeHandlers(over: Partial<ExtractHandlers> = {}): ExtractHandlers {
  return {
    pdf: vi.fn(async () => "PDF TEXT"),
    docx: vi.fn(async () => "DOCX TEXT"),
    ocr: vi.fn(async () => "OCR TEXT"),
    ...over,
  };
}

describe("classify", () => {
  it("phân loại theo phần mở rộng", () => {
    expect(classify("a.pdf", "")).toBe("pdf");
    expect(classify("a.docx", "")).toBe("docx");
    expect(classify("a.png", "")).toBe("image");
    expect(classify("a.jpg", "")).toBe("image");
    expect(classify("a.md", "")).toBe("text");
    expect(classify("a.csv", "")).toBe("text");
  });
  it("phân loại theo MIME khi thiếu đuôi", () => {
    expect(classify("blob", "application/pdf")).toBe("pdf");
    expect(classify("blob", "image/png")).toBe("image");
    expect(classify("blob", "text/plain")).toBe("text");
  });
  it("định dạng không hỗ trợ → null (vd .doc cũ)", () => {
    expect(classify("a.doc", "application/msword")).toBeNull();
    expect(classify("a.zip", "application/zip")).toBeNull();
  });
});

describe("extractText", () => {
  it("text: decode UTF-8 trực tiếp (không gọi handler)", async () => {
    const h = fakeHandlers();
    const r = await extractText({ name: "n.md", mimeType: "", bytes: bytes("Xin chào") }, opts, h);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.kind).toBe("text");
      expect(r.content).toBe("Xin chào");
    }
    expect(h.pdf).not.toHaveBeenCalled();
  });

  it("pdf: gọi handler pdf", async () => {
    const h = fakeHandlers();
    const r = await extractText({ name: "n.pdf", mimeType: "", bytes: bytes("%PDF") }, opts, h);
    expect(r.ok && r.content).toBe("PDF TEXT");
    expect(h.pdf).toHaveBeenCalledOnce();
  });

  it("docx: gọi handler docx", async () => {
    const h = fakeHandlers();
    const r = await extractText({ name: "n.docx", mimeType: "", bytes: bytes("PK") }, opts, h);
    expect(r.ok && r.content).toBe("DOCX TEXT");
    expect(h.docx).toHaveBeenCalledOnce();
  });

  it("image + OCR bật: gọi handler ocr với đúng ngôn ngữ", async () => {
    const h = fakeHandlers();
    const r = await extractText({ name: "n.png", mimeType: "", bytes: bytes("\x89PNG") }, opts, h);
    expect(r.ok && r.content).toBe("OCR TEXT");
    expect(h.ocr).toHaveBeenCalledWith(expect.anything(), "vie+eng");
  });

  it("image + OCR tắt: trả lỗi, không gọi ocr", async () => {
    const h = fakeHandlers();
    const r = await extractText(
      { name: "n.png", mimeType: "", bytes: bytes("x") },
      { ...opts, ocrEnabled: false },
      h,
    );
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toContain("OCR đang tắt");
    expect(h.ocr).not.toHaveBeenCalled();
  });

  it("tệp rỗng → lỗi", async () => {
    const r = await extractText({ name: "n.pdf", mimeType: "", bytes: new Uint8Array(0) }, opts, fakeHandlers());
    expect(r.ok).toBe(false);
  });

  it("tệp quá lớn → lỗi", async () => {
    const big = new Uint8Array(opts.maxUploadBytes + 1);
    big.fill(65);
    const r = await extractText({ name: "n.txt", mimeType: "", bytes: big }, opts, fakeHandlers());
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toContain("quá lớn");
  });

  it("định dạng không hỗ trợ → lỗi", async () => {
    const r = await extractText({ name: "n.zip", mimeType: "application/zip", bytes: bytes("x") }, opts, fakeHandlers());
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toContain("không hỗ trợ");
  });

  it("nội dung trích xuất rỗng → lỗi", async () => {
    const h = fakeHandlers({ pdf: async () => "   " });
    const r = await extractText({ name: "n.pdf", mimeType: "", bytes: bytes("x") }, opts, h);
    expect(r.ok).toBe(false);
  });

  it("handler ném lỗi → trả lỗi thân thiện", async () => {
    const h = fakeHandlers({ ocr: async () => { throw new Error("model fail"); } });
    const r = await extractText({ name: "n.png", mimeType: "", bytes: bytes("x") }, opts, h);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toContain("model fail");
  });
});
