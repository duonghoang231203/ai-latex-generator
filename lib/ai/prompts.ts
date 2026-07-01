// lib/ai/prompts.ts
import type { GenerateInput } from "@/lib/ai/types";

export const SYSTEM_PROMPT = [
  "Bạn là chuyên gia LaTeX. Nhiệm vụ: từ mô tả của người dùng, sinh ra MỘT tài liệu LaTeX",
  "HOÀN CHỈNH và CÓ THỂ COMPILE bằng Tectonic (engine XeTeX/XeLaTeX).",
  "",
  "Quy tắc bắt buộc:",
  "- Trả về CHỈ mã LaTeX, không giải thích, không markdown fence.",
  "- Tài liệu đầy đủ: \\documentclass{...} ... \\begin{document} ... \\end{document}.",
  "- Chỉ dùng package phổ biến, có trên CTAN (Tectonic tự tải).",
  "- KHÔNG dùng \\write18 / shell-escape / lệnh đọc-ghi file ngoài.",
  "- Dùng UTF-8. Vì compile bằng XeLaTeX: dùng fontspec (và polyglossia khi cần)",
  "  cho Unicode/tiếng Việt. KHÔNG dùng inputenc/fontenc kiểu pdfLaTeX.",
  "- KHÔNG đặt \\setmainfont/\\setsansfont với font hệ điều hành độc quyền",
  "  (vd 'Times New Roman', 'Arial', 'Calibri', 'Cambria'). Ưu tiên KHÔNG đặt font",
  "  (dùng Latin Modern mặc định). Nếu cần đổi font, chỉ dùng font có sẵn trên Linux/TeX:",
  "  'Latin Modern Roman', 'TeX Gyre Termes', 'TeX Gyre Pagella', hoặc 'Liberation Serif'.",
  "- Ưu tiên cú pháp an toàn, biên dịch được; tránh package hiếm/khó tải.",
].join("\n");

function structureHint(docType: GenerateInput["docType"]): string {
  return docType === "report"
    ? "Cấu trúc report: title page, các \\chapter (mỗi chapter có \\section), mở đầu và kết luận."
    : "Cấu trúc article: title, author, abstract (nếu hợp lý), các \\section, kết luận.";
}

export function buildUserPrompt(input: GenerateInput): string {
  if (input.errorContext) {
    return [
      "Mã LaTeX dưới đây KHÔNG hợp lệ (lỗi parser) hoặc compile LỖI bằng Tectonic.",
      "Hãy SỬA để hợp lệ và compile thành công, giữ nguyên ý đồ nội dung và template.",
      "Chỉ trả về mã LaTeX đã sửa hoàn chỉnh.",
      "",
      "--- LaTeX hiện tại ---",
      input.errorContext.previousLatex,
      "",
      "--- Chẩn đoán (AST) / Log lỗi (Tectonic) ---",
      input.errorContext.errorLog,
    ].join("\n");
  }
  return [
    `Loại tài liệu: ${input.docType}   (article | report)`,
    "Mô tả của người dùng:",
    '"""',
    input.description,
    '"""',
    structureHint(input.docType),
    "Hãy sinh tài liệu LaTeX hoàn chỉnh tương ứng.",
  ].join("\n");
}
