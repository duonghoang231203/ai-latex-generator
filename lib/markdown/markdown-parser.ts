// lib/markdown/markdown-parser.ts
// Bọc markdown-it: parse Markdown → token stream. Cấu hình tất định (không linkify/
// typographer để output ổn định, dễ test snapshot). Preset mặc định bật GFM tables +
// strikethrough. html:false → HTML nhúng thành VĂN BẢN thường (an toàn, không thực thi).
//
// QUAN TRỌNG: đăng ký rule MATH chạy TRƯỚC rule `escape` để giữ NGUYÊN nội dung toán.
// Nếu không, markdown-it sẽ "unescape" các lệnh như `\,` → `,` (hỏng LaTeX math).

import MarkdownIt from "markdown-it";

/** Kiểu Token của markdown-it (suy ra từ kiểu trả về của parse để tránh truy cập namespace). */
export type MarkdownToken = ReturnType<InstanceType<typeof MarkdownIt>["parse"]>[number];

/** Phần state inline tối thiểu mà rule math cần (tránh import type theo đường .mjs). */
interface InlineState {
  src: string;
  pos: number;
  push(type: string, tag: string, nesting: number): MarkdownToken;
}

type InlineRule = Parameters<InstanceType<typeof MarkdownIt>["inline"]["ruler"]["before"]>[2];

/** Rule inline bắt `$...$` (inline) và `$$...$$` (display), giữ raw content. */
function mathInlineRule(state: InlineState, silent: boolean): boolean {
  const src = state.src;
  const start = state.pos;
  if (src[start] !== "$") return false;

  const isDisplay = src[start + 1] === "$";
  const marker = isDisplay ? "$$" : "$";
  const contentStart = start + marker.length;
  const end = src.indexOf(marker, contentStart);
  if (end === -1) return false;

  const content = src.slice(contentStart, end);
  if (content.trim() === "") return false; // '$$' rỗng → không phải math

  if (!silent) {
    const token = state.push(isDisplay ? "math_block_inline" : "math_inline", "math", 0);
    token.content = content;
    token.markup = marker;
  }
  state.pos = end + marker.length;
  return true;
}

let md: MarkdownIt | null = null;

function getInstance(): MarkdownIt {
  if (!md) {
    md = new MarkdownIt({ html: false, linkify: false, typographer: false });
    md.inline.ruler.before("escape", "math", mathInlineRule as InlineRule);
  }
  return md;
}

/** Parse Markdown thành mảng token (block + inline). */
export function parseMarkdown(source: string): MarkdownToken[] {
  return getInstance().parse(source, {});
}
