// lib/ai/sanitize.ts
// Làm sạch output AI: bóc code fence, cắt văn xuôi thừa, kiểm cấu trúc tối thiểu.

export interface SanitizeResult {
  latex: string;
  ok: boolean; // false nếu thiếu cấu trúc tối thiểu
  reason?: string;
}

// Font Windows độc quyền (không có trên Linux) → font tương đương sẵn có trong image compile.
const FONT_REMAP: Record<string, string> = {
  "times new roman": "Liberation Serif",
  times: "TeX Gyre Termes",
  arial: "Liberation Sans",
  helvetica: "TeX Gyre Heros",
  calibri: "Liberation Sans",
  cambria: "TeX Gyre Termes",
  "courier new": "Liberation Mono",
  courier: "Liberation Mono",
  georgia: "TeX Gyre Termes",
  verdana: "Liberation Sans",
  tahoma: "Liberation Sans",
};

/** Đổi \set*font{FontWindows} sang font Linux tương đương để compile được dưới --untrusted. */
export function remapFonts(latex: string): string {
  return latex.replace(
    /(\\set(?:main|sans|mono)font)(\[[^\]]*\])?\{([^}]+)\}/g,
    (whole, cmd: string, opt: string | undefined, name: string) => {
      const repl = FONT_REMAP[name.trim().toLowerCase()];
      return repl ? `${cmd}${opt ?? ""}{${repl}}` : whole;
    },
  );
}

// Họ font MẶC ĐỊNH của XeLaTeX (Latin Modern). Đặt lại bằng TÊN là thừa (đã là mặc định)
// và gây lỗi "font cannot be found" khi Tectonic chạy KHÔNG có fontconfig (bản cài cục bộ,
// Windows/scoop). Latin Modern được Tectonic đóng gói sẵn nên mặc định luôn dùng được.
const DEFAULT_FONT_FAMILY =
  /^(?:latin\s*modern|lmodern|lmroman|lmsans|lmmono|computer\s*modern)\b/i;

/**
 * Loại các khai báo font dễ gây lỗi biên dịch ở môi trường không có fontconfig:
 *  - Bỏ MỌI \babelfont (babel vẫn chạy bình thường với font mặc định Latin Modern,
 *    vốn hỗ trợ Unicode/tiếng Việt) — đây là nguyên nhân lỗi "The font ... cannot be found".
 *  - Bỏ \setmainfont/\setsansfont/\setmonofont trỏ tới họ Latin Modern (thừa với mặc định).
 * Các font khác (đã remap sang Liberation/TeX Gyre) được giữ nguyên cho môi trường Docker.
 */
export function stripUnresolvableFonts(latex: string): string {
  let out = latex;

  // \babelfont[langs]{family}[features]{Font} → bỏ hẳn.
  out = out.replace(
    /\\babelfont\s*(?:\[[^\]]*\])?\s*\{[^{}]*\}\s*(?:\[[^\]]*\])?\s*\{[^{}]*\}/g,
    "",
  );

  // \set(main|sans|mono)font[features]{Latin Modern...}[features] → bỏ (đã là mặc định).
  out = out.replace(
    /\\set(?:main|sans|mono)font\s*(?:\[[^\]]*\])?\s*\{([^{}]+)\}\s*(?:\[[^\]]*\])?/g,
    (whole, name: string) => (DEFAULT_FONT_FAMILY.test(name.trim()) ? "" : whole),
  );

  // Gộp các dòng trắng thừa do việc xoá để lại (>=3 newline → 2).
  out = out.replace(/(?:[ \t]*\r?\n){3,}/g, "\n\n");

  return out;
}

export function sanitizeLatex(raw: string): SanitizeResult {
  let text = raw ?? "";

  // Bóc ```latex ... ``` hoặc ``` ... ``` bao quanh.
  const fence = text.match(/```(?:latex|tex)?\s*([\s\S]*?)```/i);
  if (fence) {
    text = fence[1];
  }

  // Cắt phần trước \documentclass và sau \end{document}.
  const start = text.indexOf("\\documentclass");
  if (start > 0) {
    text = text.slice(start);
  }
  const endMarker = "\\end{document}";
  const end = text.lastIndexOf(endMarker);
  if (end !== -1) {
    text = text.slice(0, end + endMarker.length);
  }

  text = text.trim() + "\n";

  // Đổi font Windows độc quyền → font Linux tương đương (chống model phớt lờ prompt).
  text = remapFonts(text);
  // Bỏ \babelfont và font Latin Modern đặt lại (thừa) — nguồn lỗi "font cannot be found"
  // khi Tectonic chạy không có fontconfig. Dùng font mặc định Latin Modern cho chắc ăn.
  text = stripUnresolvableFonts(text);

  const hasClass = /\\documentclass/.test(text);
  const hasBegin = /\\begin\{document\}/.test(text);
  const hasEnd = /\\end\{document\}/.test(text);
  if (!hasClass || !hasBegin || !hasEnd) {
    return {
      latex: text,
      ok: false,
      reason: "Thiếu \\documentclass, \\begin{document} hoặc \\end{document}",
    };
  }
  return { latex: text, ok: true };
}
