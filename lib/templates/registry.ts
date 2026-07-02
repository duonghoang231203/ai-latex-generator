// lib/templates/registry.ts
// Danh mục TEMPLATE cụ thể để chọn khi generate. Mỗi template định hình:
// - documentClass nền (article|report),
// - gói LaTeX gợi ý,
// - hướng dẫn cấu trúc/format đưa vào prompt (promptGuidance),
// - khung LaTeX mẫu hợp lệ cho MockProvider/dev offline (renderMock).
//
// Nguyên tắc an toàn compile (Tectonic --untrusted, XeLaTeX):
// - KHÔNG \includegraphics file ngoài (không tồn tại trong sandbox) → minh hoạ bằng
//   TikZ hoặc hộp placeholder.
// - Chỉ gói phổ biến trên CTAN; dùng fontspec (không inputenc/fontenc).

import type { DocType, LatexClass, TemplateId } from "@/lib/types/document";
import { TEMPLATE_IDS } from "@/lib/types/document";

export interface DocumentTemplate {
  id: TemplateId;
  label: string; // nhãn tiếng Việt cho UI
  category: string; // nhóm hiển thị
  description: string; // mô tả ngắn
  documentClass: LatexClass; // documentClass LaTeX thực tế
  packages: string[]; // gói gợi ý (đưa vào prompt + preamble mock)
  promptGuidance: string; // hướng dẫn cấu trúc/format cho AI
  renderMock: (description: string) => string; // khung LaTeX hợp lệ (mock/dev)
}

/** documentClass → DocType coarse (dùng cho metadata/tương thích). */
export function docTypeForClass(cls: LatexClass): DocType {
  return cls === "report" ? "report" : "article";
}

/** Tài liệu hoàn chỉnh, KHÔNG tự thêm title/maketitle — template tự kiểm soát body. */
function docRaw(
  documentClass: LatexClass,
  packages: string[],
  preamble: string[],
  body: string[],
): string {
  return [
    `\\documentclass{${documentClass}}`,
    "\\usepackage{fontspec}",
    ...packages.map((p) => `\\usepackage{${p}}`),
    ...preamble,
    "\\begin{document}",
    ...body,
    "\\end{document}",
    "",
  ].join("\n");
}

/** Tài liệu có \title/\author + \maketitle (cho class hỗ trợ: article/report/beamer/exam). */
function wrap(
  documentClass: LatexClass,
  packages: string[],
  preambleExtra: string[],
  body: string[],
): string {
  return docRaw(
    documentClass,
    packages,
    [...preambleExtra, "\\title{Tài liệu mẫu}", "\\author{AI LaTeX Generator}"],
    ["\\maketitle", ...body],
  );
}

