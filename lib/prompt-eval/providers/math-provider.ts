// lib/prompt-eval/providers/math-provider.ts
// Custom Promptfoo provider cho template `math` — hỗ trợ 2 version để so sánh:
//
//   v1 — baseline TRƯỚC KHI viết lại ở E6 Bước 1. Trích xuất Y NGUYÊN nội dung
//        (packages/preamble/body) từ git commit 2bc62faa1 (lệnh xác minh:
//        `git show 2bc62faa1:lib/templates/registry.ts`) — KHÔNG phải viết lại
//        theo trí nhớ. Chỉ có \newtheorem{theorem}/\newtheorem{lemma}/\newtheorem{definition}
//        cơ bản, promptGuidance tiếng Việt 4 dòng, không có knownTheoremEnvironments/
//        packageAllowlist (field này chưa tồn tại ở thời điểm đó).
//   v2 — hiện tại, đọc trực tiếp từ lib/templates/registry.ts qua renderTemplateLatex().
//        8 theorem environments, preamble contract, promptGuidance có cấu trúc 6 phần.
//
// Provider dùng MockProvider (KHÔNG gọi AI thật) — vì mục tiêu Phase 1 là so sánh CHẤT LƯỢNG
// CẤU TRÚC TEMPLATE (preamble/mock skeleton mà mọi lần generate đều dựa vào), không phải so sánh
// khả năng của một AI model cụ thể. So sánh với AI thật là bước sau, cần dataset lớn hơn + có
// budget gọi API — chưa cần ở Phase 1 (đúng nguyên tắc "không over-engineer khi chưa có nhu cầu
// thực tế" đã áp dụng nhiều lần trong epic này).
import type { ApiProvider, ProviderResponse } from "promptfoo";
import { MockProvider } from "@/lib/ai/mock";
import { renderTemplateLatex } from "@/lib/templates/registry";
import type { GenerateInput } from "@/lib/ai/types";

export type MathProviderVersion = "v1" | "v2";

/**
 * v1 baseline — trích xuất y nguyên từ `git show 2bc62faa1:lib/templates/registry.ts`.
 * Dùng lại wrap() hiện tại (chữ ký không đổi giữa 2 version: documentClass/packages/
 * preambleExtra/body) — chỉ nội dung khai báo (tiếng Việt, 2-3 theorem env cơ bản) là của v1.
 */
function renderMathV1(description: string): string {
  // Không import wrap() (không export) — build thủ công đúng cấu trúc \documentclass...\end{document}
  // mà wrap()/docRaw() hiện tại tạo ra, để không phụ thuộc vào implementation nội bộ có thể đổi.
  const packages = ["geometry", "amsmath", "amssymb", "amsthm", "mathtools"];
  const preambleExtra = [
    "\\newtheorem{theorem}{Định lý}",
    "\\newtheorem{lemma}{Bổ đề}",
    "\\theoremstyle{definition}",
    "\\newtheorem{definition}{Định nghĩa}",
  ];
  const body = [
    "\\section{Đặt vấn đề}",
    `Nội dung: ${description}`,
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
  ];
  const usepackages = packages.map((p) => `\\usepackage{${p}}`);
  return [
    "\\documentclass{article}",
    "\\usepackage{fontspec}",
    ...usepackages,
    ...preambleExtra,
    "\\title{Tài liệu mẫu}",
    "\\author{AI LaTeX Generator}",
    "\\begin{document}",
    "\\maketitle",
    ...body,
    "\\end{document}",
    "",
  ].join("\n");
}

export default class MathProvider implements ApiProvider {
  private readonly version: MathProviderVersion;

  constructor(options?: { config?: { version?: MathProviderVersion } }) {
    // Đọc version từ config trong promptfooconfig.yaml (mỗi provider instance = 1 version),
    // fallback env var PROMPT_VARIANT cho A/B test framework (xem feature-tracking.md Giai đoạn 3).
    this.version =
      options?.config?.version ?? (process.env.PROMPT_VARIANT as MathProviderVersion | undefined) ?? "v2";
  }

  id(): string {
    return `math-provider-${this.version}`;
  }

  async callApi(prompt: string): Promise<ProviderResponse> {
    if (this.version === "v1") {
      return { output: renderMathV1(prompt) };
    }
    // v2: gọi renderTemplateLatex() thật từ registry hiện tại — không duplicate logic.
    const mock = new MockProvider("happy");
    const input: GenerateInput = { description: prompt, docType: "article", template: "math" };
    const result = await mock.generate(input);
    return { output: result.latex };
  }
}

// Export riêng cho scorer/test cần biết version nào đang chạy mà không phải parse `id()`.
export { renderMathV1 };
