// lib/ai/sanitize.ts
// Làm sạch output AI: bóc code fence, cắt văn xuôi thừa, kiểm cấu trúc tối thiểu.

export interface SanitizeResult {
  latex: string;
  ok: boolean; // false nếu thiếu cấu trúc tối thiểu
  reason?: string;
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
