// lib/markdown/markdown-to-latex.ts
// Điểm vào converter TẤT ĐỊNH: Markdown → THÂN LaTeX (không kèm preamble).
// Preamble/documentclass do template lo (lib/templates/registry.ts :: wrapBodyInTemplate).

import type { LatexClass } from "@/lib/types/document";
import { parseMarkdown } from "@/lib/markdown/markdown-parser";
import { createEmitContext } from "@/lib/markdown/emit-context";
import { renderRange } from "@/lib/markdown/latex-emitter";

export interface ConvertResult {
  /** Thân LaTeX (nội dung giữa \begin{document}...\end{document}). */
  body: string;
  /** Gói LaTeX phát sinh theo nội dung (merge với packages của template khi bọc). */
  requiredPackages: string[];
  /** Cảnh báo cho người dùng (ảnh placeholder, HTML bỏ qua...). */
  warnings: string[];
}

/**
 * Chuyển Markdown → thân LaTeX theo luật tất định.
 * `documentClass` quyết định heading (report có \chapter, article thì không).
 */
export function convertMarkdownToLatexBody(
  markdown: string,
  opts: { documentClass: LatexClass },
): ConvertResult {
  const tokens = parseMarkdown(markdown);
  const ctx = createEmitContext(opts.documentClass);
  const body =
    renderRange(tokens, 0, tokens.length, ctx)
      .replace(/\n{3,}/g, "\n\n")
      .trim() + "\n";
  return { body, requiredPackages: [...ctx.packages], warnings: ctx.warnings };
}
