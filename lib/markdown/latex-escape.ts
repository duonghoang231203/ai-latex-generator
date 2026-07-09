// lib/markdown/latex-escape.ts
// Escape ký tự đặc biệt của LaTeX cho vùng VĂN BẢN thường.
// QUAN TRỌNG: chỉ dùng cho text ngoài vùng math ($...$) và code (verbatim/\texttt).
// Sai vùng escape là nguồn lỗi compile lớn nhất (xem research §6).

/**
 * Escape một chuỗi văn bản thường sang LaTeX an toàn.
 * Thứ tự xử lý quan trọng: backslash phải được thay TRƯỚC để không escape lại
 * các dấu backslash do chính bước escape sinh ra.
 */
export function escapeLatexText(input: string): string {
  return (
    input
      // 1) Backslash trước tiên → \textbackslash{} (dùng placeholder tạm để tránh đụng các bước sau).
      .replace(/\\/g, "\u0000BACKSLASH\u0000")
      // 2) Các ký tự cần thêm dấu \ phía trước.
      .replace(/([&%$#_{}])/g, "\\$1")
      // 3) Ký tự cần lệnh riêng.
      .replace(/~/g, "\\textasciitilde{}")
      .replace(/\^/g, "\\textasciicircum{}")
      // 4) Khôi phục backslash thành lệnh an toàn.
      .replace(/\u0000BACKSLASH\u0000/g, "\\textbackslash{}")
  );
}

/**
 * Escape nội dung cho \texttt{...} (inline code): giống text thường vì \texttt
 * vẫn diễn giải ký tự đặc biệt. (Code block dùng verbatim/listings, KHÔNG qua đây.)
 */
export function escapeInlineCode(input: string): string {
  return escapeLatexText(input);
}
