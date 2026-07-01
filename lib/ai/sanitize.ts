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
