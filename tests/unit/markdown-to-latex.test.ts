import { describe, it, expect } from "vitest";
import { convertMarkdownToLatexBody } from "@/lib/markdown/markdown-to-latex";
import { escapeLatexText } from "@/lib/markdown/latex-escape";

describe("escapeLatexText", () => {
  it("escape ký tự đặc biệt vùng text", () => {
    expect(escapeLatexText("a & b % c $ d # e _ f { } ")).toContain("\\&");
    expect(escapeLatexText("100%")).toBe("100\\%");
    expect(escapeLatexText("a_b")).toBe("a\\_b");
  });
  it("backslash → \\textbackslash{} (không escape lặp)", () => {
    expect(escapeLatexText("a\\b")).toBe("a\\textbackslash{}b");
  });
  it("~ và ^ thành lệnh riêng", () => {
    expect(escapeLatexText("~")).toBe("\\textasciitilde{}");
    expect(escapeLatexText("^")).toBe("\\textasciicircum{}");
  });
});

describe("convertMarkdownToLatexBody", () => {
  const conv = (md: string, cls: "article" | "report" = "article") =>
    convertMarkdownToLatexBody(md, { documentClass: cls });

  it("heading article: # → section, ## → subsection", () => {
    const { body } = conv("# Tiêu đề\n\n## Mục con");
    expect(body).toContain("\\section{Tiêu đề}");
    expect(body).toContain("\\subsection{Mục con}");
  });

  it("heading report: # → chapter", () => {
    const { body } = conv("# Chương 1", "report");
    expect(body).toContain("\\chapter{Chương 1}");
  });

  it("bold/italic/inline code", () => {
    const { body } = conv("Đây **đậm** và *nghiêng* và `code`.");
    expect(body).toContain("\\textbf{đậm}");
    expect(body).toContain("\\emph{nghiêng}");
    expect(body).toContain("\\texttt{code}");
  });

  it("bảo toàn số heading (cấu trúc)", () => {
    const md = "# A\n\n## B\n\n## C\n\n### D";
    const { body } = conv(md);
    const count = (body.match(/\\(section|subsection|subsubsection|chapter)\{/g) ?? []).length;
    expect(count).toBe(4);
  });

  it("danh sách không đánh số → itemize; có số → enumerate", () => {
    const bullets = conv("- a\n- b").body;
    expect(bullets).toContain("\\begin{itemize}");
    expect(bullets).toContain("\\item a");
    const ordered = conv("1. a\n2. b").body;
    expect(ordered).toContain("\\begin{enumerate}");
  });

  it("code fence → lstlisting + gói listings (KHÔNG minted)", () => {
    const { body, requiredPackages } = conv("```js\nconst x = 1;\n```");
    expect(body).toContain("\\begin{lstlisting}");
    expect(body).toContain("const x = 1;");
    expect(body).not.toContain("minted");
    expect(requiredPackages).toContain("listings");
  });

  it("bảng GFM → tabular + booktabs", () => {
    const md = "| H1 | H2 |\n| --- | --- |\n| a | b |";
    const { body, requiredPackages } = conv(md);
    expect(body).toContain("\\begin{tabular}");
    expect(body).toContain("\\toprule");
    expect(body).toContain("\\midrule");
    expect(body).toContain("\\bottomrule");
    expect(requiredPackages).toContain("booktabs");
  });

  it("link → \\href + gói hyperref", () => {
    const { body, requiredPackages } = conv("[text](https://example.com)");
    expect(body).toContain("\\href{https://example.com}{text}");
    expect(requiredPackages).toContain("hyperref");
  });

  it("ảnh → placeholder \\fbox + cảnh báo (KHÔNG includegraphics)", () => {
    const { body, warnings } = conv("![sơ đồ](https://x/y.png)");
    expect(body).toContain("\\fbox{sơ đồ}");
    expect(body).not.toContain("\\includegraphics");
    expect(warnings.length).toBeGreaterThan(0);
  });

  it("math passthrough: $..$ giữ nguyên, $$..$$ → \\[..\\], cần amsmath", () => {
    const inline = conv("Công thức $E=mc^2$ ở đây.");
    expect(inline.body).toContain("$E=mc^2$");
    expect(inline.requiredPackages).toContain("amsmath");
    const display = conv("$$\\int_0^1 x^2\\,dx$$");
    expect(display.body).toContain("\\[\\int_0^1 x^2\\,dx\\]");
  });

  it("KHÔNG escape bên trong math (dấu _ và ^ giữ nguyên)", () => {
    const { body } = conv("Biến $x_1^2$ hợp lệ.");
    expect(body).toContain("$x_1^2$");
    expect(body).not.toContain("x\\_1");
  });

  it("escape đúng ký tự đặc biệt trong text thường", () => {
    const { body } = conv("Chi phí là 100% & tăng.");
    expect(body).toContain("100\\%");
    expect(body).toContain("\\&");
  });

  it("blockquote → quote; hr → hrulefill", () => {
    expect(conv("> trích dẫn").body).toContain("\\begin{quote}");
    expect(conv("a\n\n---\n\nb").body).toContain("\\hrulefill");
  });

  it("HTML nhúng được xử lý an toàn như văn bản (không thực thi, giữ nội dung text)", () => {
    // html:false → markdown-it coi HTML là VĂN BẢN thường (an toàn), không tạo html_block.
    const { body } = conv("<b>đậm</b>\n\nvăn bản");
    expect(body).toContain("văn bản");
    // Không sinh lệnh LaTeX từ thẻ HTML (chỉ là text).
    expect(body).not.toContain("\\textbf{đậm}");
  });
});
