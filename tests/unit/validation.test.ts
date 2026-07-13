import { describe, it, expect } from "vitest";
import { validateLatex } from "@/lib/validation/validate";
import { sanitizeLatex, remapFonts, stripUnresolvableFonts } from "@/lib/ai/sanitize";
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

describe("stripUnresolvableFonts (lỗi font khi Tectonic không có fontconfig)", () => {
  it("bỏ \\babelfont{rm}{Latin Modern Roman} (nguyên nhân lỗi báo cáo)", () => {
    const out = stripUnresolvableFonts("\\babelfont{rm}{Latin Modern Roman}\n");
    expect(out).not.toContain("\\babelfont");
    expect(out).not.toContain("Latin Modern Roman");
  });

  it("bỏ \\babelfont kèm option ngôn ngữ và features", () => {
    const out = stripUnresolvableFonts(
      "\\babelfont[english]{rm}[Scale=1]{TeX Gyre Termes}\n",
    );
    expect(out).not.toContain("\\babelfont");
  });

  it("bỏ \\setmainfont{Latin Modern Roman} (thừa với mặc định)", () => {
    expect(stripUnresolvableFonts("\\setmainfont{Latin Modern Roman}").trim()).toBe("");
    expect(stripUnresolvableFonts("\\setmonofont{LMMono}").trim()).toBe("");
  });

  it("giữ nguyên font khác Latin Modern (Docker có fontconfig)", () => {
    expect(stripUnresolvableFonts("\\setmainfont{TeX Gyre Termes}")).toBe(
      "\\setmainfont{TeX Gyre Termes}",
    );
  });

  it("sanitizeLatex sửa đúng tài liệu gây lỗi (babel english + babelfont Latin Modern)", () => {
    const raw = [
      "\\documentclass{article}",
      "\\usepackage{geometry}",
      "\\usepackage{fontspec}",
      "\\usepackage[english]{babel}",
      "\\babelfont{rm}{Latin Modern Roman}",
      "\\begin{document}",
      "Xin chào",
      "\\end{document}",
    ].join("\n");
    const r = sanitizeLatex(raw);
    expect(r.ok).toBe(true);
    expect(r.latex).not.toContain("\\babelfont");
    expect(r.latex).not.toContain("Latin Modern Roman");
    // Giữ lại phần còn lại của tài liệu.
    expect(r.latex).toContain("\\usepackage{fontspec}");
    expect(r.latex).toContain("\\usepackage[english]{babel}");
    expect(r.latex).toContain("\\begin{document}");
  });
});


// ─── packageAllowlist ─────────────────────────────────────────────────────

describe("validateLatex — packageAllowlist", () => {
  const allowlist = ["geometry", "amsmath"];

  it("passes when all packages are in the allowlist", () => {
    const latex = [
      "\\documentclass{article}",
      "\\usepackage{geometry}",
      "\\usepackage{amsmath}",
      "\\begin{document}x\\end{document}",
    ].join("\n");
    const r = validateLatex(latex, { packageAllowlist: allowlist });
    expect(r.ok).toBe(true);
  });

  it("fontspec is always allowed even if not in allowlist", () => {
    const latex = [
      "\\documentclass{article}",
      "\\usepackage{fontspec}",
      "\\usepackage{geometry}",
      "\\begin{document}x\\end{document}",
    ].join("\n");
    const r = validateLatex(latex, { packageAllowlist: allowlist });
    expect(r.ok).toBe(true);
  });

  it("flags a package outside the allowlist", () => {
    const latex = [
      "\\documentclass{article}",
      "\\usepackage{geometry}",
      "\\usepackage{tikz}",
      "\\begin{document}x\\end{document}",
    ].join("\n");
    const r = validateLatex(latex, { packageAllowlist: allowlist });
    expect(r.ok).toBe(false);
    expect(r.diagnostics.some((d) => d.message.includes("tikz"))).toBe(true);
  });

  it("handles multi-package {a,b,c} syntax", () => {
    const latex = [
      "\\documentclass{article}",
      "\\usepackage{geometry,amsmath,tikz}",
      "\\begin{document}x\\end{document}",
    ].join("\n");
    const r = validateLatex(latex, { packageAllowlist: allowlist });
    expect(r.ok).toBe(false);
    expect(r.diagnostics.some((d) => d.message.includes("tikz"))).toBe(true);
  });

  it("no allowlist → no package check", () => {
    const latex = [
      "\\documentclass{article}",
      "\\usepackage{anypackage}",
      "\\begin{document}x\\end{document}",
    ].join("\n");
    const r = validateLatex(latex);
    // Only environment/syntax checks run — no package error
    expect(r.diagnostics.every((d) => !d.message.includes("allowlist"))).toBe(true);
  });
});

// ─── Math-specific checks ─────────────────────────────────────────────────

const MATH_ENVS = ["theorem", "lemma", "corollary", "proposition", "definition", "example", "remark", "proof"];

