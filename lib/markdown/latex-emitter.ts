// lib/markdown/latex-emitter.ts
// Phát LaTeX cho token BLOCK của markdown-it: heading, paragraph, list (lồng),
// bảng GFM (→ tabular + booktabs), code fence (→ listings), blockquote, hr.
// Nội dung inline uỷ cho renderInline; math passthrough xử lý trong inline-emitter.

import type { MarkdownToken as Token } from "@/lib/markdown/markdown-parser";
import type { LatexClass } from "@/lib/types/document";
import type { EmitContext } from "@/lib/markdown/emit-context";
import { renderInline } from "@/lib/markdown/inline-emitter";

/** Tìm index token đóng khớp cho token mở (tính cả lồng cùng loại). */
function matchCloseAt(tokens: Token[], openIdx: number): number {
  const openType = tokens[openIdx].type;
  const closeType = openType.replace(/_open$/, "_close");
  let depth = 0;
  for (let j = openIdx; j < tokens.length; j++) {
    if (tokens[j].type === openType) depth += 1;
    else if (tokens[j].type === closeType) {
      depth -= 1;
      if (depth === 0) return j;
    }
  }
  return tokens.length - 1;
}

/** Ánh xạ heading theo documentClass: report có \chapter, article thì không. */
function headingCommand(tag: string, cls: LatexClass, text: string): string {
  const level = Number(tag.slice(1)) || 1; // 'h2' → 2
  const map =
    cls === "report"
      ? ["\\chapter", "\\section", "\\subsection", "\\subsubsection", "\\paragraph", "\\subparagraph"]
      : ["\\section", "\\subsection", "\\subsubsection", "\\paragraph", "\\subparagraph", "\\subparagraph"];
  const cmd = map[Math.min(level - 1, map.length - 1)];
  return `${cmd}{${text}}`;
}

/** Code fence/block → listings (KHÔNG minted: cần shell-escape, bị cấm trong sandbox). */
function emitCodeBlock(content: string): string {
  // Không đặt language= để tránh lỗi "Couldn't load requested language" khi lang lạ.
  const body = content.replace(/\n+$/, "");
  return `\\begin{lstlisting}\n${body}\n\\end{lstlisting}`;
}

function renderListItems(tokens: Token[], start: number, end: number, ctx: EmitContext): string {
  let out = "";
  let i = start;
  while (i < end) {
    if (tokens[i].type === "list_item_open") {
      const close = matchCloseAt(tokens, i);
      const inner = renderRange(tokens, i + 1, close, ctx).trim();
      out += `\\item ${inner}\n`;
      i = close + 1;
    } else {
      i += 1;
    }
  }
  return out;
}

function renderTable(tokens: Token[], start: number, end: number, ctx: EmitContext): string {
  ctx.packages.add("booktabs");
  const rows: { cells: string[]; header: boolean }[] = [];
  let inHead = false;
  let cur: string[] | null = null;
  let curHeader = false;
  for (let i = start; i <= end; i++) {
    const t = tokens[i];
    if (t.type === "thead_open") inHead = true;
    else if (t.type === "thead_close") inHead = false;
    else if (t.type === "tr_open") {
      cur = [];
      curHeader = inHead;
    } else if (t.type === "tr_close") {
      if (cur) rows.push({ cells: cur, header: curHeader });
      cur = null;
    } else if (t.type === "th_open" || t.type === "td_open") {
      const inlineTok = tokens[i + 1];
      const txt =
        inlineTok && inlineTok.type === "inline" ? renderInline(inlineTok.children ?? [], ctx) : "";
      cur?.push(txt);
    }
  }
  const cols = rows.length ? Math.max(...rows.map((r) => r.cells.length)) : 1;
  const lines = [`\\begin{tabular}{${"l".repeat(cols)}}`, "\\toprule"];
  for (const r of rows) {
    lines.push(`${r.cells.join(" & ")} \\\\`);
    if (r.header) lines.push("\\midrule");
  }
  lines.push("\\bottomrule", "\\end{tabular}");
  return lines.join("\n");
}

/** Duyệt dải token [start,end) ở mức block → LaTeX. */
export function renderRange(tokens: Token[], start: number, end: number, ctx: EmitContext): string {
  let out = "";
  let i = start;
  while (i < end) {
    const t = tokens[i];
    switch (t.type) {
      case "heading_open": {
        const close = matchCloseAt(tokens, i);
        const inlineTok = tokens[i + 1];
        const text =
          inlineTok && inlineTok.type === "inline" ? renderInline(inlineTok.children ?? [], ctx) : "";
        out += `${headingCommand(t.tag, ctx.documentClass, text)}\n\n`;
        i = close + 1;
        break;
      }
      case "paragraph_open": {
        const close = matchCloseAt(tokens, i);
        const inlineTok = tokens[i + 1];
        const text =
          inlineTok && inlineTok.type === "inline" ? renderInline(inlineTok.children ?? [], ctx) : "";
        if (text.trim()) out += `${text}\n\n`;
        i = close + 1;
        break;
      }
      case "bullet_list_open": {
        const close = matchCloseAt(tokens, i);
        out += `\\begin{itemize}\n${renderListItems(tokens, i + 1, close, ctx)}\\end{itemize}\n\n`;
        i = close + 1;
        break;
      }
      case "ordered_list_open": {
        const close = matchCloseAt(tokens, i);
        out += `\\begin{enumerate}\n${renderListItems(tokens, i + 1, close, ctx)}\\end{enumerate}\n\n`;
        i = close + 1;
        break;
      }
      case "fence":
      case "code_block": {
        ctx.packages.add("listings");
        out += `${emitCodeBlock(t.content)}\n\n`;
        i += 1;
        break;
      }
      case "blockquote_open": {
        const close = matchCloseAt(tokens, i);
        out += `\\begin{quote}\n${renderRange(tokens, i + 1, close, ctx).trim()}\n\\end{quote}\n\n`;
        i = close + 1;
        break;
      }
      case "hr":
        out += "\\hrulefill\n\n";
        i += 1;
        break;
      case "table_open": {
        const close = matchCloseAt(tokens, i);
        out += `${renderTable(tokens, i, close, ctx)}\n\n`;
        i = close + 1;
        break;
      }
      case "html_block":
        // Bỏ qua HTML nhúng (không đưa raw HTML vào LaTeX).
        i += 1;
        break;
      default:
        i += 1;
        break;
    }
  }
  return out;
}
