import { describe, it, expect } from "vitest";
import { validateLatex } from "@/lib/validation/validate";
import { sanitizeLatex, remapFonts } from "@/lib/ai/sanitize";
import { validLatex, invalidLatex } from "@/lib/ai/mock";

describe("validateLatex", () => {
  it("chấp nhận tài liệu hợp lệ", () => {
    const r = validateLatex(validLatex("nội dung", "article"));
    expect(r.ok).toBe(true);
    expect(r.diagnostics).toHaveLength(0);
  });

  it("bắt môi trường chưa đóng", () => {
    const r = validateLatex(invalidLatex("article"));
    expect(r.ok).toBe(false);
    expect(r.diagnostics.some((d) => /chưa đóng|không khớp/.test(d.message))).toBe(true);
  });

  it("bắt \\end thừa", () => {
    const latex =
      "\\documentclass{article}\\begin{document}\\end{itemize}\\end{document}";
    const r = validateLatex(latex);
    expect(r.ok).toBe(false);
  });

  it("bắt lỗi cú pháp (brace không cân) qua parser", () => {
    const latex =
      "\\documentclass{article}\\begin{document}\\textbf{hi\\end{document}";
    const r = validateLatex(latex);
    expect(r.ok).toBe(false);
  });
});

describe("sanitizeLatex", () => {
  it("bóc code fence ```latex", () => {
    const raw =
      "```latex\n\\documentclass{article}\\begin{document}Hi\\end{document}\n```";
    const r = sanitizeLatex(raw);
    expect(r.ok).toBe(true);
    expect(r.latex).not.toContain("```");
  });

  it("cắt văn xuôi thừa trước \\documentclass", () => {
    const raw =
      "Đây là tài liệu:\n\\documentclass{article}\\begin{document}Hi\\end{document}";
    const r = sanitizeLatex(raw);
    expect(r.latex.startsWith("\\documentclass")).toBe(true);
  });

  it("báo không hợp lệ khi thiếu cấu trúc", () => {
    const r = sanitizeLatex("chỉ là văn bản thường");
    expect(r.ok).toBe(false);
  });
});

describe("remapFonts", () => {
  it("đổi Times New Roman → Liberation Serif", () => {
    expect(remapFonts("\\setmainfont{Times New Roman}")).toBe(
      "\\setmainfont{Liberation Serif}",
    );
  });

  it("giữ nguyên font hợp lệ", () => {
    expect(remapFonts("\\setmainfont{TeX Gyre Termes}")).toBe(
      "\\setmainfont{TeX Gyre Termes}",
    );
  });

  it("xử lý cả \\setsansfont với option", () => {
    expect(remapFonts("\\setsansfont[Scale=1]{Arial}")).toBe(
      "\\setsansfont[Scale=1]{Liberation Sans}",
    );
  });

  it("sanitizeLatex áp dụng remap font trong tài liệu đầy đủ", () => {
    const raw =
      "\\documentclass{article}\\usepackage{fontspec}\\setmainfont{Times New Roman}\\begin{document}Hi\\end{document}";
    const r = sanitizeLatex(raw);
    expect(r.ok).toBe(true);
    expect(r.latex).toContain("Liberation Serif");
    expect(r.latex).not.toContain("Times New Roman");
  });
});
