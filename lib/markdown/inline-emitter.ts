// lib/markdown/inline-emitter.ts
// Phát LaTeX cho nội dung INLINE (children của token `inline` trong markdown-it):
// đậm/nghiêng/gạch, code inline, link, ảnh (placeholder), và MATH passthrough.

import type { MarkdownToken as Token } from "@/lib/markdown/markdown-parser";
import { escapeLatexText, escapeInlineCode } from "@/lib/markdown/latex-escape";
import type { EmitContext } from "@/lib/markdown/emit-context";

/** Escape ký tự nhạy cảm trong URL cho \href (% và # phá cú pháp). */
function escapeUrl(url: string): string {
  return url.replace(/([%#\\])/g, "\\$1");
}

function getAttr(t: Token, name: string): string {
  const found = t.attrs?.find((a: [string, string]) => a[0] === name);
  return found ? found[1] : "";
}

/**
 * Tách chuỗi text thành vùng MATH (passthrough) và vùng thường (escape).
 * - `$$...$$` → `\[...\]` (display, giữ nguyên nội dung toán).
 * - `$...$`  → `$...$` (inline, giữ nguyên).
 * Ngoài math → escapeLatexText. Cần amsmath khi có math.
 */
export function emitTextWithMath(text: string, ctx: EmitContext): string {
  let out = "";
  let buf = "";
  const flush = () => {
    if (buf) {
      out += escapeLatexText(buf);
      buf = "";
    }
  };
  let i = 0;
  while (i < text.length) {
    // Display math $$...$$
    if (text[i] === "$" && text[i + 1] === "$") {
      const end = text.indexOf("$$", i + 2);
      if (end !== -1) {
        flush();
        ctx.packages.add("amsmath");
        out += "\\[" + text.slice(i + 2, end) + "\\]";
        i = end + 2;
        continue;
      }
    }
    // Inline math $...$ (không rỗng, không phải $$)
    if (text[i] === "$") {
      const end = text.indexOf("$", i + 1);
      if (end !== -1 && end > i + 1) {
        flush();
        ctx.packages.add("amsmath");
        out += "$" + text.slice(i + 1, end) + "$";
        i = end + 1;
        continue;
      }
    }
    buf += text[i];
    i += 1;
  }
  flush();
  return out;
}

/** Tìm index token đóng khớp cho một token mở (tính cả lồng cùng loại). */
function matchClose(children: Token[], openIdx: number): number {
  const openType = children[openIdx].type;
  const closeType = openType.replace(/_open$/, "_close");
  let depth = 0;
  for (let j = openIdx; j < children.length; j++) {
    if (children[j].type === openType) depth += 1;
    else if (children[j].type === closeType) {
      depth -= 1;
      if (depth === 0) return j;
    }
  }
  return children.length - 1;
}

/** Duyệt children của token inline → chuỗi LaTeX. */
export function renderInline(children: Token[], ctx: EmitContext): string {
  let out = "";
  for (let i = 0; i < children.length; i++) {
    const t = children[i];
    switch (t.type) {
      case "text":
        out += emitTextWithMath(t.content, ctx);
        break;
      case "math_inline":
        ctx.packages.add("amsmath");
        out += `$${t.content}$`;
        break;
      case "math_block_inline":
        ctx.packages.add("amsmath");
        out += `\\[${t.content}\\]`;
        break;
      case "softbreak":
        out += " ";
        break;
      case "hardbreak":
        out += "\\\\\n";
        break;
      case "code_inline":
        out += "\\texttt{" + escapeInlineCode(t.content) + "}";
        break;
      case "strong_open": {
        const close = matchClose(children, i);
        out += "\\textbf{" + renderInline(children.slice(i + 1, close), ctx) + "}";
        i = close;
        break;
      }
      case "em_open": {
        const close = matchClose(children, i);
        out += "\\emph{" + renderInline(children.slice(i + 1, close), ctx) + "}";
        i = close;
        break;
      }
      case "s_open": {
        const close = matchClose(children, i);
        ctx.packages.add("ulem");
        out += "\\sout{" + renderInline(children.slice(i + 1, close), ctx) + "}";
        i = close;
        break;
      }
      case "link_open": {
        const href = getAttr(t, "href");
        const close = matchClose(children, i);
        const inner = renderInline(children.slice(i + 1, close), ctx);
        ctx.packages.add("hyperref");
        out += "\\href{" + escapeUrl(href) + "}{" + inner + "}";
        i = close;
        break;
      }
      case "image": {
        // Sandbox KHÔNG có file ngoài → placeholder, KHÔNG \includegraphics.
        const alt = t.content || getAttr(t, "alt") || "image";
        ctx.warnings.push(
          `Ảnh "${alt}" được thay bằng ô placeholder (sandbox không hỗ trợ file ngoài).`,
        );
        out += "\\fbox{" + escapeLatexText(alt) + "}";
        break;
      }
      case "html_inline":
        // Bỏ qua HTML nhúng để an toàn (không đưa raw HTML vào LaTeX).
        break;
      default:
        break;
    }
  }
  return out;
}