export const TEMPLATES: Record<TemplateId, DocumentTemplate> = {
  general: {
    id: "general",
    label: "Báo cáo thường (thuần văn bản)",
    category: "Cơ bản",
    description:
      "Văn bản/báo cáo thuần chữ: tiêu đề, các mục, đoạn văn, danh sách. Không công thức phức tạp.",
    documentClass: "article",
    packages: ["geometry"],
    promptGuidance: [
      "DẠNG: Báo cáo thường, thuần văn bản.",
      "Cấu trúc: tiêu đề + (tuỳ chọn) tóm tắt ngắn, nhiều \\section (Giới thiệu, các phần nội dung,",
      "Kết luận) và \\subsection khi hợp lý. Dùng đoạn văn mạch lạc, danh sách (itemize/enumerate)",
      "và bảng đơn giản khi cần. TRÁNH công thức toán nặng, TRÁNH hình ảnh ngoài.",
    ].join(" "),
    renderMock: (d) =>
      wrap(
        "article",
        ["geometry"],
        [],
        [
          "\\section{Giới thiệu}",
          `Nội dung: ${d}`,
          "\\section{Nội dung chính}",
          "\\begin{itemize}",
          "\\item Ý thứ nhất.",
          "\\item Ý thứ hai.",
          "\\end{itemize}",
          "\\section{Kết luận}",
          "Tổng kết.",
        ],
      ),
  },

  academic: {
    id: "academic",
    label: "Bài báo học thuật",
    category: "Học thuật",
    description:
      "Bài báo khoa học: abstract, các mục chuẩn, hình/bảng, và danh mục tài liệu tham khảo.",
    documentClass: "article",
    packages: ["geometry", "amsmath", "graphicx", "hyperref"],
    promptGuidance: [
      "DẠNG: Bài báo học thuật.",
      "Cấu trúc: \\title, \\author, \\begin{abstract}...\\end{abstract}, rồi các mục:",
      "Giới thiệu, Công trình liên quan, Phương pháp, Kết quả, Thảo luận, Kết luận.",
      "Được dùng công thức (amsmath) và hình minh hoạ (bằng TikZ hoặc placeholder, KHÔNG file ngoài).",
      "Kết thúc bằng \\begin{thebibliography}{9} ... \\bibitem ... với vài tham khảo minh hoạ.",
    ].join(" "),
    renderMock: (d) =>
      wrap(
        "article",
        ["geometry", "amsmath", "graphicx", "hyperref"],
        [],
        [
          "\\begin{abstract}",
          `Tóm tắt: ${d}`,
          "\\end{abstract}",
          "\\section{Giới thiệu}",
          "Bối cảnh và động lực nghiên cứu.",
          "\\section{Phương pháp}",
          "Phương trình minh hoạ: \\( E = mc^2 \\).",
          "\\section{Kết quả}",
          "Kết quả chính.",
          "\\section{Kết luận}",
          "Kết luận và hướng phát triển.",
          "\\begin{thebibliography}{9}",
          "\\bibitem{ref1} Tác giả A. \\textit{Tiêu đề}. Nhà xuất bản, 2020.",
          "\\end{thebibliography}",
        ],
      ),
  },

  math: {
    id: "math",
    label: "Tài liệu Toán học",
    category: "Khoa học",
    description:
      "Định lý/bổ đề/chứng minh, công thức đánh số, hệ phương trình, ký hiệu toán.",
    documentClass: "article",
    packages: ["geometry", "amsmath", "amssymb", "amsthm", "mathtools"],
    promptGuidance: [
      "DẠNG: Tài liệu Toán học.",
      "Khai báo môi trường định lý trong preamble: \\newtheorem{theorem}{Định lý},",
      "\\newtheorem{lemma}{Bổ đề}, \\theoremstyle{definition}\\newtheorem{definition}{Định nghĩa}.",
      "Dùng amsmath/amssymb/mathtools. Trình bày định nghĩa, định lý kèm \\begin{proof}...\\end{proof},",
      "công thức đánh số bằng equation/align, hệ phương trình bằng cases. Giải thích bằng văn xuôi xen kẽ.",
    ].join(" "),
    renderMock: (d) =>
      wrap(
        "article",
        ["geometry", "amsmath", "amssymb", "amsthm", "mathtools"],
        [
          "\\newtheorem{theorem}{Định lý}",
          "\\newtheorem{lemma}{Bổ đề}",
          "\\theoremstyle{definition}",
          "\\newtheorem{definition}{Định nghĩa}",
        ],
        [
          "\\section{Đặt vấn đề}",
          `Nội dung: ${d}`,
          "\\begin{definition}",
          "Cho $f:\\mathbb{R}\\to\\mathbb{R}$ khả vi.",
          "\\end{definition}",
          "\\begin{theorem}",
          "Với mọi $x$, ta có đẳng thức sau.",
          "\\end{theorem}",
          "\\begin{equation}",
          "\\int_0^1 x^2 \\, dx = \\frac{1}{3}.",
          "\\end{equation}",
          "\\begin{proof}",
          "Suy trực tiếp từ định nghĩa tích phân.",
          "\\end{proof}",
        ],
      ),
  },

  physics: {
    id: "physics",
    label: "Tài liệu Vật lý",
    category: "Khoa học",
    description:
      "Công thức vật lý, đơn vị SI (siunitx), hình minh hoạ bằng TikZ, bảng số liệu.",
    documentClass: "article",
    packages: ["geometry", "amsmath", "amssymb", "siunitx", "graphicx", "tikz"],
    promptGuidance: [
      "DẠNG: Tài liệu Vật lý.",
      "Dùng amsmath cho công thức, siunitx cho đại lượng/đơn vị (vd \\SI{9.81}{m/s^2}, \\si{\\newton}).",
      "Hình minh hoạ vẽ bằng TikZ (\\begin{tikzpicture}...\\end{tikzpicture}) trong môi trường figure,",
      "KHÔNG \\includegraphics file ngoài. Bảng số liệu bằng tabular. Trình bày định luật, dẫn dắt công thức,",
      "và ví dụ tính toán có đơn vị.",
    ].join(" "),
    renderMock: (d) =>
      wrap(
        "article",
        ["geometry", "amsmath", "amssymb", "siunitx", "graphicx", "tikz"],
        [],
        [
          "\\section{Cơ sở lý thuyết}",
          `Nội dung: ${d}`,
          "Định luật II Newton: \\( F = ma \\).",
          "\\begin{equation}",
          "F = m a, \\quad g = \\SI{9.81}{m/s^2}.",
          "\\end{equation}",
          "\\begin{figure}[h]",
          "\\centering",
          "\\begin{tikzpicture}",
          "\\draw[->] (0,0) -- (2,0) node[right] {$x$};",
          "\\draw[->] (0,0) -- (0,2) node[above] {$y$};",
          "\\draw[thick] (0,0) -- (1.5,1.5);",
          "\\end{tikzpicture}",
          "\\caption{Sơ đồ minh hoạ (vẽ bằng TikZ).}",
          "\\end{figure}",
        ],
      ),
  },

  technical: {
    id: "technical",
    label: "Báo cáo kỹ thuật",
    category: "Kỹ thuật",
    description:
      "Báo cáo kỹ thuật: bảng đẹp (booktabs), sơ đồ TikZ, đoạn mã, hình minh hoạ.",
    documentClass: "article",
    packages: ["geometry", "amsmath", "graphicx", "booktabs", "tikz", "listings"],
    promptGuidance: [
      "DẠNG: Báo cáo kỹ thuật.",
      "Cấu trúc: Tổng quan, Kiến trúc/Thiết kế, Triển khai, Đánh giá, Kết luận.",
      "Dùng booktabs cho bảng (\\toprule/\\midrule/\\bottomrule), TikZ cho sơ đồ khối,",
      "listings cho đoạn mã (\\begin{lstlisting}...\\end{lstlisting}). Hình vẽ bằng TikZ, KHÔNG file ngoài.",
    ].join(" "),
    renderMock: (d) =>
      wrap(
        "article",
        ["geometry", "amsmath", "graphicx", "booktabs", "tikz", "listings"],
        [],
        [
          "\\section{Tổng quan}",
          `Nội dung: ${d}`,
          "\\section{Kết quả đo}",
          "\\begin{tabular}{lr}",
          "\\toprule",
          "Chỉ số & Giá trị \\\\",
          "\\midrule",
          "Thông lượng & 120 \\\\",
          "Độ trễ & 8 \\\\",
          "\\bottomrule",
          "\\end{tabular}",
          "\\section{Sơ đồ khối}",
          "\\begin{tikzpicture}",
          "\\node[draw] (a) {Input}; \\node[draw,right=of a] (b) {Xử lý};",
          "\\draw[->] (a) -- (b);",
          "\\end{tikzpicture}",
        ],
      ),
  },

  thesis: {
    id: "thesis",
    label: "Luận văn / Báo cáo dài",
    category: "Học thuật",
    description:
      "Tài liệu dài nhiều chương: trang tiêu đề, mục lục, các \\chapter, mở đầu → kết luận.",
    documentClass: "report",
    packages: ["geometry", "amsmath", "graphicx", "hyperref"],
    promptGuidance: [
      "DẠNG: Luận văn/Báo cáo dài (documentclass report).",
      "Cấu trúc: trang tiêu đề (\\maketitle), \\tableofcontents, rồi nhiều \\chapter:",
      "Mở đầu/Giới thiệu, các chương nội dung chính, Kết luận & Khuyến nghị.",
      "Mỗi \\chapter chia thành \\section/\\subsection với nội dung thực chất.",
    ].join(" "),
    renderMock: (d) =>
      wrap(
        "report",
        ["geometry", "amsmath", "graphicx", "hyperref"],
        [],
        [
          "\\tableofcontents",
          "\\chapter{Giới thiệu}",
          `Nội dung: ${d}`,
          "\\section{Bối cảnh}",
          "Chi tiết bối cảnh.",
          "\\chapter{Nội dung chính}",
          "\\section{Phần 1}",
          "Chi tiết.",
          "\\chapter{Kết luận}",
          "Tổng kết và khuyến nghị.",
        ],
      ),
  },

  slides: {
    id: "slides",
    label: "Trình chiếu (Beamer)",
    category: "Trình chiếu",
    description:
      "Slide thuyết trình Beamer: trang tiêu đề, các frame, danh sách, block, công thức.",
    documentClass: "beamer",
    packages: ["amsmath"],
    promptGuidance: [
      "DẠNG: Trình chiếu Beamer (\\documentclass{beamer}).",
      "Bắt đầu bằng \\title/\\author và \\maketitle (frame tiêu đề). Mỗi slide là",
      "\\begin{frame}{Tiêu đề slide} ... \\end{frame}. Dùng itemize/enumerate, \\begin{block}{...},",
      "và công thức khi cần. Giữ mỗi frame NGẮN GỌN (vài ý). Có thể \\section để chia phần.",
      "TRÁNH \\includegraphics file ngoài; nếu cần hình thì vẽ bằng TikZ.",
    ].join(" "),
    renderMock: (d) =>
      wrap(
        "beamer",
        ["amsmath"],
        [],
        [
          "\\begin{frame}{Giới thiệu}",
          `${d}`,
          "\\begin{itemize}",
          "\\item Ý chính thứ nhất.",
          "\\item Ý chính thứ hai.",
          "\\end{itemize}",
          "\\end{frame}",
          "\\begin{frame}{Kết luận}",
          "\\begin{block}{Tóm lại}",
          "Thông điệp chính.",
          "\\end{block}",
          "\\end{frame}",
        ],
      ),
  },

  letter: {
    id: "letter",
    label: "Thư trang trọng",
    category: "Thư tín & Hồ sơ",
    description:
      "Thư trang trọng: địa chỉ người gửi/nhận, lời mở đầu, nội dung, lời kết và chữ ký.",
    documentClass: "letter",
    packages: [],
    promptGuidance: [
      "DẠNG: Thư trang trọng (\\documentclass{letter}).",
      "Preamble: \\address{Người gửi\\\\Địa chỉ}, \\signature{Tên người gửi}.",
      "Thân: \\begin{letter}{Người nhận\\\\Địa chỉ} \\opening{Kính gửi ...,} <các đoạn nội dung>",
      "\\closing{Trân trọng,} \\end{letter}. KHÔNG dùng \\maketitle (class letter không có).",
    ].join(" "),
    renderMock: (d) =>
      docRaw(
        "letter",
        [],
        ["\\address{Người gửi\\\\Địa chỉ người gửi}", "\\signature{Người gửi}"],
        [
          "\\begin{letter}{Người nhận\\\\Địa chỉ người nhận}",
          "\\opening{Kính gửi Quý vị,}",
          `${d}`,
          "Rất mong nhận được phản hồi từ Quý vị.",
          "\\closing{Trân trọng,}",
          "\\end{letter}",
        ],
      ),
  },

  cv: {
    id: "cv",
    label: "Sơ yếu lý lịch / CV",
    category: "Thư tín & Hồ sơ",
    description:
      "CV một trang: tiêu đề tên + liên hệ, các mục Mục tiêu, Kinh nghiệm, Học vấn, Kỹ năng.",
    documentClass: "article",
    packages: ["geometry", "hyperref", "enumitem"],
    promptGuidance: [
      "DẠNG: Sơ yếu lý lịch / CV (documentclass article, gọn 1–2 trang).",
      "Đầu trang: tên (cỡ lớn, in đậm) + thông tin liên hệ (email, điện thoại) căn giữa.",
      "Các mục dùng \\section*{...}: Mục tiêu, Kinh nghiệm, Học vấn, Kỹ năng.",
      "Trình bày mục kinh nghiệm/học vấn theo dòng: đơn vị — vai trò (thời gian), rồi mô tả.",
      "KHÔNG dùng class moderncv (dễ lỗi tải); chỉ dùng gói phổ biến. Không hình ngoài.",
    ].join(" "),
    renderMock: (d) =>
      docRaw(
        "article",
        ["geometry", "hyperref", "enumitem"],
        [],
        [
          "\\begin{center}",
          "{\\LARGE \\textbf{Nguyễn Văn A}}\\\\[2pt]",
          "email@example.com \\quad 0123 456 789",
          "\\end{center}",
          "\\section*{Mục tiêu}",
          `${d}`,
          "\\section*{Kinh nghiệm}",
          "\\textbf{Công ty X} — Kỹ sư phần mềm (2020--2023)\\\\",
          "Phát triển và bảo trì hệ thống.",
          "\\section*{Học vấn}",
          "Đại học Y — Cử nhân CNTT (2016--2020).",
          "\\section*{Kỹ năng}",
          "\\begin{itemize}[nosep]",
          "\\item Ngôn ngữ: TypeScript, Python.",
          "\\item Công cụ: Git, Docker.",
          "\\end{itemize}",
        ],
      ),
  },

  exam: {
    id: "exam",
    label: "Đề thi / Bài kiểm tra",
    category: "Giáo dục",
    description:
      "Đề thi dùng class exam: danh sách câu hỏi, câu hỏi con (parts), điểm số.",
    documentClass: "exam",
    packages: ["amsmath"],
    promptGuidance: [
      "DẠNG: Đề thi/bài kiểm tra (\\documentclass{exam}).",
      "Dùng môi trường \\begin{questions} ... \\end{questions} với mỗi câu là \\question[điểm].",
      "Câu hỏi con dùng \\begin{parts}\\part ...\\end{parts}. Có thể chèn công thức (amsmath).",
      "Có thể thêm phần hướng dẫn/đầu đề ngắn trước danh sách câu hỏi.",
    ].join(" "),
    renderMock: (d) =>
      wrap(
        "exam",
        ["amsmath"],
        [],
        [
          `Hướng dẫn: ${d}`,
          "\\begin{questions}",
          "\\question[2] Tính đạo hàm của $f(x) = x^2$.",
          "\\begin{parts}",
          "\\part Nêu công thức đạo hàm.",
          "\\part Áp dụng cho $f(x)=x^2$.",
          "\\end{parts}",
          "\\question[3] Giải phương trình $x + 1 = 0$.",
          "\\end{questions}",
        ],
      ),
  },

  chemistry: {
    id: "chemistry",
    label: "Tài liệu Hóa học",
    category: "Khoa học",
    description:
      "Hóa học: phương trình phản ứng bằng mhchem (\\ce), công thức, bảng số liệu.",
    documentClass: "article",
    packages: ["geometry", "amsmath", "mhchem"],
    promptGuidance: [
      "DẠNG: Tài liệu Hóa học.",
      "Dùng gói mhchem: viết phản ứng/công thức bằng \\ce{...} (vd \\ce{2 H2 + O2 -> 2 H2O},",
      "\\ce{H2SO4}). Phương trình phản ứng quan trọng đặt trong equation. Bảng số liệu bằng tabular.",
      "Trình bày lý thuyết, phương trình phản ứng, và ví dụ tính toán (mol, khối lượng).",
    ].join(" "),
    renderMock: (d) =>
      wrap(
        "article",
        ["geometry", "amsmath", "mhchem"],
        [],
        [
          "\\section{Phản ứng}",
          `${d}`,
          "Phản ứng đốt cháy khí hydro:",
          "\\begin{equation}",
          "\\ce{2 H2 + O2 -> 2 H2O}",
          "\\end{equation}",
          "\\section{Bảng dữ liệu}",
          "\\begin{tabular}{lr}",
          "Chất & Khối lượng mol (g/mol) \\\\",
          "\\ce{H2} & 2 \\\\",
          "\\ce{O2} & 32 \\\\",
          "\\end{tabular}",
        ],
      ),
  },
};

export const DEFAULT_TEMPLATE: TemplateId = "general";

export function isTemplateId(v: unknown): v is TemplateId {
  return typeof v === "string" && (TEMPLATE_IDS as readonly string[]).includes(v);
}

export function getTemplate(id: TemplateId): DocumentTemplate {
  return TEMPLATES[id];
}

/** Danh sách template cho UI (giữ thứ tự khai báo). */
export function listTemplates(): DocumentTemplate[] {
  return TEMPLATE_IDS.map((id) => TEMPLATES[id]);
}

/** Suy ra template mặc định từ docType (tương thích ngược khi chỉ có docType). */
export function templateForDocType(docType: DocType): TemplateId {
  return docType === "report" ? "thesis" : "general";
}

/** Render LaTeX mẫu hợp lệ theo template (dùng cho MockProvider/dev offline). */
export function renderTemplateLatex(id: TemplateId, description: string): string {
  return TEMPLATES[id].renderMock(description || "(mô tả trống)");
}