describe("validateLatex — undefined theorem environments", () => {
  it("passes for all known math environments", () => {
    const latex = [
      "\\documentclass{article}",
      "\\usepackage{amsthm}",
      "\\newtheorem{theorem}{Theorem}",
      "\\begin{document}",
      "\\begin{theorem} A statement. \\end{theorem}",
      "\\begin{proof} Proof. \\end{proof}",
      "\\end{document}",
    ].join("\n");
    const r = validateLatex(latex, { knownTheoremEnvironments: MATH_ENVS });
    // Only check there is no "Undefined environment" diagnostic
    expect(r.diagnostics.filter((d) => d.message.startsWith("Undefined environment"))).toHaveLength(0);
  });

  it("flags an environment not in the known list", () => {
    const latex = [
      "\\documentclass{article}",
      "\\begin{document}",
      "\\begin{mythm} A statement. \\end{mythm}",
      "\\end{document}",
    ].join("\n");
    const r = validateLatex(latex, { knownTheoremEnvironments: MATH_ENVS });
    expect(r.ok).toBe(false);
    expect(r.diagnostics.some((d) => d.message.includes("mythm"))).toBe(true);
  });

  it("structural environments (equation, align, itemize, ...) are always allowed", () => {
    const latex = [
      "\\documentclass{article}",
      "\\begin{document}",
      "\\begin{equation} x = 1 \\end{equation}",
      "\\begin{align} y &= 2 \\end{align}",
      "\\begin{itemize}\\item A\\end{itemize}",
      "\\end{document}",
    ].join("\n");
    const r = validateLatex(latex, { knownTheoremEnvironments: MATH_ENVS });
    expect(r.diagnostics.filter((d) => d.message.startsWith("Undefined environment"))).toHaveLength(0);
  });

  it("does not run when knownTheoremEnvironments is not set", () => {
    const latex = [
      "\\documentclass{article}",
      "\\begin{document}",
      "\\begin{myenv} x \\end{myenv}",
      "\\end{document}",
    ].join("\n");
    // Without knownTheoremEnvironments, no undefined-env check
    const r = validateLatex(latex);
    expect(r.diagnostics.filter((d) => d.message.startsWith("Undefined environment"))).toHaveLength(0);
  });
});

describe("validateLatex — duplicate labels", () => {
  it("passes when all labels are unique", () => {
    const latex = [
      "\\documentclass{article}",
      "\\begin{document}",
      "\\begin{equation}\\label{eq:one} x=1 \\end{equation}",
      "\\begin{equation}\\label{eq:two} y=2 \\end{equation}",
      "\\end{document}",
    ].join("\n");
    const r = validateLatex(latex, { knownTheoremEnvironments: MATH_ENVS });
    expect(r.diagnostics.filter((d) => d.message.includes("Duplicate label"))).toHaveLength(0);
  });

  it("flags a label defined twice", () => {
    const latex = [
      "\\documentclass{article}",
      "\\begin{document}",
      "\\begin{equation}\\label{eq:main} x=1 \\end{equation}",
      "\\begin{equation}\\label{eq:main} y=2 \\end{equation}",
      "\\end{document}",
    ].join("\n");
    const r = validateLatex(latex, { knownTheoremEnvironments: MATH_ENVS });
    expect(r.ok).toBe(false);
    expect(r.diagnostics.some((d) => d.message.includes("Duplicate label") && d.message.includes("eq:main"))).toBe(true);
  });
});

describe("validateLatex — broken references", () => {
  it("passes when all \\ref point to existing labels", () => {
    const latex = [
      "\\documentclass{article}",
      "\\begin{document}",
      "\\begin{equation}\\label{eq:one} x=1 \\end{equation}",
      "See Equation~\\eqref{eq:one}.",
      "\\end{document}",
    ].join("\n");
    const r = validateLatex(latex, { knownTheoremEnvironments: MATH_ENVS });
    expect(r.diagnostics.filter((d) => d.message.includes("Broken reference"))).toHaveLength(0);
  });

  it("flags \\eqref pointing to a non-existent label", () => {
    const latex = [
      "\\documentclass{article}",
      "\\begin{document}",
      "See Equation~\\eqref{eq:missing}.",
      "\\end{document}",
    ].join("\n");
    const r = validateLatex(latex, { knownTheoremEnvironments: MATH_ENVS });
    expect(r.ok).toBe(false);
    expect(r.diagnostics.some((d) => d.message.includes("eq:missing"))).toBe(true);
  });

  it("flags \\ref pointing to a non-existent label", () => {
    const latex = [
      "\\documentclass{article}",
      "\\begin{document}",
      "See Theorem~\\ref{thm:missing}.",
      "\\end{document}",
    ].join("\n");
    const r = validateLatex(latex, { knownTheoremEnvironments: MATH_ENVS });
    expect(r.ok).toBe(false);
    expect(r.diagnostics.some((d) => d.message.includes("thm:missing"))).toBe(true);
  });

  it("does not run broken-ref check when knownTheoremEnvironments is not set", () => {
    const latex = [
      "\\documentclass{article}",
      "\\begin{document}",
      "See~\\ref{nonexistent}.",
      "\\end{document}",
    ].join("\n");
    const r = validateLatex(latex);
    expect(r.diagnostics.filter((d) => d.message.includes("Broken reference"))).toHaveLength(0);
  });
});
