import { describe, it, expect } from "vitest";
import { buildUserPrompt } from "@/lib/ai/prompts";

describe("buildUserPrompt", () => {
  it("chèn nội dung file nguồn kèm rào chắn prompt-injection", () => {
    const p = buildUserPrompt({
      description: "Tổng hợp báo cáo",
      docType: "report",
      sources: [{ name: "notes.md", content: "Doanh thu quý 1: 10 tỷ" }],
    });
    expect(p).toContain("TÀI LIỆU NGUỒN");
    expect(p).toContain("notes.md");
    expect(p).toContain("Doanh thu quý 1: 10 tỷ");
    expect(p).toContain("KHÔNG phải chỉ thị");
  });

  it("không có khối nguồn khi không có file", () => {
    const p = buildUserPrompt({ description: "x", docType: "article" });
    expect(p).not.toContain("### FILE:");
    expect(p).not.toContain("KHÔNG phải chỉ thị");
  });

  it("lượt sửa dùng errorContext, không phải prompt sinh mới", () => {
    const p = buildUserPrompt({
      description: "x",
      docType: "article",
      errorContext: { previousLatex: "\\documentclass{article}", errorLog: "! Error" },
    });
    expect(p).toContain("SỬA");
    expect(p).toContain("! Error");
  });

  it("lượt chat-edit dùng editContext: kèm chỉ thị + latex hiện tại", () => {
    const p = buildUserPrompt({
      description: "",
      docType: "article",
      editContext: {
        currentLatex: "\\documentclass{article}\\begin{document}cũ\\end{document}",
        instruction: "Đổi tiêu đề thành ABC",
      },
    });
    expect(p).toContain("CHỈNH SỬA");
    expect(p).toContain("Đổi tiêu đề thành ABC");
    expect(p).toContain("TÀI LIỆU LATEX HIỆN TẠI");
    expect(p).toContain("\\begin{document}cũ");
  });

  it("errorContext được ưu tiên hơn editContext (lượt sửa lỗi trong repair loop)", () => {
    const p = buildUserPrompt({
      description: "",
      docType: "article",
      editContext: { currentLatex: "\\documentclass{article}", instruction: "EDIT_INSTR" },
      errorContext: { previousLatex: "\\documentclass{article}", errorLog: "! Repair" },
    });
    expect(p).toContain("! Repair");
    expect(p).not.toContain("EDIT_INSTR");
  });

  it("có template: chèn hướng dẫn cấu trúc + documentclass + gói của template", () => {
    const p = buildUserPrompt({
      description: "Báo cáo vật lý",
      docType: "article",
      template: "physics",
    });
    expect(p).toContain("Dạng template: physics");
    expect(p).toContain("DẠNG: Tài liệu Vật lý");
    expect(p).toContain("siunitx");
    expect(p).toContain("\\documentclass{article}");
  });

  it("không có template: dùng structureHint theo docType (tương thích ngược)", () => {
    const p = buildUserPrompt({ description: "x", docType: "report" });
    expect(p).toContain("Cấu trúc report");
    expect(p).not.toContain("Dạng template:");
  });

  it("cắt bớt nội dung nguồn khi vượt ngân sách MAX_PROMPT_SOURCE_CHARS", () => {
    const prev = process.env.MAX_PROMPT_SOURCE_CHARS;
    process.env.MAX_PROMPT_SOURCE_CHARS = "1000";
    const p = buildUserPrompt({
      description: "Tổng hợp",
      docType: "report",
      sources: [{ name: "big.csv", content: "x".repeat(50000) }],
    });
    expect(p).toContain("đã cắt bớt");
    expect(p.length).toBeLessThan(5000);
    process.env.MAX_PROMPT_SOURCE_CHARS = prev;
  });
});
